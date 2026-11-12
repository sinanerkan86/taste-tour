import type { DrumKind, PluckName } from './synth';

// One looping tune per city, written as data for the sequencer in MusicPlayer.ts.
// Times are in eighth notes inside a bar (0-7 in 4/4, 0-5 in 3/4 and 6/8), notes are MIDI numbers
// (60 = middle C), lengths are in beats. Every tune is original.

export interface Chord {
  root: number;
  tones: number[];
}

// [eighth, gain]
export type Hit = [number, number];

export type CompVoice = 'epiano' | 'accordion' | 'khong' | PluckName;
export type LeadVoice = 'vibes' | 'accordion' | 'ney' | 'flute' | 'trumpets' | 'ranat' | PluckName;

export interface Song {
  bpm: number;
  beatsPerBar: number;
  // Where the off-beat eighth lands inside the beat: 0.5 is straight, more is swung.
  swing: number;
  // Low-pass cutoff on the whole mix, which keeps the music warm and in the background.
  cutoff: number;
  // Loudness trim so every city plays at about the same level.
  level: number;
  chords: Chord[];
  comp: {
    voice: CompVoice;
    hits: Hit[];
    // Used on odd bars instead (two-bar patterns such as bossa nova).
    oddHits?: Hit[];
    // Note length in beats.
    length: number;
    // Play one chord tone per hit, in turn, instead of the whole chord.
    arpeggio?: boolean;
  };
  bass?: {
    voice: 'upright' | 'bass';
    // [eighth, interval above the root, or 'walk' for a step into the next chord]
    hits: [number, number | 'walk'][];
    oddHits?: [number, number | 'walk'][];
  };
  lead: {
    voice: LeadVoice;
    // [bar, eighth, note, beats, slide from (semitones, optional)]
    tune: [number, number, number, number, number?][];
    gain: number;
    // Long notes are picked in tremolo (mandolin, saz, ranat).
    tremolo?: boolean;
    // Pitch classes of the key: a second voice plays a third below in the scale (mariachi trumpets).
    harmony?: number[];
  };
  drums: { kind: DrumKind; hits: Hit[]; bars?: 'even' | 'odd' }[];
}

const chord = (root: number, ...tones: number[]): Chord => ({ root, tones });

// New York: a relaxed jazz café (the game's first music). Eight bars in F major with swing,
// electric piano, walking bass, brushes and a vibraphone tune.
const newYork: Song = {
  bpm: 84,
  beatsPerBar: 4,
  swing: 0.62,
  cutoff: 2600,
  level: 1,
  chords: [
    chord(41, 57, 60, 64, 69),
    chord(38, 57, 60, 62, 65),
    chord(43, 58, 62, 65, 69),
    chord(36, 58, 60, 64, 67),
    chord(41, 57, 60, 64, 69),
    chord(38, 57, 60, 62, 66),
    chord(43, 58, 62, 65, 69),
    chord(36, 58, 60, 64, 70),
  ],
  comp: { voice: 'epiano', hits: [[0, 0.07], [3, 0.05]], oddHits: [[0, 0.07], [3, 0.05], [7, 0.04]], length: 1.3 },
  bass: { voice: 'upright', hits: [[0, 0], [2, 7], [4, 12], [6, 'walk']] },
  lead: {
    voice: 'vibes',
    gain: 0.09,
    tune: [
      [0, 0, 72, 1.5], [0, 3, 74, 0.5], [0, 4, 76, 2],
      [1, 2, 74, 1], [1, 4, 72, 1], [1, 6, 69, 1],
      [2, 0, 70, 1.5], [2, 3, 72, 0.5], [2, 4, 74, 1], [2, 6, 77, 1],
      [3, 0, 76, 3],
      [4, 0, 81, 1.5], [4, 3, 79, 0.5], [4, 4, 76, 2],
      [5, 2, 78, 1], [5, 4, 74, 1.5],
      [6, 0, 77, 1], [6, 2, 76, 1], [6, 4, 74, 1], [6, 6, 70, 1],
      [7, 0, 72, 3],
    ],
  },
  drums: [{ kind: 'brush', hits: [[0, 0.36], [1, 0.36], [2, 1], [3, 0.36], [4, 0.36], [5, 0.36], [6, 1], [7, 0.36]] }],
};

