import { settings } from './settings';

// All sound is synthesized with the Web Audio API: no audio files, nothing to license, tiny APK.
// Sound effects are short envelopes on oscillators; the music is a small sequencer that plays a
// relaxed café loop (electric piano chords, upright-style bass, brushes and a vibraphone tune).

export type Sfx = 'tap' | 'coin' | 'buy' | 'unlock' | 'celebrate' | 'click' | 'vip' | 'look';

const SFX_VOLUME = 0.45;
const MUSIC_VOLUME = 0.16;

// Equal temperament: MIDI note number to frequency.
const hz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private music: CafeMusic | null = null;
  private lastPlayed = new Map<Sfx, number>();

  // Browsers only allow audio after a user gesture, so the context starts on the first tap.
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = settings.sound ? SFX_VOLUME : 0;
      this.sfxBus.connect(compressor);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = settings.music ? MUSIC_VOLUME : 0;
      this.musicBus.connect(compressor);
      this.music = new CafeMusic(this.ctx, this.musicBus);
      if (settings.music) this.music.start();
      document.addEventListener('visibilitychange', () => (document.hidden ? this.pause() : this.resume()));
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
  }

  pause(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  applySettings(): void {
    if (!this.ctx || !this.sfxBus || !this.musicBus || !this.music) return;
    const now = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(settings.sound ? SFX_VOLUME : 0, now, 0.05);
    this.musicBus.gain.setTargetAtTime(settings.music ? MUSIC_VOLUME : 0, now, 0.3);
    if (settings.music) this.music.start();
    else this.music.stop();
  }

  play(name: Sfx, volume = 1): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !settings.sound || ctx.state !== 'running') return;
    // The same sound at most every 60 ms, so bursts never turn into noise.
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < 0.06) return;
    this.lastPlayed.set(name, now);
    SFX[name](new Voice(ctx, bus, volume), now);
  }
}

// Helper that plays notes into a bus.
class Voice {
  constructor(
    readonly ctx: AudioContext,
    private readonly bus: AudioNode,
    private readonly volume: number,
  ) {}

  // One enveloped oscillator note. glide: frequency multiplier reached at the end.
  tone(type: OscillatorType, freq: number, at: number, length: number, gain: number, glide = 1, attack = 0.005): void {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (glide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * glide, at + length);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain * this.volume, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(env).connect(this.bus);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  // A soft mallet: a sine with a quieter overtone, like a marimba or glockenspiel.
  mallet(note: number, at: number, length = 0.5, gain = 0.3): void {
    this.tone('sine', hz(note), at, length, gain);
    this.tone('sine', hz(note) * 4, at, length * 0.25, gain * 0.15);
  }

  // A bell: inharmonic partials ring out.
  bell(note: number, at: number, gain = 0.25): void {
    this.tone('sine', hz(note), at, 1.2, gain);
    this.tone('sine', hz(note) * 2.76, at, 0.5, gain * 0.3);
    this.tone('sine', hz(note) * 5.4, at, 0.25, gain * 0.12);
  }
}

const SFX: Record<Sfx, (v: Voice, t: number) => void> = {
  tap: (v, t) => v.tone('sine', 520, t, 0.09, 0.35, 1.7),
  coin: (v, t) => {
    v.tone('square', hz(88), t, 0.07, 0.05);
    v.tone('sine', hz(88), t, 0.08, 0.25);
    v.tone('sine', hz(93), t + 0.07, 0.22, 0.25);
  },
  click: (v, t) => v.tone('triangle', 1100, t, 0.04, 0.2, 0.8),
  buy: (v, t) => {
    v.tone('sine', 380, t, 0.08, 0.3, 1.8);
    v.mallet(84, t + 0.05, 0.25, 0.2);
    v.mallet(88, t + 0.11, 0.35, 0.2);
  },
  unlock: (v, t) => [72, 76, 79, 84, 88].forEach((n, i) => v.mallet(n, t + i * 0.09, 0.6, 0.28)),
  celebrate: (v, t) => {
    [60, 64, 67, 72].forEach((n) => v.tone('triangle', hz(n), t, 1.4, 0.08, 1, 0.02));
    [72, 76, 79, 84, 88, 91].forEach((n, i) => v.mallet(n, t + 0.05 + i * 0.07, 0.7, 0.2));
  },
  vip: (v, t) => {
    v.bell(79, t);
    v.bell(86, t + 0.18);
  },
  look: (v, t) => [84, 88, 91, 96, 100].forEach((n, i) => v.mallet(n, t + i * 0.06, 0.5, 0.15)),
};

// --- Music -------------------------------------------------------------------------------

const BPM = 84;
const BEAT = 60 / BPM;
const SWING = 0.62; // the off-beat eighth lands late, which gives the lazy café feel
const LOOKAHEAD = 0.25;

// Eight bars in F major: Fmaj7 Dm7 Gm7 C7 | Fmaj7 D7 Gm7 C7. Notes as MIDI numbers.
const CHORDS: { root: number; tones: number[] }[] = [
  { root: 41, tones: [57, 60, 64, 69] },
  { root: 38, tones: [57, 60, 62, 65] },
  { root: 43, tones: [58, 62, 65, 69] },
  { root: 36, tones: [58, 60, 64, 67] },
  { root: 41, tones: [57, 60, 64, 69] },
  { root: 38, tones: [57, 60, 62, 66] },
  { root: 43, tones: [58, 62, 65, 69] },
  { root: 36, tones: [58, 60, 64, 70] },
];
// Vibraphone tune: [bar, beat (in eighths), note, length in beats]. Rests leave room to breathe.
const TUNE: [number, number, number, number][] = [
  [0, 0, 72, 1.5], [0, 3, 74, 0.5], [0, 4, 76, 2],
  [1, 2, 74, 1], [1, 4, 72, 1], [1, 6, 69, 1],
  [2, 0, 70, 1.5], [2, 3, 72, 0.5], [2, 4, 74, 1], [2, 6, 77, 1],
  [3, 0, 76, 3],
  [4, 0, 81, 1.5], [4, 3, 79, 0.5], [4, 4, 76, 2],
  [5, 2, 78, 1], [5, 4, 74, 1.5],
  [6, 0, 77, 1], [6, 2, 76, 1], [6, 4, 74, 1], [6, 6, 70, 1],
  [7, 0, 72, 3],
];

class CafeMusic {
  private timer: number | null = null;
  private nextBarTime = 0;
  private bar = 0;
  private loop = 0;
  private readonly noise: AudioBuffer;
  private readonly tone: BiquadFilterNode;

