// Instruments for the city music, all synthesized with the Web Audio API.
// Plucked strings (saz, oud, sitar, koto, guitars) use the Karplus-Strong algorithm: a burst of
// noise fed through a short delay line with a little damping rings like a string. The rings are
// rendered once per note into buffers and replayed, which is cheap on phones.

export const hz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

export interface PluckPreset {
  // 0 = dark and soft (nylon, oud), 1 = bright and metallic (saz, sitar).
  bright: number;
  // Feedback per period: closer to 1 rings longer.
  damp: number;
  // Seconds rendered into the buffer.
  duration: number;
  // Optional resonance that gives the sitar its buzz or a body its colour.
  peak?: { freq: number; q: number; gain: number };
}

export const PLUCKS = {
  saz: { bright: 0.9, damp: 0.994, duration: 0.9, peak: { freq: 2800, q: 1.2, gain: 5 } },
  mandolin: { bright: 0.8, damp: 0.995, duration: 0.6 },
  guitar: { bright: 0.45, damp: 0.996, duration: 1.2 },
  oud: { bright: 0.35, damp: 0.995, duration: 1.0, peak: { freq: 900, q: 1, gain: 4 } },
  sitar: { bright: 0.95, damp: 0.998, duration: 2.0, peak: { freq: 3200, q: 1.6, gain: 9 } },
  tanpura: { bright: 0.85, damp: 0.9993, duration: 3.0, peak: { freq: 2600, q: 1.4, gain: 7 } },
  koto: { bright: 0.6, damp: 0.997, duration: 1.6, peak: { freq: 1500, q: 1, gain: 3 } },
  nylon: { bright: 0.3, damp: 0.996, duration: 1.4 },
  vihuela: { bright: 0.7, damp: 0.993, duration: 0.5 },
  bass: { bright: 0.2, damp: 0.997, duration: 1.0 },
} satisfies Record<string, PluckPreset>;

export type PluckName = keyof typeof PLUCKS;

export class Synth {
  private readonly noise: AudioBuffer;
  private readonly rings = new Map<string, { buffer: AudioBuffer; rate: number }>();

  constructor(
    readonly ctx: BaseAudioContext,
    readonly out: AudioNode,
  ) {
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  // --- Building blocks ---------------------------------------------------------------------

  // A percussive envelope: quick rise, exponential fall.
  private decay(gain: GainNode, at: number, peak: number, length: number, attack = 0.005): void {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  }

  // A held envelope for winds and reeds: rise, hold, release.
  private hold(gain: GainNode, at: number, peak: number, length: number, attack: number, release: number): void {
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + attack);
    gain.gain.setValueAtTime(peak, at + Math.max(attack, length));
    gain.gain.linearRampToValueAtTime(0, at + Math.max(attack, length) + release);
  }

  private vibrato(target: AudioParam, freq: number, at: number, end: number, rate: number, depth: number): void {
    const lfo = this.ctx.createOscillator();
    const amount = this.ctx.createGain();
    lfo.frequency.value = rate;
    amount.gain.setValueAtTime(0, at);
    // Vibrato grows in after the note starts, like a player would do it.
    amount.gain.linearRampToValueAtTime(freq * depth, at + 0.25);
    lfo.connect(amount).connect(target);
    lfo.start(at);
    lfo.stop(end);
  }

  tone(type: OscillatorType, freq: number, at: number, length: number, gain: number, attack = 0.005, glide = 1, dest: AudioNode = this.out): void {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (glide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * glide, at + length);
    this.decay(env, at, gain, length, attack);
    osc.connect(env).connect(dest);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  noiseHit(at: number, length: number, gain: number, type: BiquadFilterType, freq: number, q = 0.7, attack = 0.003): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = this.ctx.createGain();
    this.decay(env, at, gain, length, attack);
    source.connect(filter).connect(env).connect(this.out);
    source.start(at, Math.random() * 0.5);
    source.stop(at + length + 0.02);
  }

  // --- Plucked strings ----------------------------------------------------------------------

