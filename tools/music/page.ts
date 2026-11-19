import { MusicPlayer, TRACKS_PER_CITY } from '../../src/game/music/MusicPlayer';

// Dev page to listen to the music of every city: /music.html on the dev server.

const CITIES = ['istanbul', 'rome', 'paris', 'cairo', 'mumbai', 'bangkok', 'tokyo', 'rio', 'mexicoCity', 'newYork'];
const NAMES: Record<string, string> = { mexicoCity: 'Mexico City', newYork: 'New York' };
const name = (id: string) => NAMES[id] ?? id[0].toUpperCase() + id.slice(1);

let ctx: AudioContext | null = null;
let player: MusicPlayer | null = null;
const status = document.getElementById('status')!;
const list = document.getElementById('cities')!;

function ensure(): MusicPlayer {
  if (!ctx || !player) {
    ctx = new AudioContext();
    const volume = ctx.createGain();
    volume.gain.value = 0.5;
    volume.connect(ctx.destination);
    player = new MusicPlayer(ctx, volume);
    player.onChange = refresh;
  }
  void ctx.resume();
  return player;
}

function refresh(): void {
  if (!player) return;
  const city = player.currentCity;
  const track = player.currentTrack;
  document.querySelectorAll<HTMLElement>('button.track').forEach((b) => {
    b.classList.toggle('on', b.dataset.city === city && Number(b.dataset.track) === track);
  });
  status.textContent = track < 0 ? 'Stopped' : `Playing ${name(city)} track ${track + 1}`;
}

for (const id of CITIES) {
  const row = document.createElement('section');
  row.innerHTML = `<h2>${name(id)}</h2>`;
  const buttons = document.createElement('div');
  buttons.className = 'tracks';
  for (let i = 0; i < TRACKS_PER_CITY; i++) {
    const b = document.createElement('button');
    b.className = 'track';
    b.dataset.city = id;
    b.dataset.track = String(i);
    b.textContent = `Track ${i + 1}`;
    b.addEventListener('click', () => {
      const p = ensure();
      p.setCity(id);
      p.playTrack(i);
    });
    buttons.appendChild(b);
  }
  const shuffle = document.createElement('button');
  shuffle.className = 'shuffle';
  shuffle.textContent = 'Shuffle this city';
  shuffle.addEventListener('click', () => {
    const p = ensure();
    p.setCity(id);
    p.shuffle();
  });
  buttons.appendChild(shuffle);
  row.appendChild(buttons);
  list.appendChild(row);
}

document.getElementById('stop')!.addEventListener('click', () => {
  player?.stop();
  refresh();
  status.textContent = 'Stopped';
});

// Dev hook for the check scripts.
(window as unknown as { musicPlayer: () => MusicPlayer | null }).musicPlayer = () => player;
