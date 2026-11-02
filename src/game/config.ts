// Logical resolution. The canvas is scaled to fit the device while keeping this aspect ratio,
// so all game code can use these fixed coordinates regardless of screen size.
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// Istanbul palette (first city).
export const PALETTE = {
  background: 0x2b1d14,
  wall: 0xfbefd9,
  floor: 0xb8693d,
  floorDark: 0x9a5530,
  pomegranate: 0xc0392b,
  tileBlue: 0x1f6f8b,
  saffron: 0xf4b400,
  cream: 0xfff8ec,
  ink: 0x3a2618,
} as const;

export const toCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
