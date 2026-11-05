import Phaser from 'phaser';
import type { SectionId } from '../../core/economy';
import { type Ctx, css, ellipse, hGradient, paintTexture, radial, roundRect, vGradient } from '../view/paint';

// Round painted badges for the upgrade panel: one per restaurant section and one per dish.
// Drawn around (0, 0) in a SIZE x SIZE texture.
export const ICON_SIZE = 84;
const R = 36;

type Painter = (ctx: Ctx) => void;

function badge(ctx: Ctx, color: number, draw: Painter): void {
  ctx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
  ctx.fillStyle = 'rgba(60,35,20,0.25)';
  ellipse(ctx, 0, 4, R, R);
  ctx.fill();
  ctx.fillStyle = radial(ctx, 0, 0, 0, R, [
    [0, css(color, 0.55)],
    [1, css(color, 0.15)],
  ], -10, -14);
  ellipse(ctx, 0, 0, R, R);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = css(color, -0.25);
  ctx.stroke();
  ctx.save();
  draw(ctx);
  ctx.restore();
  // Glossy highlight on top.
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ellipse(ctx, -6, -18, 22, 10);
  ctx.fill();
}

function outline(ctx: Ctx, width = 2): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = 'rgba(60,35,20,0.6)';
  ctx.stroke();
}

// --- Sections ------------------------------------------------------------------------------

