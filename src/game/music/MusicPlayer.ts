import { DEFAULT_SONG, SONGS, type Song } from './songs';
import { Synth } from './synth';

const LOOKAHEAD = 0.25;
const FADE = 0.6;

// A small sequencer. A timer wakes up every 60 ms and schedules on the audio clock every bar that
// starts within the next quarter second, so timing stays exact even when the frame rate drops.
// Each song plays into its own gain node: switching cities fades the old one out (its ringing
// notes included) while the new one starts from its first bar.
export class MusicPlayer {
  private timer: number | null = null;
  private songId = DEFAULT_SONG;
  private song: Song = SONGS[DEFAULT_SONG];
  private synth: Synth | null = null;
  private output: GainNode | null = null;
  private nextBarTime = 0;
  private bar = 0;
  private loop = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly bus: AudioNode,
  ) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  get current(): string {
    return this.songId;
  }

  start(): void {
    if (this.timer !== null) return;
    this.open(this.ctx.currentTime + 0.3);
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.close();
  }

  // Unknown ids fall back to the first city's song.
  setSong(id: string): void {
    const next = SONGS[id] ? id : DEFAULT_SONG;
    if (next === this.songId) return;
    this.songId = next;
    this.song = SONGS[next];
    if (this.timer === null) return;
    this.close();
    this.open(this.ctx.currentTime + 0.15);
  }

  // Schedules `bars` bars from `at` without a timer, for rendering into an OfflineAudioContext.
  render(at: number, bars: number): void {
    this.open(at);
    for (let i = 0; i < bars; i++) this.scheduleBar();
  }

  private open(at: number): void {
    const output = this.ctx.createGain();
    output.gain.value = this.song.level;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.song.cutoff;
    output.connect(filter).connect(this.bus);
    this.output = output;
    this.synth = new Synth(this.ctx, output);
    this.nextBarTime = at;
    this.bar = 0;
    this.loop = 0;
  }

  private close(): void {
    const output = this.output;
    if (!output) return;
    const now = this.ctx.currentTime;
    output.gain.cancelScheduledValues(now);
    output.gain.setValueAtTime(output.gain.value, now);
    output.gain.linearRampToValueAtTime(0, now + FADE);
    window.setTimeout(() => output.disconnect(), (FADE + 4) * 1000);
    this.output = null;
    this.synth = null;
  }

  private get beat(): number {
    return 60 / this.song.bpm;
  }

  private schedule(): void {
    // While the context is suspended (app in background) time stands still, so nothing piles up.
    while (this.synth && this.nextBarTime < this.ctx.currentTime + LOOKAHEAD) this.scheduleBar();
  }

  private scheduleBar(): void {
    this.playBar(this.bar, this.nextBarTime);
    this.nextBarTime += this.beat * this.song.beatsPerBar;
    this.bar = (this.bar + 1) % this.song.chords.length;
    if (this.bar === 0) this.loop++;
  }

  private eighth(start: number, index: number): number {
    const beat = Math.floor(index / 2);
    return start + beat * this.beat + (index % 2 === 1 ? this.beat * this.song.swing : 0);
  }

  private playBar(bar: number, start: number): void {
    const synth = this.synth;
    if (!synth) return;
    const song = this.song;
    const odd = bar % 2 === 1;
    const chord = song.chords[bar];

    const comp = song.comp;
    const hits = odd && comp.oddHits ? comp.oddHits : comp.hits;
    hits.forEach(([at, gain], i) => {
      const t = this.eighth(start, at);
      const length = comp.length * this.beat;
      const notes = comp.arpeggio ? [chord.tones[i % chord.tones.length]] : chord.tones;
      switch (comp.voice) {
        case 'epiano':
          synth.epiano(notes, t, length, gain);
          break;
        case 'accordion':
          synth.accordion(notes, t, length, gain, 1600);
          break;
        case 'khong':
          notes.forEach((note) => synth.khong(note + 12, t, gain));
          break;
        default:
          synth.strum(comp.voice, notes, t, gain, comp.arpeggio ? undefined : length, i % 2 === 0);
      }
    });

    const bass = song.bass;
    if (bass) {
      const nextRoot = song.chords[(bar + 1) % song.chords.length].root;
      const bassHits = odd && bass.oddHits ? bass.oddHits : bass.hits;
      bassHits.forEach(([at, interval]) => {
        const note = interval === 'walk' ? (nextRoot > chord.root ? nextRoot - 1 : nextRoot + 1) : chord.root + interval;
        const t = this.eighth(start, at);
        if (bass.voice === 'upright') synth.upright(note, t, this.beat * 0.9);
        else synth.pluck('bass', note, t, 0.32, this.beat * 0.9);
      });
    }

    for (const drum of song.drums) {
      if (drum.bars === 'even' && odd) continue;
      if (drum.bars === 'odd' && !odd) continue;
      drum.hits.forEach(([at, gain]) => synth.drum(drum.kind, this.eighth(start, at), gain));
    }

    // The tune joins from the second time round, so a city opens softly.
    if (this.loop === 0) return;
    const lead = song.lead;
    for (const [b, at, note, beats, slide] of lead.tune) {
      if (b !== bar) continue;
      const t = this.eighth(start, at);
      const length = beats * this.beat;
      this.playLead(synth, note, t, length, slide ?? 0);
      if (lead.harmony) this.playLead(synth, thirdBelow(note, lead.harmony), t, length, 0, 0.7);
    }
  }

  private playLead(synth: Synth, note: number, at: number, length: number, slide: number, scale = 1): void {
    const lead = this.song.lead;
    const gain = lead.gain * scale;
    switch (lead.voice) {
      case 'vibes':
        synth.vibes(note, at, length, gain);
        break;
      case 'accordion':
        synth.accordion([note], at, length * 0.92, gain);
        break;
      case 'ney':
        synth.flute(note, at, length * 0.95, gain, 0.035);
        break;
      case 'flute':
        synth.flute(note + 12, at, length * 0.9, gain, 0.012);
        break;
      case 'trumpets':
        synth.trumpet(note, at, length * 0.85, gain);
        break;
      case 'ranat':
        if (lead.tremolo && length >= this.beat) {
          for (let t = 0, i = 0; t < length; t += 0.1, i++) synth.ranat(note, at + t, gain * (i === 0 ? 1 : 0.55));
        } else {
          synth.ranat(note, at, gain);
        }
        break;
      default:
        if (lead.tremolo && length >= this.beat) synth.tremolo(lead.voice, note, at, length, gain);
        else synth.pluck(lead.voice, note, at, gain, undefined, slide);
    }
  }
}

// The scale note two steps below (a third in the key), for a second voice in parallel thirds.
function thirdBelow(note: number, scale: number[]): number {
  let steps = 0;
  let n = note;
  while (steps < 2) {
    n--;
    if (scale.includes(((n % 12) + 12) % 12)) steps++;
  }
  return n;
}