// Istanbul: a bright saz over the Hicaz mode on A (the raised C# and the low Bb give it its colour),
// with a darbuka playing the maksum rhythm.
const istanbul: Song = {
  bpm: 92,
  beatsPerBar: 4,
  swing: 0.5,
  cutoff: 3600,
  level: 0.65,
  chords: [
    chord(45, 57, 61, 64),
    chord(45, 57, 61, 64),
    chord(43, 55, 58, 62),
    chord(45, 57, 61, 64),
    chord(38, 57, 62, 65),
    chord(43, 55, 58, 62),
    chord(45, 57, 61, 64),
    chord(45, 57, 61, 64),
  ],
  comp: { voice: 'oud', hits: [[0, 0.11], [3, 0.08], [6, 0.08]], length: 0.6 },
  bass: { voice: 'bass', hits: [[0, 0], [3, 0], [4, 7], [6, 0]] },
  lead: {
    voice: 'saz',
    gain: 0.14,
    tremolo: true,
    tune: [
      [0, 0, 76, 1], [0, 2, 77, 0.5], [0, 3, 76, 0.5], [0, 4, 73, 1], [0, 6, 70, 1],
      [1, 0, 69, 3],
      [2, 0, 74, 1], [2, 2, 76, 0.5], [2, 3, 77, 0.5], [2, 4, 79, 1], [2, 6, 77, 1],
      [3, 0, 76, 1.5], [3, 3, 73, 0.5], [3, 4, 76, 2],
      [4, 0, 81, 1], [4, 2, 79, 0.5], [4, 3, 77, 0.5], [4, 4, 76, 1], [4, 6, 77, 1],
      [5, 0, 79, 1], [5, 2, 77, 0.5], [5, 3, 76, 0.5], [5, 4, 74, 2],
      [6, 0, 76, 0.5], [6, 1, 77, 0.5], [6, 2, 76, 0.5], [6, 3, 74, 0.5], [6, 4, 73, 1], [6, 6, 70, 1],
      [7, 0, 69, 3],
    ],
  },
  drums: [
    { kind: 'doum', hits: [[0, 1], [4, 0.9]] },
    { kind: 'tek', hits: [[1, 0.8], [3, 0.9], [6, 0.9], [7, 0.4]] },
  ],
};

// Rome: a Neapolitan-style song in C major, mandolin tremolo over a guitar playing bass and chord.
const rome: Song = {
  bpm: 100,
  beatsPerBar: 4,
  swing: 0.5,
  cutoff: 3400,
  level: 1.04,
  chords: [
    chord(36, 60, 64, 67),
    chord(45, 57, 60, 64),
    chord(38, 57, 62, 65),
    chord(43, 55, 59, 62, 65),
    chord(36, 60, 64, 67),
    chord(40, 56, 59, 62, 64),
    chord(45, 57, 60, 64),
    chord(43, 55, 59, 62, 65),
  ],
  comp: { voice: 'guitar', hits: [[2, 0.09], [3, 0.05], [6, 0.09], [7, 0.05]], length: 0.4 },
  bass: { voice: 'bass', hits: [[0, 0], [4, 7]] },
  lead: {
    voice: 'mandolin',
    gain: 0.12,
    tremolo: true,
    tune: [
      [0, 0, 76, 1.5], [0, 3, 77, 0.5], [0, 4, 79, 2],
      [1, 0, 81, 1], [1, 2, 79, 1], [1, 4, 76, 2],
      [2, 0, 77, 1.5], [2, 3, 76, 0.5], [2, 4, 74, 1], [2, 6, 77, 1],
      [3, 0, 79, 3],
      [4, 0, 76, 1], [4, 2, 79, 1], [4, 4, 84, 2],
      [5, 0, 83, 1.5], [5, 3, 81, 0.5], [5, 4, 80, 2],
      [6, 0, 81, 1], [6, 2, 76, 1], [6, 4, 77, 1], [6, 6, 74, 1],
      [7, 0, 71, 1], [7, 2, 74, 1], [7, 4, 71, 2],
    ],
  },
  drums: [{ kind: 'shaker', hits: [[0, 0.6], [2, 1], [4, 0.6], [6, 1]] }],
};