  private ring(note: number, name: PluckName): { buffer: AudioBuffer; rate: number } {
    const key = `${name}:${note}`;
    const cached = this.rings.get(key);
    if (cached) return cached;
    const preset: PluckPreset = PLUCKS[name];
    const sr = this.ctx.sampleRate;
    const freq = hz(note);
    // The two-point average weighs the newer sample by p; the loop is N + (1 - p) samples long.
    const p = 0.5 + 0.45 * preset.bright;
    const n = Math.max(2, Math.round(sr / freq - (1 - p)));
    const length = Math.floor(sr * preset.duration);
    const buffer = this.ctx.createBuffer(1, length, sr);
    const y = buffer.getChannelData(0);
    // Excitation: noise, low-passed for darker strings.
    const smooth = 1 - (0.15 + 0.85 * preset.bright);
    let last = 0;
    let mean = 0;
    for (let i = 0; i <= n && i < length; i++) {
      last = smooth * last + (1 - smooth) * (Math.random() * 2 - 1);
      y[i] = last;
      mean += last;
    }
    mean /= n + 1;
    for (let i = 0; i <= n && i < length; i++) y[i] -= mean;
    for (let i = n + 1; i < length; i++) y[i] = preset.damp * (p * y[i - n] + (1 - p) * y[i - n - 1]);
    // Fade the very end so a cut buffer never clicks.
    const fade = Math.min(length, Math.floor(sr * 0.05));
    for (let i = 0; i < fade; i++) y[length - 1 - i] *= i / fade;
    // The integer loop is a little off pitch; playback rate fixes it.
    const result = { buffer, rate: (freq * (n + 1 - p)) / sr };
    this.rings.set(key, result);
    return result;
  }

  // slideFrom: start this many semitones away and bend into the note (a sitar meend).
  // length: mute the string after this many seconds (strummed chords, staccato).
  pluck(name: PluckName, note: number, at: number, gain: number, length?: number, slideFrom = 0): void {
    const { buffer, rate } = this.ring(note, name);
    const preset: PluckPreset = PLUCKS[name];
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    if (slideFrom !== 0) {
      source.playbackRate.setValueAtTime(rate * Math.pow(2, slideFrom / 12), at);
      source.playbackRate.exponentialRampToValueAtTime(rate, at + 0.18);
    } else {
      source.playbackRate.value = rate;
    }
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    const end = at + (length ?? preset.duration / rate);
    if (length !== undefined) {
      env.gain.setValueAtTime(gain, end);
      env.gain.linearRampToValueAtTime(0, end + 0.06);
    }
    let node: AudioNode = source.connect(env);
    if (preset.peak) {
      const peak = this.ctx.createBiquadFilter();
      peak.type = 'peaking';
      peak.frequency.value = preset.peak.freq;
      peak.Q.value = preset.peak.q;
      peak.gain.value = preset.peak.gain;
      node = node.connect(peak);
    }
    node.connect(this.out);
    source.start(at);
    source.stop(end + 0.1);
  }

  // Fast repeated picking on one note, as on a mandolin, a saz or a ranat.
  tremolo(name: PluckName, note: number, at: number, length: number, gain: number): void {
    const step = 0.075;
    for (let t = 0, i = 0; t < length; t += step, i++) {
      this.pluck(name, note, at + t, gain * (i === 0 ? 1 : i % 2 === 0 ? 0.6 : 0.5), step * 1.6);
    }
  }

  strum(name: PluckName, notes: number[], at: number, gain: number, length?: number, down = true): void {
    const order = down ? notes : [...notes].reverse();
    order.forEach((note, i) => this.pluck(name, note, at + i * 0.014, gain, length));
  }

  // --- Keys, mallets and bells ---------------------------------------------------------------

  // Soft electric piano, the chords of the New York jazz café.
  epiano(notes: number[], at: number, length: number, gain: number): void {
    notes.forEach((note, i) => {
      const t = at + i * 0.012; // a slightly rolled chord sounds played by hand
      this.tone('sine', hz(note), t, length, gain, 0.01);
      this.tone('triangle', hz(note) * 2, t, length * 0.4, gain * 0.18);
    });
  }

