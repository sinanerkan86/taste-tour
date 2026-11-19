// Recorded city music: five tracks per city (public/music/<cityId>-<n>.ogg, credits in docs/music-credits.md),
// played in a shuffled order. Tracks stream through HTMLAudioElement (never decoded whole: phones have little
// memory) into the music bus of the audio graph. Each track has a 2.5 s fade in and a 3 s fade out baked in, so
// starting the next one when the current one has 3 s left is already a cross-fade. Only the current city's
// tracks are loaded: the next track is preloaded shortly before the current one ends.

export const TRACKS_PER_CITY = 5;
export const DEFAULT_CITY = 'istanbul';

const CROSSFADE = 3;
const PRELOAD_AT = 20;
const CITY_FADE = 0.8;
const TICK_MS = 250;

export const trackUrl = (city: string, index: number): string => `${import.meta.env.BASE_URL}music/${city}-${index + 1}.ogg`;

interface Deck {
  city: string;
  index: number;
  el: HTMLAudioElement;
  gain: GainNode;
  started: boolean;
}

export class MusicPlayer {
  private city = DEFAULT_CITY;
  private order: number[] = [];
  private pos = -1;
  private last = -1;
  private active: Deck | null = null;
  private preloaded: Deck | null = null;
  private fading = new Set<Deck>();
  private timer: number | null = null;
  private paused = false;
  onChange: (() => void) | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly bus: AudioNode,
  ) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  get currentCity(): string {
    return this.city;
  }

  // The track now playing (0-based), or -1.
  get currentTrack(): number {
    return this.active?.index ?? -1;
  }

  get currentTime(): number {
    return this.active?.el.currentTime ?? 0;
  }

  get element(): HTMLAudioElement | null {
    return this.active?.el ?? null;
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    if (!this.active) this.next(CITY_FADE);
    else this.resume();
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.fadeOut(this.active, CITY_FADE);
    this.active = null;
    this.drop(this.preloaded);
    this.preloaded = null;
  }

  // Pauses every element while the app is in the background (the audio context is suspended too).
  pause(): void {
    this.paused = true;
    for (const deck of this.decks()) deck.el.pause();
  }

  resume(): void {
    this.paused = false;
    if (this.timer === null) return;
    for (const deck of this.decks()) if (deck.started) void deck.el.play().catch(() => undefined);
  }

  // Each city has its own tracks; the old one fades out while the new city's first track fades in.
  setCity(id: string): void {
    if (id === this.city && this.order.length > 0) return;
    this.city = id;
    this.order = [];
    this.pos = -1;
    this.last = -1;
    this.drop(this.preloaded);
    this.preloaded = null;
    if (this.timer === null) return;
    this.fadeOut(this.active, CITY_FADE);
    this.active = null;
    this.next(CITY_FADE);
  }

  // Plays one particular track of the current city (preview page), then goes on in shuffled order.
  playTrack(index: number): void {
    this.drop(this.preloaded);
    this.preloaded = null;
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.fadeOut(this.active, CITY_FADE);
    this.active = null;
    if (this.order.length === 0) this.reshuffle();
    this.begin(this.deck(index), CITY_FADE);
  }

  // Starts a fresh shuffle of the current city.
  shuffle(): void {
    this.order = [];
    this.pos = -1;
    this.last = -1;
    this.drop(this.preloaded);
    this.preloaded = null;
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.fadeOut(this.active, CITY_FADE);
    this.active = null;
    this.next(CITY_FADE);
  }

  // Shuffled order of the five tracks; the first one never equals the last one played.
  private reshuffle(): void {
    const order = Array.from({ length: TRACKS_PER_CITY }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order[0] === this.last) {
      const j = 1 + Math.floor(Math.random() * (order.length - 1));
      [order[0], order[j]] = [order[j], order[0]];
    }
    this.order = order;
    this.pos = -1;
  }

  // Index of the track after the current one, without consuming it.
  private peek(): number {
    if (this.pos + 1 >= this.order.length) this.reshuffle();
    return this.order[this.pos + 1];
  }

  private deck(index: number): Deck {
    if (this.preloaded && this.preloaded.city === this.city && this.preloaded.index === index) {
      const deck = this.preloaded;
      this.preloaded = null;
      return deck;
    }
    const el = new Audio(trackUrl(this.city, index));
    el.preload = 'auto';
    const gain = this.ctx.createGain();
    this.ctx.createMediaElementSource(el).connect(gain).connect(this.bus);
    return { city: this.city, index, el, gain, started: false };
  }

  private begin(deck: Deck, fadeIn: number): void {
    const now = this.ctx.currentTime;
    deck.gain.gain.cancelScheduledValues(now);
    deck.gain.gain.setValueAtTime(fadeIn > 0 ? 0 : 1, now);
    if (fadeIn > 0) deck.gain.gain.linearRampToValueAtTime(1, now + fadeIn);
    deck.started = true;
    this.active = deck;
    this.last = deck.index;
    const pos = this.order.indexOf(deck.index);
    if (pos >= 0) this.pos = pos;
    if (!this.paused) void deck.el.play().catch(() => undefined);
    this.onChange?.();
  }

  // Moves on to the next shuffled track. The previous track keeps playing its baked-in fade out.
  private next(fadeIn = 0): void {
    const index = this.peek();
    this.pos++;
    const previous = this.active;
    if (previous) this.fading.add(previous);
    this.begin(this.deck(index), fadeIn);
    if (previous) this.retire(previous);
  }

  // The old track plays out its own baked-in fade out, then is released.
  private retire(deck: Deck): void {
    const left = Number.isFinite(deck.el.duration) ? Math.max(0, deck.el.duration - deck.el.currentTime) : 0;
    this.fading.add(deck);
    window.setTimeout(() => {
      this.fading.delete(deck);
      this.drop(deck);
    }, (left + 0.5) * 1000);
  }

  private fadeOut(deck: Deck | null, seconds: number): void {
    if (!deck) return;
    this.fading.add(deck);
    const now = this.ctx.currentTime;
    deck.gain.gain.cancelScheduledValues(now);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, now);
    deck.gain.gain.linearRampToValueAtTime(0, now + seconds);
    window.setTimeout(() => {
      this.fading.delete(deck);
      this.drop(deck);
    }, seconds * 1000 + 200);
  }

  private drop(deck: Deck | null): void {
    if (!deck) return;
    deck.el.pause();
    deck.el.removeAttribute('src');
    deck.el.load();
    try {
      deck.gain.disconnect();
    } catch {
      // Already disconnected.
    }
  }

  private decks(): Deck[] {
    return [this.active, this.preloaded, ...this.fading].filter((d): d is Deck => d !== null);
  }

  private tick(): void {
    const deck = this.active;
    if (!deck || this.paused) return;
    const { duration, currentTime } = deck.el;
    if (!Number.isFinite(duration) || duration <= 0) {
      if (deck.el.error) this.next(); // A file that cannot load is skipped.
      return;
    }
    const left = duration - currentTime;
    if (left <= PRELOAD_AT && !this.preloaded) {
      const index = this.peek();
      this.preloaded = this.deck(index);
      // deck() consumed nothing: keep it as preloaded.
    }
    if (left <= CROSSFADE || deck.el.ended) this.next();
  }
}
