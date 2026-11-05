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

function eiffel(g: Graphics, x: number, y: number, sky: number): void {
  // Rooftops on both sides, the tower in the middle.
  g.fillStyle(0x8a95b0, 1);
  g.fillRect(x - 100, y + 22, 60, 23).fillTriangle(x - 104, y + 22, x - 36, y + 22, x - 70, y + 6);
  g.fillRect(x + 40, y + 26, 60, 19).fillTriangle(x + 36, y + 26, x + 104, y + 26, x + 70, y + 10);
  g.fillStyle(0x4a4e6a, 1);
  g.fillTriangle(x - 34, y + 45, x - 4, y - 20, x - 14, y + 45);
  g.fillTriangle(x + 34, y + 45, x + 4, y - 20, x + 14, y + 45);
  g.fillRect(x - 6, y - 40, 12, 24).fillTriangle(x - 4, y - 40, x + 4, y - 40, x, y - 52);
  g.fillRect(x - 24, y + 12, 48, 6).fillRect(x - 13, y - 14, 26, 5);
  // The arch under the first platform.
  g.fillStyle(sky, 1);
  g.beginPath();
  g.arc(x, y + 45, 12, Math.PI, Math.PI * 2);
  g.closePath();
  g.fillPath();
}

function pyramidsOfGiza(g: Graphics, x: number, y: number): void {
  g.fillStyle(0xe8c070, 1).fillRect(x - 110, y + 36, 220, 9);
  const pyr = (cx: number, h: number, light: number, dark: number) => {
    g.fillStyle(light, 1).fillTriangle(cx - h, y + 40, cx, y + 40 - h, cx, y + 40);
    g.fillStyle(dark, 1).fillTriangle(cx, y + 40 - h, cx, y + 40, cx + h, y + 40);
  };
  pyr(x + 50, 46, 0xd8a85a, 0xb88440);
  pyr(x - 10, 70, 0xe0b265, 0xc08a45);
  // A palm tree in front.
  g.fillStyle(0x7a5a30, 1).fillRect(x - 82, y - 2, 6, 42);
  g.fillStyle(0x3f8a3a, 1);
  [-0.4, 0.6, 1.8, 2.8].forEach((a) => g.fillEllipse(x - 79 + Math.cos(a) * 14, y - 6 + Math.sin(a) * 6 - 4, 30, 9));
}

function gateway(g: Graphics, x: number, y: number, sky: number): void {
  // Sea in front, an arched gateway with four small domes.
  g.fillStyle(0x4aa0c0, 1).fillRect(x - 110, y + 36, 220, 9);
  g.fillStyle(0xd8a070, 1);
  g.fillRect(x - 62, y - 14, 124, 52);
  g.fillRect(x - 70, y - 22, 140, 10);
  [-52, -18, 18, 52].forEach((dx) => g.fillEllipse(x + dx, y - 24, 22, 20).fillRect(x + dx - 1, y - 40, 2, 8));
  g.fillStyle(sky, 1);
  g.fillRect(x - 15, y + 4, 30, 34).fillEllipse(x, y + 4, 30, 30);
  g.fillRect(x - 50, y + 12, 18, 26).fillEllipse(x - 41, y + 12, 18, 16);
  g.fillRect(x + 32, y + 12, 18, 26).fillEllipse(x + 41, y + 12, 18, 16);
}

function sugarloaf(g: Graphics, x: number, y: number): void {
  g.fillStyle(0x4aa0c0, 1).fillRect(x - 110, y + 28, 220, 12);
  g.fillStyle(0xf0d8a0, 1).fillRect(x - 110, y + 40, 220, 5);
  // Two rounded peaks with a cable car between them.
  g.fillStyle(0x3f7a4a, 1);
  g.beginPath();
  g.arc(x - 54, y + 34, 34, Math.PI, Math.PI * 2);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x2f6a40, 1);
  g.beginPath();
  g.moveTo(x + 10, y + 34);
  g.lineTo(x + 30, y - 10);
  g.lineTo(x + 54, y - 34);
  g.lineTo(x + 74, y - 16);
  g.lineTo(x + 100, y + 34);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x6a7a6a, 1).fillEllipse(x + 54, y - 30, 22, 12);
  g.lineStyle(2, 0x3a3a40, 1).lineBetween(x - 54, y + 10, x + 52, y - 32);
  g.fillStyle(0xe8463a, 1).fillRect(x - 6, y - 14, 14, 10);
}

export const CITY_THEMES: Record<string, CityTheme> = {
  paris: {
    wall: 0xf3e6dc,
    tileA: 0x2c3e6a,
    tileB: 0xf5f0e6,
    floor: 0xb08a6a,
    floorDark: 0x9a765a,
    accent: 0xc0304a,
    sky: 0xc9d8f0,
    landmark: (g, x, y) => eiffel(g, x, y, 0xc9d8f0),
  },
  cairo: {
    wall: 0xf4dcae,
    tileA: 0x1f6f8b,
    tileB: 0xd9a441,
    floor: 0xc49a66,
    floorDark: 0xad8656,
    accent: 0x2a8a7a,
    sky: 0xf7d9a0,
    landmark: pyramidsOfGiza,
  },
  mumbai: {
    wall: 0xfbe3c8,
    tileA: 0xd8602b,
    tileB: 0x2f8a6a,
    floor: 0xa86a42,
    floorDark: 0x925a36,
    accent: 0xd8b020,
    sky: 0xfac0a0,
    landmark: (g, x, y) => gateway(g, x, y, 0xfac0a0),
  },
  rio: {
    wall: 0xe8f4e0,
    tileA: 0x2a9a5a,
    tileB: 0xf6d040,
    floor: 0xd6b48a,
    floorDark: 0xc09e76,
    accent: 0x1f6fbf,
    sky: 0x9fdcf0,
    landmark: sugarloaf,
  },
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