  vibes(note: number, at: number, length: number, gain: number): void {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const trem = this.ctx.createOscillator();
    const tremDepth = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz(note);
    trem.frequency.value = 5.5;
    tremDepth.gain.value = gain * 0.28;
    trem.connect(tremDepth).connect(env.gain);
    this.decay(env, at, gain, length + 0.6, 0.01);
    osc.connect(env).connect(this.out);
    osc.start(at);
    trem.start(at);
    osc.stop(at + length + 0.7);
    trem.stop(at + length + 0.7);
  }

  // A wooden xylophone (the Thai ranat): bright strike, short ring.
  ranat(note: number, at: number, gain: number): void {
    this.tone('sine', hz(note), at, 0.45, gain);
    this.tone('triangle', hz(note) * 2, at, 0.12, gain * 0.35);
    this.tone('sine', hz(note) * 3.9, at, 0.05, gain * 0.25);
    this.noiseHit(at, 0.02, gain * 0.25, 'bandpass', 3000, 1.5);
  }

  // A tuned gong of a gong circle (khong wong): a round tone that rings.
  khong(note: number, at: number, gain: number): void {
    this.tone('sine', hz(note), at, 1.4, gain, 0.008);
    this.tone('sine', hz(note) * 2.02, at, 0.5, gain * 0.25, 0.008);
    this.tone('sine', hz(note) * 3.2, at, 0.15, gain * 0.1);
  }

  // --- Winds and reeds -----------------------------------------------------------------------

  // Musette accordion: three reeds, one in tune, one a little sharp, one a little flat.
  accordion(notes: number[], at: number, length: number, gain: number, bright = 2200): void {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = bright;
    filter.Q.value = 0.5;
    const env = this.ctx.createGain();
    this.hold(env, at, gain, length, 0.025, 0.08);
    filter.connect(env).connect(this.out);
    const end = at + length + 0.15;
    for (const note of notes) {
      for (const cents of [0, 14, -12]) {
        const osc = this.ctx.createOscillator();
        osc.type = cents === 0 ? 'sawtooth' : 'square';
        osc.frequency.value = hz(note) * Math.pow(2, cents / 1200);
        const level = this.ctx.createGain();
        level.gain.value = cents === 0 ? 0.5 : 0.25;
        osc.connect(level).connect(filter);
        osc.start(at);
        osc.stop(end);
      }
    }
  }

  // A breathy end-blown flute: the Egyptian ney (low, airy) or a bossa flute (cleaner).
  flute(note: number, at: number, length: number, gain: number, breath: number): void {
    const freq = hz(note);
    const env = this.ctx.createGain();
    this.hold(env, at, gain, length, 0.06, 0.12);
    env.connect(this.out);
    const end = at + length + 0.2;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    this.vibrato(osc.frequency, freq, at, end, 4.8, 0.006);
    const body = this.ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.value = freq * 2;
    const bodyLevel = this.ctx.createGain();
    bodyLevel.gain.value = 0.12;
    osc.connect(env);
    body.connect(bodyLevel).connect(env);
    osc.start(at);
    body.start(at);
    osc.stop(end);
    body.stop(end);
    // Air through the pipe: noise around the note, and a little chiff at the start.
    const air = this.ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = freq * 2;
    band.Q.value = 3;
    const airLevel = this.ctx.createGain();
    airLevel.gain.value = breath * 6;
    air.connect(band).connect(airLevel).connect(env);
    air.start(at, Math.random() * 0.5);
    air.stop(end);
    this.noiseHit(at, 0.08, gain * breath * 2, 'bandpass', freq * 4, 1);
  }

  // Mariachi trumpet: a brassy saw that opens up as the note speaks.
  trumpet(note: number, at: number, length: number, gain: number): void {
    const freq = hz(note);
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const end = at + length + 0.15;
    this.vibrato(osc.frequency, freq, at, end, 5.5, 0.005);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.5;
    filter.frequency.setValueAtTime(freq * 1.2, at);
    filter.frequency.exponentialRampToValueAtTime(Math.min(5500, freq * 7), at + 0.05);
    filter.frequency.exponentialRampToValueAtTime(Math.min(4000, freq * 4), at + 0.3);
    const env = this.ctx.createGain();
    this.hold(env, at, gain, length, 0.03, 0.08);
    osc.connect(filter).connect(env).connect(this.out);
    osc.start(at);
    osc.stop(end);
  }

