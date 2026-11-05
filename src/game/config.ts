// Logical resolution. The canvas is scaled to fit the device while keeping this aspect ratio,
// so all game code can use these fixed coordinates regardless of screen size.
// 1080 wide keeps text and shapes sharp on typical phone screens.
export const GAME_WIDTH = 1080;
const BASE_HEIGHT = 1920;
// Backgrounds that run to the bottom edge are drawn this tall, so a later resize never uncovers them.
export const MAX_GAME_HEIGHT = 2560;

// Phones taller than 16:9 get a taller canvas instead of empty bands above and below; the
// extra height goes to the restaurant scene, which zooms in to fill it. Measured at startup and again when the
// view resizes (e.g. Android hides the navigation bar after the game has started).
export function fitHeight(): number {
  if (typeof document === 'undefined') return BASE_HEIGHT;
  const box = document.getElementById('game');
  if (!box || box.clientWidth === 0) return BASE_HEIGHT;
  const height = Math.round((GAME_WIDTH * box.clientHeight) / box.clientWidth);
  return Math.min(Math.max(height, BASE_HEIGHT), MAX_GAME_HEIGHT);
}

export const GAME_HEIGHT = fitHeight();

// Vertical layout bands: HUD at the top, upgrade panel at the bottom, restaurant in between.
export const LAYOUT = {
  hudHeight: 190,
  panelHeight: 910,
} as const;

export const panelTop = (gameHeight: number): number => gameHeight - LAYOUT.panelHeight;

// Istanbul palette (first city).
export const PALETTE = {
  background: 0x2b1d14,
  wall: 0xfbefd9,
  floor: 0xb8693d,
  floorDark: 0x9a5530,
  pomegranate: 0xc0392b,
  pomegranateDark: 0x7a241b,
  tileBlue: 0x1f6f8b,
  saffron: 0xf4b400,
  saffronDark: 0xb07f00,
  cream: 0xfff8ec,
  panel: 0xf3e6d0,
  ink: 0x3a2618,
  muted: 0x8a7462,
  disabled: 0xc9bba8,
  disabledDark: 0x9f9282,
  success: 0x4a8c3a,
} as const;

// Rounded, friendly display font bundled with the app (Fredoka, SIL Open Font License).
export const FONT = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';

export const toCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
