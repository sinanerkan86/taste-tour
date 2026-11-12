import { MusicPlayer } from './music/MusicPlayer';
import { settings } from './settings';

// All sound is synthesized with the Web Audio API: no audio files, nothing to license, tiny APK.
// Sound effects are short envelopes on oscillators; the music is one looping tune per city
// (src/game/music), played by a small sequencer.

export type Sfx = 'tap' | 'coin' | 'buy' | 'unlock' | 'celebrate' | 'click' | 'vip' | 'look' | 'firework';

const SFX_VOLUME = 0.45;
const MUSIC_VOLUME = 0.16;

// Equal temperament: MIDI note number to frequency.
const hz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private music: MusicPlayer | null = null;
  private song = 'istanbul';
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
      this.music = new MusicPlayer(this.ctx, this.musicBus);
      this.music.setSong(this.song);
      if (settings.music) this.music.start();
      document.addEventListener('visibilitychange', () => (document.hidden ? this.pause() : this.resume()));
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
  }

  // Each city has its own music; the switch fades over about half a second.
  setCity(id: string): void {
    this.song = id;
    this.music?.setSong(id);
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
  // A soft thump with a little crackle on top.
  firework: (v, t) => {
    v.tone('triangle', 170, t, 0.22, 0.4, 0.4);
    [0.05, 0.1, 0.16].forEach((at, i) => v.tone('square', 1900 + i * 500, t + at, 0.05, 0.035, 0.7));
  },
};

export const audio = new AudioEngine();

// Phaser handles input on its own frame loop, outside the browser's gesture event, so the
// context is also started straight from the DOM events.
['pointerdown', 'touchend', 'keydown'].forEach((type) => window.addEventListener(type, () => audio.unlock(), { capture: true }));