// Paris: a musette waltz in A minor. Accordion tune, bass on one, accordion chords on two and three.
const paris: Song = {
  bpm: 150,
  beatsPerBar: 3,
  swing: 0.55,
  cutoff: 3000,
  level: 1.5,
  chords: [
    chord(45, 57, 60, 64), chord(45, 57, 60, 64), chord(38, 57, 62, 65), chord(38, 57, 62, 65),
    chord(40, 56, 59, 62, 64), chord(40, 56, 59, 62, 64), chord(45, 57, 60, 64), chord(45, 57, 60, 64),
    chord(45, 57, 60, 64), chord(45, 57, 60, 64), chord(38, 57, 62, 65), chord(38, 57, 62, 65),
    chord(40, 56, 59, 62, 64), chord(40, 56, 59, 62, 64), chord(40, 56, 59, 62, 64), chord(45, 57, 60, 64),
  ],
  comp: { voice: 'accordion', hits: [[2, 0.035], [4, 0.03]], length: 0.5 },
  bass: { voice: 'upright', hits: [[0, 0]], oddHits: [[0, -5]] },
  lead: {
    voice: 'accordion',
    gain: 0.06,
    tune: [
      [0, 0, 76, 2], [0, 4, 72, 1],
      [1, 0, 69, 1], [1, 2, 72, 1], [1, 4, 76, 1],
      [2, 0, 77, 2], [2, 4, 74, 1],
      [3, 0, 77, 1], [3, 2, 81, 1], [3, 4, 77, 1],
      [4, 0, 76, 2], [4, 4, 74, 1],
      [5, 0, 71, 1], [5, 2, 74, 1], [5, 4, 80, 1],
      [6, 0, 81, 3],
      [7, 0, 81, 1], [7, 2, 79, 0.5], [7, 3, 77, 0.5], [7, 4, 76, 1],
      [8, 0, 72, 1], [8, 2, 76, 1], [8, 4, 81, 1],
      [9, 0, 84, 2], [9, 4, 83, 1],
      [10, 0, 81, 1], [10, 2, 77, 1], [10, 4, 74, 1],
      [11, 0, 77, 1], [11, 2, 76, 1], [11, 4, 74, 1],
      [12, 0, 76, 1], [12, 2, 80, 1], [12, 4, 83, 1],
      [13, 0, 86, 2], [13, 4, 83, 1],
      [14, 0, 80, 1], [14, 2, 76, 1], [14, 4, 71, 1],
      [15, 0, 69, 3],
    ],
  },
  drums: [{ kind: 'brush', hits: [[2, 0.36], [4, 0.36]] }],
};

// Cairo: a slow, airy ney in D minor (Nahawand) with oud and riq on the baladi rhythm.
const cairo: Song = {
  bpm: 88,
  beatsPerBar: 4,
  swing: 0.5,
  cutoff: 3000,
  level: 0.47,
  chords: [
    chord(38, 57, 62, 65),
    chord(38, 57, 62, 65),
    chord(43, 55, 58, 62),
    chord(45, 55, 57, 61, 64),
    chord(38, 57, 62, 65),
    chord(36, 55, 60, 64),
    chord(46, 58, 62, 65),
    chord(45, 55, 57, 61, 64),
  ],
  comp: { voice: 'oud', hits: [[0, 0.1], [4, 0.08], [6, 0.05]], length: 0.9 },
  bass: { voice: 'bass', hits: [[0, 0], [1, 0], [4, 0]] },
  lead: {
    voice: 'ney',
    gain: 0.11,
    tune: [
      [0, 0, 69, 2], [0, 4, 70, 1], [0, 6, 69, 1],
      [1, 0, 67, 1], [1, 2, 65, 1], [1, 4, 64, 1], [1, 6, 65, 1],
      [2, 0, 67, 3], [2, 6, 70, 1],
      [3, 0, 69, 2], [3, 4, 73, 2],
      [4, 0, 74, 2], [4, 4, 72, 1], [4, 6, 70, 1],
      [5, 0, 72, 1], [5, 2, 70, 1], [5, 4, 69, 2],
      [6, 0, 70, 1], [6, 2, 69, 1], [6, 4, 67, 1], [6, 6, 65, 1],
      [7, 0, 64, 1], [7, 2, 61, 1], [7, 4, 69, 2],
    ],
  },
  drums: [
    { kind: 'doum', hits: [[0, 1], [1, 0.8], [4, 0.9]] },
    { kind: 'tek', hits: [[3, 0.7], [6, 0.7]] },
    { kind: 'riq', hits: [[2, 0.6], [3, 1], [5, 0.5], [6, 1], [7, 0.6]] },
  ],
};

