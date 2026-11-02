// Logical resolution. The canvas is scaled to fit the device while keeping this aspect ratio,
// so all game code can use these fixed coordinates regardless of screen size.
// 1080 wide keeps text and shapes sharp on typical phone screens.
export const GAME_WIDTH = 1080;
export const GAME_HEIGHT = 1920;

// Vertical layout bands.
export const LAYOUT = {
  hudHeight: 190,
  panelTop: 1010,
} as const;

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

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const toCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