  constructor(
    private readonly ctx: AudioContext,
    bus: AudioNode,
  ) {
    // A gentle low-pass on everything keeps it warm and in the background.
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 2600;
    this.tone.connect(bus);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  start(): void {
    if (this.timer !== null) return;
    this.nextBarTime = this.ctx.currentTime + 0.3;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    // While the context is suspended (app in background) time stands still, so nothing piles up.
    while (this.nextBarTime < this.ctx.currentTime + LOOKAHEAD) {
      this.playBar(this.bar, this.nextBarTime);
      this.nextBarTime += BEAT * 4;
      this.bar = (this.bar + 1) % CHORDS.length;
      if (this.bar === 0) this.loop++;
    }
  }

  private eighth(start: number, index: number): number {
    const beat = Math.floor(index / 2);
    return start + beat * BEAT + (index % 2 === 1 ? BEAT * SWING : 0);
  }

  private playBar(bar: number, start: number): void {
    const chord = CHORDS[bar];
    // Piano comping: on 1 and the "and" of 2, sometimes a push on 4.
    this.piano(chord.tones, start, BEAT * 1.4, 0.07);
    this.piano(chord.tones, this.eighth(start, 3), BEAT * 1.2, 0.05);
    if (bar % 2 === 1) this.piano(chord.tones.slice(1), this.eighth(start, 7), BEAT * 0.8, 0.04);
    // Bass: root, fifth, and a walking step into the next chord.
    const next = CHORDS[(bar + 1) % CHORDS.length].root;
    const walk = next > chord.root ? next - 1 : next + 1;
    [chord.root, chord.root + 7, chord.root + 12, walk].forEach((note, beat) => this.bass(note, start + beat * BEAT));
    // Brushes: swish on 2 and 4, light ticks on the swung eighths.
    for (let i = 0; i < 8; i++) {
      const accent = i === 2 || i === 6;
      this.brush(this.eighth(start, i), accent ? 0.05 : 0.018, accent ? 0.12 : 0.04);
    }
    // The tune joins from the second time round, so the game opens softly.
    if (this.loop > 0) {
      TUNE.filter(([b]) => b === bar).forEach(([, at, note, length]) => this.vibes(note, this.eighth(start, at), length * BEAT));
    }
  }

  private piano(notes: number[], at: number, length: number, gain: number): void {
    notes.forEach((note, i) => {
      const t = at + i * 0.012; // a slightly rolled chord sounds played by hand
      this.osc('sine', hz(note), t, length, gain, 0.01);
      this.osc('triangle', hz(note) * 2, t, length * 0.4, gain * 0.18, 0.005);
    });
  }

  private bass(note: number, at: number): void {
    this.osc('triangle', hz(note), at, BEAT * 0.9, 0.22, 0.01);
    this.osc('sine', hz(note) * 2, at, BEAT * 0.3, 0.05, 0.005);
  }

  private vibes(note: number, at: number, length: number): void {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const trem = this.ctx.createOscillator();
    const tremDepth = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz(note);
    trem.frequency.value = 5.5;
    tremDepth.gain.value = 0.025;
    trem.connect(tremDepth).connect(env.gain);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.09, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length + 0.6);
    osc.connect(env).connect(this.tone);
    osc.start(at);
    trem.start(at);
    osc.stop(at + length + 0.7);
    trem.stop(at + length + 0.7);
  }

  private brush(at: number, gain: number, length: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 5000;
    filter.Q.value = 0.7;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(env).connect(this.tone);
    source.start(at, Math.random() * 0.3);
    source.stop(at + length + 0.02);
  }

  private osc(type: OscillatorType, freq: number, at: number, length: number, gain: number, attack: number): void {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(env).connect(this.tone);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

export const audio = new AudioEngine();

// Phaser handles input on its own frame loop, outside the browser's gesture event, so the
// context is also started straight from the DOM events.
['pointerdown', 'touchend', 'keydown'].forEach((type) => window.addEventListener(type, () => audio.unlock(), { capture: true }));
