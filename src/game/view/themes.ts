import type Phaser from 'phaser';
import { PALETTE } from '../config';

type Graphics = Phaser.GameObjects.Graphics;

// Look of the restaurant in one city: colors for the room and a landmark for the wall poster.
export interface CityTheme {
  wall: number;
  tileA: number;
  tileB: number;
  floor: number;
  floorDark: number;
  // Table cloth stripe and door mat.
  accent: number;
  sky: number;
  // Draws the landmark silhouette inside a 220x90 poster centered on (x, y).
  landmark: (g: Graphics, x: number, y: number) => void;
}

function mosque(g: Graphics, x: number, y: number): void {
  const color = 0x5b6c8f;
  g.fillStyle(color, 1);
  g.fillEllipse(x, y + 8, 84, 64);
  g.fillEllipse(x - 42, y + 22, 40, 30).fillEllipse(x + 42, y + 22, 40, 30);
  g.fillRect(x - 64, y + 18, 128, 27);
  [-82, 82].forEach((dx) => {
    g.fillRect(x + dx - 4, y - 28, 8, 73);
    g.fillTriangle(x + dx - 6, y - 28, x + dx + 6, y - 28, x + dx, y - 44);
  });
  g.fillRect(x - 2, y - 36, 4, 14);
}

function colosseum(g: Graphics, x: number, y: number, sky: number): void {
  g.fillStyle(0xc99a6b, 1).fillRoundedRect(x - 90, y - 26, 180, 71, { tl: 30, tr: 30, bl: 0, br: 0 });
  g.fillStyle(sky, 1);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 7; i++) {
      const ax = x - 72 + i * 24;
      const ay = y - 8 + row * 26;
      g.fillRect(ax - 7, ay, 14, 14).fillCircle(ax, ay, 7);
    }
  }
}

function torii(g: Graphics, x: number, y: number): void {
  // Snowy mountain behind the gate.
  g.fillStyle(0x7d8fb3, 1).fillTriangle(x - 100, y + 45, x + 100, y + 45, x, y - 30);
  g.fillStyle(0xffffff, 1).fillTriangle(x - 22, y - 13, x + 22, y - 13, x, y - 30);
  g.fillStyle(0xc0392b, 1);
  g.fillRect(x - 46, y - 18, 11, 63).fillRect(x + 35, y - 18, 11, 63);
  g.fillRect(x - 70, y - 34, 140, 11).fillRect(x - 56, y - 12, 112, 8);
}

function skyline(g: Graphics, x: number, y: number): void {
  g.fillStyle(0x4a5568, 1);
  [
    [-100, 30, 34],
    [-70, 22, 52],
    [-44, 26, 40],
    [26, 24, 58],
    [52, 30, 36],
    [80, 24, 48],
  ].forEach(([dx, w, h]) => g.fillRect(x + dx, y + 45 - h, w, h));
  // Tall tower with a spire in the middle.
  g.fillStyle(0x2d3748, 1);
  g.fillRect(x - 16, y - 10, 34, 55).fillRect(x - 9, y - 26, 20, 16).fillRect(x - 1, y - 44, 4, 18);
  g.fillStyle(PALETTE.saffron, 1);
  for (let i = 0; i < 4; i++) g.fillRect(x - 10, y - 2 + i * 12, 6, 5).fillRect(x + 6, y - 2 + i * 12, 6, 5);
}

function pyramid(g: Graphics, x: number, y: number): void {
  const color = 0xa0704a;
  g.fillStyle(color, 1);
  [0, 1, 2, 3].forEach((i) => g.fillRect(x - 96 + i * 20, y + 33 - i * 16, 192 - i * 40, 16));
  g.fillStyle(0x7f5535, 1).fillRect(x - 14, y - 31, 28, 18);
  g.fillRect(x - 8, y - 15, 16, 60);
}

function temple(g: Graphics, x: number, y: number): void {
  const spire = (cx: number, base: number, scale: number) => {
    g.fillStyle(0xd4a017, 1);
    g.fillTriangle(cx - 22 * scale, base, cx + 22 * scale, base, cx, base - 90 * scale);
    g.fillStyle(0xb8860b, 1);
    for (let i = 0; i < 3; i++) g.fillEllipse(cx, base - 16 * scale - i * 18 * scale, (36 - i * 9) * scale, 10 * scale);
  };
  spire(x - 62, y + 45, 0.65);
  spire(x + 62, y + 45, 0.65);
  spire(x, y + 45, 1);
  g.fillStyle(0x8b5a2b, 1).fillRect(x - 100, y + 38, 200, 7);
}

export const CITY_THEMES: Record<string, CityTheme> = {
  istanbul: {
    wall: PALETTE.wall,
    tileA: PALETTE.tileBlue,
    tileB: 0x2f8fb0,
    floor: PALETTE.floor,
    floorDark: PALETTE.floorDark,
    accent: PALETTE.pomegranate,
    sky: 0xf6c48f,
    landmark: mosque,
  },
  rome: {
    wall: 0xf6dcc0,
    tileA: 0xb5562f,
    tileB: 0xd9895a,
    floor: 0xc4ab8c,
    floorDark: 0xae967a,
    accent: 0x2e7d32,
    sky: 0x9fd3e8,
    landmark: (g, x, y) => colosseum(g, x, y, 0x9fd3e8),
  },
  tokyo: {
    wall: 0xf7f2e8,
    tileA: 0x2b3a67,
    tileB: 0x4a5a8c,
    floor: 0xc9b57a,
    floorDark: 0xb6a268,
    accent: 0xc0392b,
    sky: 0xf8d7da,
    landmark: torii,
  },
  newYork: {
    wall: 0xe4d9cc,
    tileA: 0xf4f4f4,
    tileB: 0xd5d5d5,
    floor: 0x8e6a55,
    floorDark: 0x7d5b48,
    accent: 0xf4b400,
    sky: 0xf2a65a,
    landmark: skyline,
  },
  mexicoCity: {
    wall: 0xf9d98f,
    tileA: 0x1f6f8b,
    tileB: 0xf5f0e6,
    floor: 0xc86b3c,
    floorDark: 0xb15c31,
    accent: 0xd35d8a,
    sky: 0x8fd1e8,
    landmark: pyramid,
  },
  bangkok: {
    wall: 0xf6e9c8,
    tileA: 0x7b2d26,
    tileB: 0xc9a227,
    floor: 0x9c6b3f,
    floorDark: 0x885b34,
    accent: 0x7b4fa0,
    sky: 0xf9c784,
    landmark: temple,
  },
};

export function cityTheme(cityId: string): CityTheme {
  return CITY_THEMES[cityId] ?? CITY_THEMES.istanbul;
}