const SECTION_GLYPHS: Record<SectionId, Painter> = {
  // A door under a striped awning.
  entrance: (ctx) => {
    ctx.fillStyle = vGradient(ctx, -8, 26, [
      [0, '#a0623a'],
      [1, '#6e3e22'],
    ]);
    roundRect(ctx, -13, -8, 26, 34, [10, 10, 0, 0]);
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#f2c94c';
    ellipse(ctx, 7, 10, 2.5, 2.5);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#e8463a' : '#fff6e6';
      ctx.beginPath();
      ctx.moveTo(-22 + i * 8.8, -22);
      ctx.lineTo(-22 + (i + 1) * 8.8, -22);
      ctx.lineTo(-22 + (i + 1) * 8.8, -12);
      ctx.arc(-22 + (i + 0.5) * 8.8, -12, 4.4, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.rect(-22, -22, 44, 10);
    outline(ctx, 1.5);
  },
  // A round table with a cloth and two chairs.
  seating: (ctx) => {
    ctx.fillStyle = '#8a5530';
    [-1, 1].forEach((s) => {
      roundRect(ctx, s * 20 - 5, -14, 10, 30, 4);
      ctx.fill();
    });
    ctx.fillStyle = '#5e3a20';
    ctx.fillRect(-3, 4, 6, 18);
    ctx.fillStyle = vGradient(ctx, -6, 10, [
      [0, '#ffffff'],
      [1, '#e6dccb'],
    ]);
    ellipse(ctx, 0, 0, 22, 9);
    ctx.fill();
    outline(ctx);
    ctx.fillRect(-20, 0, 40, 9);
    ctx.fillStyle = '#e8463a';
    ellipse(ctx, 0, -4, 5, 3);
    ctx.fill();
  },
  // A chef's toque.
  kitchen: (ctx) => {
    ctx.fillStyle = radial(ctx, 0, -10, 2, 26, [
      [0, '#ffffff'],
      [1, '#d9d9d9'],
    ], -6, -16);
    ctx.beginPath();
    ctx.arc(-11, -6, 11, Math.PI * 0.6, Math.PI * 1.6);
    ctx.arc(0, -14, 13, Math.PI * 1.1, Math.PI * 1.9);
    ctx.arc(11, -6, 11, Math.PI * 1.4, Math.PI * 0.4);
    ctx.lineTo(13, 14);
    ctx.lineTo(-13, 14);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#ececec';
    roundRect(ctx, -15, 12, 30, 10, 3);
    ctx.fill();
    outline(ctx, 1.5);
  },
  // A silver cloche on a tray.
  waiters: (ctx) => {
    ctx.fillStyle = hGradient(ctx, -18, 18, [
      [0, '#9aa4ab'],
      [0.35, '#ffffff'],
      [1, '#7d878e'],
    ]);
    ctx.beginPath();
    ctx.arc(0, 8, 18, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#c9d1d6';
    ellipse(ctx, 0, -12, 4, 3);
    ctx.fill();
    ctx.fillStyle = '#e0b04a';
    roundRect(ctx, -24, 8, 48, 6, 3);
    ctx.fill();
    outline(ctx, 1.5);
  },
  // A cash register.
  cashier: (ctx) => {
    ctx.fillStyle = vGradient(ctx, -4, 22, [
      [0, '#a77ad0'],
      [1, '#6a4290'],
    ]);
    roundRect(ctx, -20, -2, 40, 22, 4);
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#d8f0e0';
    roundRect(ctx, -14, -18, 22, 12, 3);
    ctx.fill();
    outline(ctx, 1.5);
    ctx.fillStyle = '#fff6e6';
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        roundRect(ctx, -15 + c * 8, 3 + r * 7, 6, 5, 1.5);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#f2c94c';
    ellipse(ctx, 14, -12, 5, 5);
    ctx.fill();
  },
  // Stacked plates with soap bubbles.
  dishwashing: (ctx) => {
    [14, 6, -2].forEach((y) => {
      ctx.fillStyle = vGradient(ctx, y - 5, y + 5, [
        [0, '#ffffff'],
        [1, '#d6dde2'],
      ]);
      ellipse(ctx, -2, y, 20, 6);
      ctx.fill();
      outline(ctx, 1.5);
    });
    [
      [12, -16, 7],
      [-8, -15, 5],
      [3, -24, 4],
    ].forEach(([x, y, r]) => {
      ctx.fillStyle = 'rgba(220,245,255,0.7)';
      ellipse(ctx, x, y, r, r);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(80,140,170,0.8)';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ellipse(ctx, x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.25);
      ctx.fill();
    });
  },
};

export function sectionIcon(scene: Phaser.Scene, id: SectionId, color: number): string {
  return paintTexture(scene, `icon-section-${id}`, ICON_SIZE, ICON_SIZE, (ctx) => badge(ctx, color, SECTION_GLYPHS[id]));
}

// --- Dishes --------------------------------------------------------------------------------

type DishShape =
  | 'wrap'
  | 'slice'
  | 'taco'
  | 'burger'
  | 'bowl'
  | 'sushi'
  | 'pan'
  | 'layers'
  | 'balls'
  | 'dumpling'
  | 'fried'
  | 'dip'
  | 'plate'
  | 'hotdog';

const GREEN = 0x5aa03c;
const RED = 0xd8452b;
const CREAM = 0xf3e6cc;

// Shape and colors (main food color, accent) for every dish id across all cities.
const DISHES: Record<string, [DishShape, number, number]> = {
  doner: ['wrap', 0x9a5a32, GREEN],
  pizza: ['slice', 0xe8b04a, 0xc0392b],
  taco: ['taco', 0xe7b453, GREEN],
  burger: ['burger', 0x6b3a1e, GREEN],
  ramen: ['bowl', 0xe8b878, 0xf4e2a0],
  sushi: ['sushi', 0xf07b5a, 0x223322],
  paella: ['pan', 0xf0c040, RED],
  lasagna: ['layers', 0xe2a24a, 0xc0392b],
  falafel: ['balls', 0x9a6a2e, GREEN],
  dumplings: ['dumpling', 0xf3e6cc, GREEN],
  fishAndChips: ['fried', 0xe6b04a, 0xf3d27a],
  curry: ['bowl', 0xe08a2b, 0xf7f0e0],
  pho: ['bowl', 0xd9a86a, GREEN],
  ceviche: ['dip', 0xf3e0c0, 0xe85a3a],
  tempura: ['fried', 0xf1c86a, 0xf08a5a],
  hummus: ['dip', 0xe7cc8e, 0x8a9a3a],
  bibimbap: ['bowl', 0xf2efe6, RED],
  schnitzel: ['fried', 0xd89a40, 0xf6e27a],
  goulash: ['bowl', 0xa8402a, 0xe8a060],
  moussaka: ['layers', 0x8a4a6a, 0xf0d8a0],
  empanadas: ['dumpling', 0xd9993a, 0xb06a2a],
  hotDog: ['hotdog', 0xc0502a, 0xf2c94c],
  risotto: ['plate', 0xf0e2b0, GREEN],
  gyoza: ['dumpling', 0xe8c48a, 0x9a5a32],
  shawarma: ['wrap', 0xb06a3a, CREAM],
  jollof: ['plate', 0xd8552b, GREEN],
  pierogi: ['dumpling', 0xf5e8c8, 0xe0a050],
  poke: ['bowl', 0xf07b5a, GREEN],
  mole: ['plate', 0x5a2e1e, 0xf0e8d8],
  butterChicken: ['bowl', 0xe0782b, 0xf7f0e0],
  borscht: ['bowl', 0xb0243e, 0xf7f0e0],
  laksa: ['bowl', 0xf0a040, RED],
  feijoada: ['bowl', 0x3a2420, 0xf0e8d8],
  couscous: ['plate', 0xf0d070, RED],
  baklava: ['layers', 0xe0a840, GREEN],
  padThai: ['plate', 0xf0c070, RED],
  bulgogi: ['plate', 0x7a3a1e, GREEN],
  poutine: ['fried', 0xe8b850, 0x7a4a2a],
  injera: ['dip', 0xc8a070, RED],
  nasiGoreng: ['plate', 0xd88a3a, 0xf6e27a],
  arepas: ['burger', 0xe8c070, 0x3a2420],
  tiramisu: ['layers', 0x7a4a2a, CREAM],
};

function fill(ctx: Ctx, color: number, top: number, bottom: number): void {
  ctx.fillStyle = vGradient(ctx, top, bottom, [
    [0, css(color, 0.3)],
    [1, css(color, -0.15)],
  ]);
  ctx.fill();
}

function plateUnder(ctx: Ctx, y = 12, rx = 26): void {
  ctx.fillStyle = vGradient(ctx, y - 6, y + 6, [
    [0, '#ffffff'],
    [1, '#d9dde0'],
  ]);
  ellipse(ctx, 0, y, rx, 8);
  ctx.fill();
  outline(ctx, 1.5);
}

function dots(ctx: Ctx, color: number, points: [number, number][], r = 2.5): void {
  ctx.fillStyle = css(color);
  points.forEach(([x, y]) => {
    ellipse(ctx, x, y, r, r);
    ctx.fill();
  });
}

const SHAPES: Record<DishShape, (ctx: Ctx, main: number, accent: number) => void> = {
  wrap: (ctx, main, accent) => {
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.moveTo(-10, 22);
    ctx.lineTo(10, 22);
    ctx.lineTo(13, -14);
    ctx.lineTo(-13, -14);
    ctx.closePath();
    fill(ctx, 0xf0d9a8, -14, 22);
    outline(ctx);
    ellipse(ctx, 0, -14, 13, 6);
    fill(ctx, main, -20, -8);
    dots(ctx, accent, [[-5, -16], [4, -13], [7, -17]], 2.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-11, 6, 22, 12);
    ctx.fillStyle = css(RED, 0, 0.8);
    ctx.fillRect(-11, 10, 22, 3);
  },
  slice: (ctx, main, accent) => {
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(-22, -14);
    ctx.quadraticCurveTo(0, -24, 22, -14);
    ctx.closePath();
    fill(ctx, main, -20, 24);
    outline(ctx);
    ctx.beginPath();
    ctx.moveTo(-22, -14);
    ctx.quadraticCurveTo(0, -24, 22, -14);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#c47a35';
    ctx.stroke();
    dots(ctx, accent, [[-7, -6], [6, -4], [0, 8]], 4);
  },
  taco: (ctx, main, accent) => {
    ctx.beginPath();
    ctx.arc(0, 12, 24, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = css(accent);
    ctx.fill();
    dots(ctx, RED, [[-10, -6], [6, -8]], 3.5);
    ctx.beginPath();
    ctx.arc(0, 14, 22, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineTo(18, 14);
    ctx.lineTo(-18, 14);
    ctx.closePath();
    fill(ctx, main, -8, 14);
    outline(ctx);
  },
  burger: (ctx, main, accent) => {
    ctx.beginPath();
    ctx.arc(0, -2, 22, Math.PI, 0);
    ctx.closePath();
    fill(ctx, 0xe0a050, -24, -2);
    outline(ctx);
    dots(ctx, 0xfff3d0, [[-8, -12], [2, -16], [9, -9]], 1.6);
    ctx.fillStyle = css(accent);
    roundRect(ctx, -24, -2, 48, 5, 2.5);
    ctx.fill();
    roundRect(ctx, -22, 2, 44, 9, 4);
    fill(ctx, main, 2, 11);
    roundRect(ctx, -22, 11, 44, 9, [2, 2, 8, 8]);
    fill(ctx, 0xe0a050, 11, 20);
    outline(ctx, 1.5);
  },
  bowl: (ctx, main, accent) => {
    ellipse(ctx, 0, -2, 25, 8);
    fill(ctx, main, -10, 6);
    ctx.lineWidth = 2;
    ctx.strokeStyle = css(accent);
    [-10, 0, 10].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x - 6, -2);
      ctx.quadraticCurveTo(x, -6, x + 6, -2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(-26, -2);
    ctx.quadraticCurveTo(-24, 22, 0, 22);
    ctx.quadraticCurveTo(24, 22, 26, -2);
    ctx.closePath();
    ctx.fillStyle = hGradient(ctx, -26, 26, [
      [0, '#ffffff'],
      [1, '#c8d0d6'],
    ]);
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = css(RED, 0, 0.8);
    ctx.fillRect(-20, 8, 40, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    [-6, 6].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.bezierCurveTo(x - 5, -16, x + 5, -20, x, -26);
      ctx.stroke();
    });
  },
  sushi: (ctx, main, accent) => {
    [-12, 12].forEach((x) => {
      roundRect(ctx, x - 11, -2, 22, 18, 6);
      fill(ctx, 0xffffff, -2, 16);
      outline(ctx, 1.5);
      roundRect(ctx, x - 12, -8, 24, 10, 5);
      fill(ctx, main, -8, 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 6, -6);
      ctx.lineTo(x - 2, 0);
      ctx.moveTo(x + 2, -6);
      ctx.lineTo(x + 6, 0);
      ctx.stroke();
      ctx.fillStyle = css(accent);
      ctx.fillRect(x - 3, -8, 6, 24);
    });
  },
  pan: (ctx, main, accent) => {
    ctx.fillStyle = '#3a3a40';
    roundRect(ctx, -30, -2, 8, 5, 2);
    ctx.fill();
    roundRect(ctx, 22, -2, 8, 5, 2);
    ctx.fill();
    ellipse(ctx, 0, 2, 24, 13);
    ctx.fillStyle = '#4a4a52';
    ctx.fill();
    ellipse(ctx, 0, 0, 21, 10);
    fill(ctx, main, -10, 10);
    dots(ctx, accent, [[-10, -2], [6, -4], [10, 3], [-3, 4]], 3);
    dots(ctx, GREEN, [[-4, -5], [2, 2], [-12, 3]], 2);
  },
  layers: (ctx, main, accent) => {
    plateUnder(ctx, 16);
    ctx.beginPath();
    ctx.moveTo(-18, -4);
    ctx.lineTo(10, -14);
    ctx.lineTo(22, -6);
    ctx.lineTo(22, 10);
    ctx.lineTo(-6, 18);
    ctx.lineTo(-18, 10);
    ctx.closePath();
    fill(ctx, main, -14, 18);
    outline(ctx);
    ctx.strokeStyle = css(accent);
    ctx.lineWidth = 3;
    [2, 9].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(-18, y - 4);
      ctx.lineTo(-6, y + 4);
      ctx.lineTo(22, y - 6);
      ctx.stroke();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(-18, -4);
    ctx.lineTo(10, -14);
    ctx.lineTo(22, -6);
    ctx.lineTo(-6, 3);
    ctx.closePath();
    ctx.fill();
  },
  balls: (ctx, main, accent) => {
    plateUnder(ctx, 14);
    [
      [-10, 4],
      [10, 4],
      [0, -8],
    ].forEach(([x, y]) => {
      ctx.fillStyle = radial(ctx, x, y, 1, 11, [
        [0, css(main, 0.35)],
        [1, css(main, -0.25)],
      ], x - 3, y - 4);
      ellipse(ctx, x, y, 10, 10);
      ctx.fill();
      outline(ctx, 1.5);
    });
    dots(ctx, accent, [[-14, 12], [16, 12]], 3);
  },
  dumpling: (ctx, main, accent) => {
    plateUnder(ctx, 14);
    ctx.beginPath();
    ctx.moveTo(-22, 8);
    ctx.quadraticCurveTo(-18, -18, 0, -18);
    ctx.quadraticCurveTo(18, -18, 22, 8);
    ctx.closePath();
    fill(ctx, main, -18, 8);
    outline(ctx);
    ctx.strokeStyle = css(main, -0.3);
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 7, -16 + Math.abs(i) * 2);
      ctx.lineTo(i * 6, -8 + Math.abs(i) * 2);
      ctx.stroke();
    }
    dots(ctx, accent, [[-18, 14], [18, 13]], 2.5);
  },
  fried: (ctx, main, accent) => {
    ctx.fillStyle = css(accent);
    [-12, -6, 0, 6, 12].forEach((x, i) => {
      ctx.save();
      ctx.translate(x, -6);
      ctx.rotate((i - 2) * 0.15);
      roundRect(ctx, -3, -14, 6, 22, 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.beginPath();
    ctx.moveTo(-20, -4);
    ctx.lineTo(20, -4);
    ctx.lineTo(14, 24);
    ctx.lineTo(-14, 24);
    ctx.closePath();
    ctx.fillStyle = vGradient(ctx, -4, 24, [
      [0, '#e8463a'],
      [1, '#b02a20'],
    ]);
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-18, 4, 36, 4);
    ctx.save();
    ctx.translate(14, -10);
    ctx.rotate(0.5);
    ellipse(ctx, 0, 0, 12, 7);
    fill(ctx, main, -7, 7);
    outline(ctx, 1.5);
    ctx.restore();
  },
  dip: (ctx, main, accent) => {
    ellipse(ctx, 0, 6, 27, 14);
    ctx.fillStyle = vGradient(ctx, -8, 20, [
      [0, '#ffffff'],
      [1, '#cfd6db'],
    ]);
    ctx.fill();
    outline(ctx);
    ellipse(ctx, 0, 3, 21, 10);
    fill(ctx, main, -7, 13);
    ctx.strokeStyle = css(main, -0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 3, 11, 5, 0, 0.3, Math.PI * 1.7);
    ctx.stroke();
    dots(ctx, accent, [[-6, 1], [5, 5], [2, -2], [-10, 6]], 2.5);
  },
  plate: (ctx, main, accent) => {
    plateUnder(ctx, 10, 28);
    ctx.beginPath();
    ctx.moveTo(-20, 10);
    ctx.quadraticCurveTo(-16, -16, 0, -16);
    ctx.quadraticCurveTo(16, -16, 20, 10);
    ctx.closePath();
    fill(ctx, main, -16, 10);
    outline(ctx, 1.5);
    dots(ctx, accent, [[-6, -6], [6, -2], [0, 3], [-10, 4], [9, -9]], 2.5);
  },
  hotdog: (ctx, main, accent) => {
    ctx.rotate(-0.25);
    roundRect(ctx, -26, -6, 52, 14, 7);
    fill(ctx, main, -6, 8);
    outline(ctx, 1.5);
    ctx.strokeStyle = css(accent);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = -18; x <= 18; x += 6) ctx.lineTo(x, -2 + ((x / 6) % 2 === 0 ? -3 : 3));
    ctx.stroke();
    roundRect(ctx, -22, 2, 44, 14, [3, 3, 8, 8]);
    fill(ctx, 0xe0a050, 2, 16);
    outline(ctx, 1.5);
  },
};

export function dishIcon(scene: Phaser.Scene, dish: string, color: number): string {
  const [shape, main, accent] = DISHES[dish] ?? ['plate', color, GREEN];
  return paintTexture(scene, `icon-dish-${dish}`, ICON_SIZE, ICON_SIZE, (ctx) =>
    badge(ctx, color, (c) => SHAPES[shape](c, main, accent)),
  );
}

// A small padlock drawn over locked dishes.
export function lockIcon(scene: Phaser.Scene): string {
  return paintTexture(scene, 'icon-lock', 34, 40, (ctx) => {
    ctx.translate(17, 22);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#8a8f96';
    ctx.beginPath();
    ctx.arc(0, -6, 8, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = vGradient(ctx, -6, 16, [
      [0, '#f2c94c'],
      [1, '#c8961e'],
    ]);
    roundRect(ctx, -13, -6, 26, 22, 5);
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#6b4a14';
    ellipse(ctx, 0, 3, 3, 3);
    ctx.fill();
    ctx.fillRect(-1.5, 3, 3, 7);
  });
}

// Settings gear for the HUD.
export function gearIcon(scene: Phaser.Scene): string {
  return paintTexture(scene, 'icon-gear', 64, 64, (ctx) => {
    ctx.translate(32, 32);
    ctx.fillStyle = '#fff6e6';
    ctx.beginPath();
    const teeth = 8;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 26 : 20;
      const half = Math.PI / (teeth * 2) * 0.55;
      ctx.lineTo(Math.cos(a - half) * r, Math.sin(a - half) * r);
      ctx.lineTo(Math.cos(a + half) * r, Math.sin(a + half) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ellipse(ctx, 0, 0, 9, 9);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  });
}

// A little globe for the city pill (opens the world map).
export function globeIcon(scene: Phaser.Scene): string {
  return paintTexture(scene, 'icon-globe', 60, 60, (ctx) => {
    ctx.translate(30, 30);
    ctx.fillStyle = 'rgba(40,20,10,0.3)';
    ellipse(ctx, 0, 3, 26, 26);
    ctx.fill();
    ctx.fillStyle = radial(ctx, 0, 0, 2, 26, [
      [0, '#8fe0ff'],
      [1, '#1f7fc0'],
    ], -8, -10);
    ellipse(ctx, 0, 0, 25, 25);
    ctx.fill();
    ctx.fillStyle = '#5cc23a';
    ctx.beginPath();
    ctx.moveTo(-14, -16);
    ctx.quadraticCurveTo(-2, -20, 2, -10);
    ctx.quadraticCurveTo(-4, -2, -12, 2);
    ctx.quadraticCurveTo(-20, -4, -14, -16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, 2);
    ctx.quadraticCurveTo(18, 0, 18, 10);
    ctx.quadraticCurveTo(10, 20, 4, 14);
    ctx.quadraticCurveTo(2, 8, 6, 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff4dc';
    ellipse(ctx, 0, 0, 25, 25);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ellipse(ctx, -9, -12, 8, 4);
    ctx.fill();
  });
}