// Mumbai: a sitar over a tanpura drone on C, in a Khamaj-like scale (major with a flat seventh),
// with tabla. One chord all the way: the drone is the harmony.
const mumbai: Song = {
  bpm: 76,
  beatsPerBar: 4,
  swing: 0.5,
  cutoff: 4000,
  level: 1.19,
  chords: Array.from({ length: 8 }, () => chord(36, 55, 60, 60, 48)),
  comp: { voice: 'tanpura', hits: [[0, 0.07], [2, 0.06], [4, 0.06], [6, 0.08]], length: 2.5, arpeggio: true },
  lead: {
    voice: 'sitar',
    gain: 0.13,
    tune: [
      [0, 0, 72, 1, -2], [0, 2, 74, 0.5], [0, 3, 76, 0.5], [0, 4, 77, 1], [0, 6, 76, 1],
      [1, 0, 74, 1], [1, 2, 72, 1], [1, 4, 70, 2],
      [2, 0, 67, 1.5], [2, 3, 69, 0.5], [2, 4, 70, 1], [2, 6, 72, 1],
      [3, 0, 72, 3, -3],
      [4, 0, 79, 1, -2], [4, 2, 77, 0.5], [4, 3, 76, 0.5], [4, 4, 77, 1], [4, 6, 79, 1],
      [5, 0, 81, 1.5], [5, 3, 79, 0.5], [5, 4, 77, 1], [5, 6, 76, 1],
      [6, 0, 74, 1], [6, 2, 76, 0.5], [6, 3, 74, 0.5], [6, 4, 72, 1], [6, 6, 70, 1],
      [7, 0, 72, 3, 2],
    ],
  },
  drums: [
    { kind: 'tablaGe', hits: [[0, 1], [3, 0.6], [4, 0.7]] },
    { kind: 'tablaNa', hits: [[0, 0.8], [1, 0.6], [2, 0.8], [5, 0.6], [6, 0.9], [7, 0.5]] },
  ],
};

// Bangkok: a running ranat (xylophone) tune on the five-note scale, a gong circle answering,
// small ching cymbals keeping time and a low klong drum.
const bangkok: Song = {
  bpm: 104,
  beatsPerBar: 4,
  swing: 0.5,
  cutoff: 4200,
  level: 0.97,
  chords: [
    chord(36, 60, 64, 67),
    chord(45, 57, 60, 64),
    chord(43, 55, 59, 62),
    chord(36, 60, 64, 67),
    chord(36, 60, 64, 67),
    chord(45, 57, 60, 64),
    chord(38, 57, 62, 69),
    chord(43, 55, 59, 62),
  ],
  comp: { voice: 'khong', hits: [[0, 0.08], [2, 0.06], [4, 0.07], [6, 0.06]], length: 1, arpeggio: true },
  lead: {
    voice: 'ranat',
    gain: 0.12,
    tremolo: true,
    tune: [
      [0, 0, 72, 0.5], [0, 1, 74, 0.5], [0, 2, 76, 0.5], [0, 3, 79, 0.5], [0, 4, 76, 1], [0, 6, 74, 1],
      [1, 0, 72, 0.5], [1, 1, 69, 0.5], [1, 2, 67, 0.5], [1, 3, 69, 0.5], [1, 4, 72, 2],
      [2, 0, 74, 0.5], [2, 1, 76, 0.5], [2, 2, 79, 0.5], [2, 3, 81, 0.5], [2, 4, 79, 1], [2, 6, 76, 1],
      [3, 0, 79, 1], [3, 2, 76, 1], [3, 4, 72, 2],
      [4, 0, 84, 0.5], [4, 1, 81, 0.5], [4, 2, 79, 0.5], [4, 3, 81, 0.5], [4, 4, 84, 1], [4, 6, 86, 1],
      [5, 0, 88, 1], [5, 2, 86, 0.5], [5, 3, 84, 0.5], [5, 4, 81, 2],
      [6, 0, 79, 0.5], [6, 1, 81, 0.5], [6, 2, 79, 0.5], [6, 3, 76, 0.5], [6, 4, 74, 1], [6, 6, 76, 1],
      [7, 0, 74, 0.5], [7, 1, 72, 0.5], [7, 2, 69, 0.5], [7, 3, 72, 0.5], [7, 4, 74, 2],
    ],
  },
  drums: [
    { kind: 'ching', hits: [[2, 1]] },
    { kind: 'chap', hits: [[6, 1]] },
    { kind: 'klong', hits: [[0, 1], [5, 0.5], [6, 0.7]] },
  ],
};