  // --- Bass ----------------------------------------------------------------------------------

  upright(note: number, at: number, length: number): void {
    this.tone('triangle', hz(note), at, length, 0.22, 0.01);
    this.tone('sine', hz(note) * 2, at, length * 0.33, 0.05);
  }

  // --- Percussion ----------------------------------------------------------------------------

  drum(kind: DrumKind, at: number, gain: number): void {
    switch (kind) {
      case 'brush':
        this.noiseHit(at, gain > 0.5 ? 0.12 : 0.04, gain * 0.05, 'bandpass', 5000, 0.7, 0.008);
        break;
      case 'doum': // the deep centre stroke of a darbuka
        this.tone('sine', 95, at, 0.3, gain * 0.5, 0.004, 0.7);
        this.noiseHit(at, 0.04, gain * 0.05, 'lowpass', 600);
        break;
      case 'tek': // the sharp rim stroke
        this.tone('sine', 820, at, 0.05, gain * 0.12);
        this.noiseHit(at, 0.05, gain * 0.12, 'highpass', 3000);
        break;
      case 'riq': // a tambourine with jingles
        this.noiseHit(at, 0.14, gain * 0.07, 'bandpass', 7500, 2);
        this.tone('sine', 700, at, 0.04, gain * 0.08);
        break;
      case 'tablaNa': // the ringing treble drum
        this.tone('sine', hz(72), at, 0.35, gain * 0.16);
        this.tone('sine', hz(72) * 2.9, at, 0.06, gain * 0.05);
        this.noiseHit(at, 0.02, gain * 0.08, 'highpass', 4000);
        break;
      case 'tablaGe': // the bass drum, whose pitch is pushed up by the palm
        this.tone('sine', 75, at, 0.45, gain * 0.45, 0.006, 1.45);
        break;
      case 'rim': // bossa nova cross-stick
        this.tone('sine', 1700, at, 0.025, gain * 0.12);
        this.noiseHit(at, 0.03, gain * 0.08, 'bandpass', 2500, 2);
        break;
      case 'shaker':
        this.noiseHit(at, 0.07, gain * 0.035, 'highpass', 6000, 0.7, 0.02);
        break;
      case 'kick':
        this.tone('sine', 110, at, 0.22, gain * 0.35, 0.003, 0.45);
        break;
      case 'taiko':
        this.tone('sine', 72, at, 0.7, gain * 0.5, 0.004, 0.75);
        this.noiseHit(at, 0.12, gain * 0.07, 'lowpass', 400);
        break;
      case 'shime': // a small tight drum or wood block
        this.tone('sine', 980, at, 0.05, gain * 0.12);
        this.noiseHit(at, 0.03, gain * 0.06, 'bandpass', 2000, 2);
        break;
      case 'ching': // small Thai cymbals left to ring
        [1, 1.47, 2.09, 2.71].forEach((m, i) => this.tone('sine', 2400 * m, at, 0.9 - i * 0.15, gain * 0.025));
        break;
      case 'chap': // the same cymbals pressed together
        [1, 1.47, 2.09].forEach((m) => this.tone('sine', 2400 * m, at, 0.08, gain * 0.025));
        this.noiseHit(at, 0.05, gain * 0.03, 'highpass', 5000);
        break;
      case 'klong': // a low barrel drum
        this.tone('sine', 105, at, 0.35, gain * 0.4, 0.004, 0.8);
        break;
    }
  }
}

export type DrumKind =
  | 'brush'
  | 'doum'
  | 'tek'
  | 'riq'
  | 'tablaNa'
  | 'tablaGe'
  | 'rim'
  | 'shaker'
  | 'kick'
  | 'taiko'
  | 'shime'
  | 'ching'
  | 'chap'
  | 'klong';
