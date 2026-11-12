import { MusicPlayer } from '../../src/game/music/MusicPlayer';
import { SONGS } from '../../src/game/music/songs';

// Dev page to listen to every city's music on its own: /music.html on the dev server.

const DESCRIPTIONS: Record<string, string> = {
  istanbul: 'Saz and darbuka, Hicaz mode',
  rome: 'Mandolin tremolo and guitar',
  paris: 'Musette accordion waltz',
  cairo: 'Ney, oud and riq',
  mumbai: 'Sitar, tanpura drone and tabla',
  bangkok: 'Ranat, gong circle and ching',
  tokyo: 'Koto, taiko and shime',
  rio: 'Bossa nova: nylon guitar and flute',
  mexicoCity: 'Mariachi trumpets and vihuela',
  newYork: 'Jazz café: electric piano and vibes',
};

const NAMES: Record<string, string> = { mexicoCity: 'Mexico City', newYork: 'New York' };

let ctx: AudioContext | null = null;
let player: MusicPlayer | null = null;
const status = document.getElementById('status')!;
const list = document.getElementById('songs')!;

function play(id: string): void {
  if (!ctx) {
    ctx = new AudioContext();
    const volume = ctx.createGain();
    volume.gain.value = 0.5;
    const compressor = ctx.createDynamicsCompressor();
    volume.connect(compressor).connect(ctx.destination);
    player = new MusicPlayer(ctx, volume);
  }
  void ctx.resume();
  player!.setSong(id);
  player!.start();
  document.querySelectorAll('button.song').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.id === id));
  const song = SONGS[id];
  const loop = (song.chords.length * song.beatsPerBar * 60) / song.bpm;
  status.textContent = `Playing ${NAMES[id] ?? id[0].toUpperCase() + id.slice(1)} (${song.bpm} bpm, ${song.beatsPerBar}/4, loop ${loop.toFixed(1)} s)`;
}

for (const id of Object.keys(SONGS)) {
  const button = document.createElement('button');
  button.className = 'song';
  button.dataset.id = id;
  button.innerHTML = `<b>${NAMES[id] ?? id[0].toUpperCase() + id.slice(1)}</b><span>${DESCRIPTIONS[id]}</span>`;
  button.addEventListener('click', () => play(id));
  list.appendChild(button);
}

document.getElementById('stop')!.addEventListener('click', () => {
  player?.stop();
  document.querySelectorAll('button.song').forEach((b) => b.classList.remove('on'));
  status.textContent = 'Stopped';
});

// Dev check: average loudness (weighted RMS, level trim included) of each song over two loops, rendered offline.
async function measure(id: string): Promise<number> {
  const song = SONGS[id];
  const bars = song.chords.length * 2;
  const seconds = (bars * song.beatsPerBar * 60) / song.bpm + 1;
  const offline = new OfflineAudioContext(1, Math.ceil(seconds * 22050), 22050);
  // Ears hear low bass as quieter than its energy suggests, so it is weighed less (roughly like
  // a loudness meter's K-weighting).
  const weighting = offline.createBiquadFilter();
  weighting.type = 'highpass';
  weighting.frequency.value = 150;
  weighting.connect(offline.destination);
  const p = new MusicPlayer(offline, weighting);
  p.setSong(id);
  p.render(0.05, bars);
  const data = (await offline.startRendering()).getChannelData(0);
  // Only the second loop, where the tune plays.
  const from = Math.floor((data.length * 0.5));
  let sum = 0;
  for (let i = from; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / (data.length - from));
}

(window as unknown as { measureMusic: () => Promise<Record<string, number>> }).measureMusic = async () => {
  const out: Record<string, number> = {};
  for (const id of Object.keys(SONGS)) out[id] = Number((await measure(id)).toFixed(4));
  return out;
};