// Tokyo: koto in the Miyako-bushi scale (E F A B C), taiko and a small shime drum, unhurried.
const tokyo: Song = {
  bpm: 76,
  beatsPerBar: 4,
  swing: 0.5,
  cutoff: 3800,
  level: 1.04,
  chords: [
    chord(40, 52, 57, 59),
    chord(41, 53, 57, 60),
    chord(45, 57, 59, 64),
    chord(40, 52, 57, 59),
    chord(41, 53, 57, 60),
    chord(45, 57, 59, 64),
    chord(41, 53, 57, 60),
    chord(40, 52, 59, 64),
  ],
  comp: { voice: 'koto', hits: [[0, 0.07], [1, 0.05], [2, 0.05], [4, 0.06], [5, 0.04], [6, 0.05]], length: 1.5, arpeggio: true },
  bass: { voice: 'bass', hits: [[0, 0], [4, 7]] },
  lead: {
    voice: 'koto',
    gain: 0.15,
    tune: [
      [0, 0, 76, 1], [0, 2, 77, 0.5], [0, 3, 76, 0.5], [0, 4, 71, 2],
      [1, 0, 72, 1], [1, 2, 71, 1], [1, 4, 69, 2],
      [2, 0, 71, 1.5], [2, 3, 72, 0.5], [2, 4, 76, 2, -1],
      [3, 0, 77, 0.5], [3, 1, 76, 0.5], [3, 2, 71, 1], [3, 4, 76, 2],
      [4, 0, 81, 1.5], [4, 3, 77, 0.5], [4, 4, 76, 1], [4, 6, 77, 1],
      [5, 0, 76, 1], [5, 2, 72, 1], [5, 4, 71, 2],
      [6, 0, 69, 1], [6, 2, 71, 0.5], [6, 3, 72, 0.5], [6, 4, 71, 1], [6, 6, 65, 1],
      [7, 0, 64, 3, -1],
    ],
  },
  drums: [
    { kind: 'taiko', hits: [[0, 1], [3, 0.4], [4, 0.6]] },
    { kind: 'shime', hits: [[2, 0.8], [6, 0.8], [7, 0.4]] },
  ],
};

// Rio: bossa nova in C with a nylon guitar on a two-bar syncopated pattern, cross-stick, shaker
// and a soft flute.
const rio: Song = {
  bpm: 120,
  beatsPerBar: 4,
  swing: 0.5,
  cutoff: 3000,
  level: 0.5,
  chords: [
    chord(36, 52, 55, 59, 62),
    chord(36, 52, 55, 59, 62),
    chord(38, 53, 57, 60, 64),
    chord(43, 53, 59, 62, 64),
    chord(40, 50, 55, 59, 62),
    chord(45, 55, 61, 64, 66),
    chord(38, 53, 57, 60, 64),
    chord(43, 53, 56, 59, 62),
  ],
  comp: { voice: 'nylon', hits: [[0, 0.07], [3, 0.07], [6, 0.06]], oddHits: [[2, 0.07], [5, 0.07]], length: 0.6 },
  bass: { voice: 'bass', hits: [[0, 0], [3, 7], [4, 0], [7, 7]] },
  lead: {
    voice: 'flute',
    gain: 0.09,
    tune: [
      [0, 1, 76, 0.5], [0, 2, 79, 1], [0, 4, 76, 0.5], [0, 5, 74, 1.5],
      [1, 0, 76, 2], [1, 5, 72, 0.5], [1, 6, 74, 1],
      [2, 0, 77, 1], [2, 2, 76, 0.5], [2, 3, 74, 1], [2, 5, 72, 1.5],
      [3, 0, 71, 1], [3, 2, 74, 1], [3, 4, 77, 2],
      [4, 1, 79, 0.5], [4, 2, 83, 1], [4, 4, 79, 0.5], [4, 5, 81, 1.5],
      [5, 0, 79, 1.5], [5, 3, 76, 0.5], [5, 4, 73, 2],
      [6, 0, 74, 1], [6, 2, 77, 1], [6, 4, 81, 0.5], [6, 5, 79, 1.5],
      [7, 0, 77, 1], [7, 2, 74, 1], [7, 4, 71, 2],
    ],
  },
  drums: [
    { kind: 'rim', hits: [[0, 1], [3, 1], [6, 1]], bars: 'even' },
    { kind: 'rim', hits: [[2, 1], [5, 1]], bars: 'odd' },
    { kind: 'shaker', hits: [[0, 1], [1, 0.5], [2, 0.8], [3, 0.5], [4, 1], [5, 0.5], [6, 0.8], [7, 0.5]] },
    { kind: 'kick', hits: [[0, 0.6], [3, 0.4], [4, 0.6], [7, 0.4]] },
  ],
};

