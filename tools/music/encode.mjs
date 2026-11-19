// Encodes the city music: node tools/music/encode.mjs <path to ffmpeg> <folder with <cityId>-<pixabayId>.mp3>
// (or set FFMPEG and MUSIC_SRC). Picks the loudest ~90 s window of every track, fades it, normalizes loudness
// (EBU R128, -18 LUFS) and writes Opus in Ogg to public/music/<cityId>-<n>.ogg plus docs/music-credits.md.
// ffmpeg comes from the npm package `ffmpeg-static`, installed outside the project.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const FFMPEG = process.argv[2] ?? process.env.FFMPEG;
const SRC = process.argv[3] ?? process.env.MUSIC_SRC;
if (!FFMPEG || !SRC) throw new Error('usage: node tools/music/encode.mjs <ffmpeg> <source folder>');

const WINDOW = 90;
const SKIP = 8;
const FADE_IN = 2.5;
const FADE_OUT = 3;
const TARGET_LUFS = -18;
const OUT = join(ROOT, 'public/music');
mkdirSync(OUT, { recursive: true });

const tracks = readFileSync(join(ROOT, 'tools/music/tracks.tsv'), 'utf8')
  .trim()
  .split(/\r?\n/)
  .map((line) => {
    const [city, n, id, slug, author] = line.split('\t');
    return { city, n: Number(n), id, slug, author };
  });

function ffmpeg(args, opts = {}) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostdin', ...args], { maxBuffer: 1 << 28, ...opts });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr?.toString().slice(-600)}`);
  return r;
}

// Mean-square loudness per second from a mono 8 kHz decode.
function secondLevels(file) {
  const pcm = ffmpeg(['-i', file, '-ac', '1', '-ar', '8000', '-f', 'f32le', '-']).stdout;
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));
  const seconds = Math.floor(samples.length / 8000);
  const levels = [];
  for (let s = 0; s < seconds; s++) {
    let sum = 0;
    for (let i = s * 8000; i < (s + 1) * 8000; i++) sum += samples[i] * samples[i];
    levels.push(sum / 8000);
  }
  return { levels, duration: samples.length / 8000 };
}

function pickWindow(file) {
  const { levels, duration } = secondLevels(file);
  if (duration < WINDOW + 10) return { start: 0, length: duration };
  let best = SKIP;
  let bestSum = -1;
  for (let start = SKIP; start + WINDOW <= levels.length; start++) {
    let sum = 0;
    for (let i = start; i < start + WINDOW; i++) sum += levels[i];
    if (sum > bestSum) {
      bestSum = sum;
      best = start;
    }
  }
  return { start: best, length: WINDOW };
}

const report = [];
for (const t of tracks) {
  const input = join(SRC, `${t.city}-${t.id}.mp3`);
  const { start, length } = pickWindow(input);
  const cut = ['-ss', start.toFixed(2), '-t', length.toFixed(2), '-i', input];
  const lim = `I=${TARGET_LUFS}:TP=-1.5:LRA=11`;
  // Pass 1 measures the segment, pass 2 applies a linear gain with the measured values.
  const probe = ffmpeg([...cut, '-af', `loudnorm=${lim}:print_format=json`, '-f', 'null', '-']).stderr.toString();
  const m = JSON.parse(probe.slice(probe.lastIndexOf('{'), probe.lastIndexOf('}') + 1));
  const norm = `loudnorm=${lim}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const fades = `afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${(length - FADE_OUT).toFixed(2)}:d=${FADE_OUT}`;
  const file = join(OUT, `${t.city}-${t.n}.ogg`);
  ffmpeg([...cut, '-af', `${norm},${fades}`, '-ar', '48000', '-ac', '2', '-c:a', 'libopus', '-b:a', '56k', '-vbr', 'on', '-y', file]);
  const bytes = statSync(file).size;
  report.push({ ...t, start, length, bytes, lufs: m.input_i });
  console.log(`${t.city}-${t.n}.ogg  start ${start}s  length ${length.toFixed(1)}s  ${(bytes / 1e6).toFixed(2)} MB  in ${m.input_i} LUFS`);
}
console.log(`total ${(report.reduce((s, r) => s + r.bytes, 0) / 1e6).toFixed(1)} MB`);

const NAMES = { mexicoCity: 'Mexico City', newYork: 'New York' };
const title = (slug) =>
  slug
    .replace(/-?\d+$/, '')
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
const rows = report.map(
  (r) =>
    `| ${NAMES[r.city] ?? r.city[0].toUpperCase() + r.city.slice(1)} | ${r.city}-${r.n}.ogg | ${title(r.slug)} | ${r.author} | [page](https://pixabay.com/music/${r.slug}/) | Pixabay Content License | ${r.start}s to ${(r.start + r.length).toFixed(0)}s |`,
);
writeFileSync(
  join(ROOT, 'docs/music-credits.md'),
  `# Music credits

The city music in \`public/music\` is from [Pixabay Music](https://pixabay.com/music/), used under the
[Pixabay Content License](https://pixabay.com/service/license-summary/) (free for commercial use in an app, no
attribution required; the files are not offered as standalone downloads). Credits are listed anyway.

Every track is an edit: a segment of about 90 seconds (the loudest window after the first 8 seconds, or the whole track
if it is short) with a 2.5 s fade in, a 3 s fade out, loudness normalized to -18 LUFS and encoded as Opus in Ogg
(about 56 kbps). Re-create the files with \`tools/music/encode.mjs\` (see the header of that file). The column "Segment"
is the part of the original track that was kept.

| City | File | Title (from the Pixabay page name) | Author | Source | License | Segment |
|---|---|---|---|---|---|---|
${rows.join('\n')}
`,
);