// Mexico City: a mariachi son in 6/8 in D major. Two trumpets in thirds, a bright vihuela strumming
// every eighth and a guitarrón bass; odd bars switch to the 3/4 feel (the sesquialtera).
const mexicoCity: Song = {
  bpm: 180,
  beatsPerBar: 3,
  swing: 0.5,
  cutoff: 3600,
  level: 0.8,
  chords: [
    chord(38, 62, 66, 69), chord(38, 62, 66, 69), chord(45, 61, 64, 67), chord(45, 61, 64, 67),
    chord(45, 61, 64, 67), chord(45, 61, 64, 67), chord(38, 62, 66, 69), chord(38, 62, 66, 69),
    chord(43, 62, 67, 71), chord(43, 62, 67, 71), chord(38, 62, 66, 69), chord(38, 62, 66, 69),
    chord(45, 61, 64, 67), chord(45, 61, 64, 67), chord(38, 62, 66, 69), chord(38, 62, 66, 69),
  ],
  comp: {
    voice: 'vihuela',
    hits: [[0, 0.07], [1, 0.035], [2, 0.035], [3, 0.07], [4, 0.035], [5, 0.035]],
    oddHits: [[0, 0.07], [1, 0.03], [2, 0.06], [3, 0.03], [4, 0.06], [5, 0.03]],
    length: 0.25,
  },
  bass: { voice: 'bass', hits: [[0, 0], [3, 7]], oddHits: [[0, 0], [2, 7], [4, 12]] },
  lead: {
    voice: 'trumpets',
    gain: 0.045,
    harmony: [2, 4, 6, 7, 9, 11, 1],
    tune: [
      [0, 0, 74, 1], [0, 2, 76, 0.5], [0, 3, 78, 1.5],
      [1, 0, 81, 1.5], [1, 3, 78, 1.5],
      [2, 0, 79, 1], [2, 2, 78, 0.5], [2, 3, 76, 1.5],
      [3, 0, 73, 1], [3, 2, 76, 1], [3, 4, 79, 1],
      [4, 0, 81, 1.5], [4, 3, 79, 1.5],
      [5, 0, 76, 1], [5, 2, 73, 1], [5, 4, 76, 1],
      [6, 0, 78, 1], [6, 2, 76, 0.5], [6, 3, 74, 1.5],
      [7, 0, 74, 2],
      [8, 0, 83, 1], [8, 2, 81, 0.5], [8, 3, 79, 1.5],
      [9, 0, 79, 1], [9, 2, 81, 1], [9, 4, 83, 1],
      [10, 0, 81, 1.5], [10, 3, 78, 1.5],
      [11, 0, 74, 1], [11, 2, 78, 1], [11, 4, 81, 1],
      [12, 0, 79, 1.5], [12, 3, 76, 1.5],
      [13, 0, 73, 1], [13, 2, 76, 1], [13, 4, 79, 1],
      [14, 0, 78, 1.5], [14, 3, 76, 1.5],
      [15, 0, 74, 2],
    ],
  },
  drums: [],
};

export const SONGS: Record<string, Song> = { istanbul, rome, paris, cairo, mumbai, bangkok, tokyo, rio, mexicoCity, newYork };

export const DEFAULT_SONG = 'istanbul';
