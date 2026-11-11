import Phaser from 'phaser';
import type { SectionId } from '../../core/economy';
import { type Ctx, css, ellipse, hGradient, paintTexture, radial, roundRect, shade, vGradient } from '../view/paint';

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
  | 'hotdog'
  | 'skewer'
  | 'flatbread'
  | 'boat'
  | 'toast'
  | 'pasta'
  | 'cake'
  | 'croissant'
  | 'ramekin'
  | 'rolls'
  | 'drop'
  | 'sticks'
  | 'ring';

const GREEN = 0x5aa03c;
const RED = 0xd8452b;
const CREAM = 0xf3e6cc;

// Shape and colors (main food color, accent) for every dish id across all cities.
const DISHES: Record<string, [DishShape, number, number]> = {
  // Istanbul
  doner: ['wrap', 0x9a5a32, GREEN],
  lahmacun: ['flatbread', 0xb8452a, GREEN],
  pide: ['boat', 0xa0522d, 0xf6e27a],
  kofte: ['skewer', 0x7a3e22, GREEN],
  manti: ['dip', 0xf6f0e2, RED],
  iskender: ['plate', 0x8a4a2a, RED],
  baklava: ['layers', 0xe0a840, GREEN],
  // Rome
  bruschetta: ['toast', 0xd8452b, GREEN],
  pizza: ['slice', 0xe8b04a, 0xc0392b],
  carbonara: ['pasta', 0xf2d98a, 0x8a5a32],
  lasagna: ['layers', 0xe2a24a, 0xc0392b],
  risotto: ['plate', 0xf0e2b0, GREEN],
  ossobuco: ['plate', 0x7a3a22, 0xf0a040],
  tiramisu: ['cake', 0x7a4a2a, CREAM],
  // Paris
  croissant: ['croissant', 0xe0a040, 0xf6d27a],
  crepe: ['slice', 0xf2d79a, 0x6b3a1e],
  croqueMonsieur: ['toast', 0xf6d27a, 0xe8a0a0],
  quiche: ['cake', 0xf2cf6a, GREEN],
  ratatouille: ['pan', 0xc0392b, 0xf0c040],
  coqAuVin: ['bowl', 0x7a2a2a, 0xf0a060],
  cremeBrulee: ['ramekin', 0xe8b050, 0xffffff],
  // Cairo
  falafel: ['balls', 0x9a6a2e, GREEN],
  foulMedames: ['dip', 0xa86a3a, GREEN],
  koshari: ['bowl', 0xc0603a, 0xf6e2a0],
  shawarma: ['wrap', 0xb06a3a, CREAM],
  mahshi: ['rolls', 0x6a8a3a, 0x4a6a2a],
  fattah: ['plate', 0xf0e0b8, 0xb8452a],
  omAli: ['ramekin', 0xf0d8a0, 0x8a5a2a],
  // Mumbai
  samosa: ['dumpling', 0xd9993a, GREEN],
  pavBhaji: ['dip', 0xd8602b, GREEN],
  masalaDosa: ['rolls', 0xe0a850, 0xc07a2a],
  butterChicken: ['bowl', 0xe0782b, 0xf7f0e0],
  tandoori: ['skewer', 0xc8402a, GREEN],
  biryani: ['plate', 0xf0c040, 0x8a4a2a],
  gulabJamun: ['balls', 0x7a3a1a, 0xf0c040],
  // Bangkok
  springRolls: ['rolls', 0xe8b050, GREEN],
  satay: ['skewer', 0xb8702a, 0xf0d070],
  somTam: ['plate', 0x9ac860, RED],
  padThai: ['plate', 0xf0c070, RED],
  tomYum: ['bowl', 0xe8602b, GREEN],
  greenCurry: ['bowl', 0x8ab040, 0xf7f0e0],
  mangoStickyRice: ['plate', 0xf6f0e2, 0xf0b020],
  // Tokyo
  gyoza: ['dumpling', 0xe8c48a, 0x9a5a32],
  ramen: ['bowl', 0xe8b878, 0xf4e2a0],
  tempura: ['fried', 0xf1c86a, 0xf08a5a],
  tonkatsu: ['toast', 0xc8862a, 0x9ac860],
  sukiyaki: ['pan', 0x9a4a3a, GREEN],
  sushi: ['sushi', 0xf07b5a, 0x223322],
  mochi: ['balls', 0xf6b6c8, 0xf6f0e2],
  // Rio de Janeiro
  paoDeQueijo: ['balls', 0xf0c870, 0xf6e2a0],
  coxinha: ['drop', 0xd8903a, GREEN],
  acai: ['bowl', 0x5a2a5a, 0xf0c040],
  moqueca: ['pan', 0xe8702b, GREEN],
  feijoada: ['bowl', 0x3a2420, 0xf0e8d8],
  churrasco: ['skewer', 0x8a3a22, 0xf0a040],
  brigadeiro: ['balls', 0x4a2818, 0xf0a0c0],
  // Mexico City
  taco: ['taco', 0xe7b453, GREEN],
  quesadilla: ['slice', 0xf0c060, 0xf6a020],
  guacamole: ['dip', 0x7ab040, RED],
  tamales: ['rolls', 0xf0d890, 0xc0a060],
  enchiladas: ['rolls', 0xc8402a, 0xf6f0e2],
  mole: ['plate', 0x5a2e1e, 0xf0e8d8],
  churros: ['sticks', 0xd89a40, 0x6b3a1e],
  // New York
  hotDog: ['hotdog', 0xc0502a, 0xf2c94c],
  bagel: ['ring', 0xd8a050, 0xf6f0e2],
  burger: ['burger', 0x6b3a1e, GREEN],
  buffaloWings: ['fried', 0xd8602b, 0xf6f0e2],
  pastrami: ['burger', 0xc8606a, 0xf0d070],
  steak: ['plate', 0x7a3a22, GREEN],
  cheesecake: ['cake', 0xf6e6c0, 0xc0243e],
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
  // Grilled pieces on a skewer.
  skewer: (ctx, main, accent) => {
    plateUnder(ctx, 16, 28);
    ctx.rotate(-0.45);
    ctx.fillStyle = '#b0b4b8';
    roundRect(ctx, -30, -1.5, 60, 3, 1.5);
    ctx.fill();
    [-16, 0, 16].forEach((x) => {
      roundRect(ctx, x - 8, -8, 16, 16, 6);
      fill(ctx, main, -8, 8);
      outline(ctx, 1.5);
      ctx.strokeStyle = css(main, -0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 4, -6);
      ctx.lineTo(x - 4, 6);
      ctx.moveTo(x + 3, -6);
      ctx.lineTo(x + 3, 6);
      ctx.stroke();
    });
    dots(ctx, accent, [[-8, 10], [8, -10], [22, 9]], 3);
  },
  // A round thin bread with a topping, seen from above.
  flatbread: (ctx, main, accent) => {
    ellipse(ctx, 0, 2, 26, 22);
    fill(ctx, 0xe8b868, -20, 24);
    outline(ctx);
    ellipse(ctx, 0, 2, 21, 17);
    fill(ctx, main, -15, 19);
    dots(ctx, shade(main, -0.3), [[-8, -4], [6, 8], [10, -6], [-4, 10]], 2.5);
    dots(ctx, accent, [[-10, 6], [4, -8], [12, 4], [0, 2]], 3);
    ctx.fillStyle = '#f6e2a0';
    ellipse(ctx, -2, -2, 5, 2.5);
    ctx.fill();
  },
  // An oval bread boat, open in the middle.
  boat: (ctx, main, accent) => {
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.quadraticCurveTo(0, -20, 30, 0);
    ctx.quadraticCurveTo(0, 20, -30, 0);
    ctx.closePath();
    fill(ctx, 0xe0a050, -14, 14);
    outline(ctx);
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.quadraticCurveTo(0, -11, 20, 0);
    ctx.quadraticCurveTo(0, 11, -20, 0);
    ctx.closePath();
    fill(ctx, main, -8, 8);
    ctx.fillStyle = css(accent);
    ellipse(ctx, 0, 0, 6, 4);
    ctx.fill();
    ctx.fillStyle = '#e8a020';
    ellipse(ctx, 0, 0, 3, 2);
    ctx.fill();
  },
  // A slice of bread or a breaded cutlet with something on top.
  toast: (ctx, main, accent) => {
    plateUnder(ctx, 16, 28);
    ctx.rotate(-0.15);
    roundRect(ctx, -22, -14, 44, 26, 8);
    fill(ctx, 0xd8a050, -14, 12);
    outline(ctx);
    roundRect(ctx, -18, -11, 36, 19, 6);
    fill(ctx, main, -11, 8);
    ctx.strokeStyle = 'rgba(60,35,20,0.35)';
    ctx.lineWidth = 1.5;
    [-6, 6].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x - 3, 7);
      ctx.stroke();
    });
    dots(ctx, accent, [[-12, -4], [2, -6], [12, 1], [-4, 3]], 3);
  },
  // Noodles twirled on a plate.
  pasta: (ctx, main, accent) => {
    plateUnder(ctx, 10, 28);
    ellipse(ctx, 0, 0, 20, 13);
    fill(ctx, main, -13, 13);
    outline(ctx, 1.5);
    ctx.strokeStyle = css(main, -0.25);
    ctx.lineWidth = 2;
    [6, 11, 16].forEach((r) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.6, 0, 0.4, Math.PI * 1.7);
      ctx.stroke();
    });
    dots(ctx, accent, [[-8, -4], [7, 3], [2, -7]], 2.5);
    dots(ctx, 0xffffff, [[-3, 5], [10, -4]], 1.8);
  },
  // A wedge of cake or tart.
  cake: (ctx, main, accent) => {
    plateUnder(ctx, 16);
    ctx.beginPath();
    ctx.moveTo(-22, -2);
    ctx.lineTo(16, -14);
    ctx.lineTo(16, 4);
    ctx.lineTo(-22, 16);
    ctx.closePath();
    fill(ctx, main, -14, 16);
    outline(ctx);
    ctx.fillStyle = css(main, 0.3);
    ctx.beginPath();
    ctx.moveTo(-22, -2);
    ctx.lineTo(16, -14);
    ctx.lineTo(24, -8);
    ctx.lineTo(-14, 4);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 1.5);
    ctx.fillStyle = '#d8a050';
    ctx.beginPath();
    ctx.moveTo(-22, 12);
    ctx.lineTo(16, 0);
    ctx.lineTo(16, 4);
    ctx.lineTo(-22, 16);
    ctx.closePath();
    ctx.fill();
    dots(ctx, accent, [[-4, -4], [8, -8], [-12, 0]], 3.5);
  },
  croissant: (ctx, main, accent) => {
    plateUnder(ctx, 16, 28);
    const parts: [number, number, number][] = [
      [-20, 6, 8],
      [-11, -2, 11],
      [0, -6, 13],
      [11, -2, 11],
      [20, 6, 8],
    ];
    parts.forEach(([x, y, r], i) => {
      ctx.fillStyle = radial(ctx, x, y, 1, r + 2, [
        [0, css(i === 2 ? accent : main, 0.25)],
        [1, css(main, -0.2)],
      ], x - 3, y - 4);
      ellipse(ctx, x, y, r, r * 0.85);
      ctx.fill();
      outline(ctx, 1.5);
    });
  },
  // A small round baking dish with a caramel or nut top.
  ramekin: (ctx, main, accent) => {
    ctx.beginPath();
    ctx.moveTo(-24, -4);
    ctx.lineTo(-20, 18);
    ctx.quadraticCurveTo(0, 24, 20, 18);
    ctx.lineTo(24, -4);
    ctx.closePath();
    ctx.fillStyle = hGradient(ctx, -24, 24, [
      [0, '#ffffff'],
      [1, '#c8d0d6'],
    ]);
    ctx.fill();
    outline(ctx);
    ctx.strokeStyle = 'rgba(120,130,140,0.5)';
    ctx.lineWidth = 1.5;
    for (let x = -16; x <= 16; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x * 0.9, 18);
      ctx.stroke();
    }
    ellipse(ctx, 0, -4, 24, 9);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    outline(ctx, 1.5);
    ellipse(ctx, 0, -4, 20, 7);
    fill(ctx, main, -11, 3);
    dots(ctx, accent, [[-8, -5], [5, -3], [10, -6]], 2.2);
  },
  // Rolled food lying side by side.
  rolls: (ctx, main, accent) => {
    plateUnder(ctx, 16, 28);
    [-14, 0, 14].forEach((x, i) => {
      ctx.save();
      ctx.translate(x, 2 - i * 2);
      ctx.rotate(-0.5);
      roundRect(ctx, -6, -16, 12, 30, 6);
      fill(ctx, main, -16, 14);
      outline(ctx, 1.5);
      ctx.strokeStyle = css(accent);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, -4);
      ctx.lineTo(5, -8);
      ctx.moveTo(-5, 6);
      ctx.lineTo(5, 2);
      ctx.stroke();
      ctx.restore();
    });
  },
  // A drop-shaped fried snack.
  drop: (ctx, main, accent) => {
    plateUnder(ctx, 16);
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.bezierCurveTo(6, -12, 20, 0, 18, 8);
    ctx.quadraticCurveTo(14, 18, 0, 18);
    ctx.quadraticCurveTo(-14, 18, -18, 8);
    ctx.bezierCurveTo(-20, 0, -6, -12, 0, -22);
    ctx.closePath();
    fill(ctx, main, -22, 18);
    outline(ctx);
    dots(ctx, shade(main, -0.25), [[-6, 2], [5, -4], [7, 9], [-8, 11], [0, 6]], 1.6);
    dots(ctx, accent, [[16, 14], [-18, 14]], 3);
  },
  // Long fried sticks with a dipping cup.
  sticks: (ctx, main, accent) => {
    [-14, -4, 6].forEach((x, i) => {
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(0.35 - i * 0.2);
      roundRect(ctx, -4.5, -24, 9, 44, 4.5);
      fill(ctx, main, -24, 20);
      outline(ctx, 1.5);
      ctx.strokeStyle = css(main, -0.3);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-1.5, -20);
      ctx.lineTo(-1.5, 16);
      ctx.moveTo(1.5, -20);
      ctx.lineTo(1.5, 16);
      ctx.stroke();
      dots(ctx, 0xfff6e0, [[-2, -12], [2, -2], [-1, 8]], 1.2);
      ctx.restore();
    });
    ellipse(ctx, 18, 14, 10, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    roundRect(ctx, 8, 14, 20, 10, [0, 0, 5, 5]);
    ctx.fill();
    outline(ctx, 1.5);
    ellipse(ctx, 18, 14, 8, 3);
    fill(ctx, accent, 11, 17);
  },
  // A ring-shaped bread cut open with a filling.
  ring: (ctx, main, accent) => {
    plateUnder(ctx, 16, 28);
    ellipse(ctx, 0, 2, 24, 16);
    fill(ctx, main, -14, 18);
    outline(ctx);
    ctx.fillStyle = css(accent);
    roundRect(ctx, -24, 0, 48, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ellipse(ctx, -4, -6, 12, 5);
    ctx.fill();
    ellipse(ctx, 0, 2, 7, 4);
    ctx.fillStyle = '#e8e2d8';
    ctx.fill();
    outline(ctx, 1.2);
    dots(ctx, 0xfff3d0, [[-14, -4], [-6, -10], [8, -9], [15, -3]], 1.5);
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

// --- Kitchen Lab and franchise perks -------------------------------------------------------

function star5(ctx: Ctx, x: number, y: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// A round-bottomed lab flask with green liquid and bubbles.
function flask(ctx: Ctx, x: number, scale: number, liquid: string): void {
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(-6, -22);
  ctx.lineTo(-6, -6);
  ctx.quadraticCurveTo(-22, 4, -18, 14);
  ctx.quadraticCurveTo(-14, 24, 0, 24);
  ctx.quadraticCurveTo(14, 24, 18, 14);
  ctx.quadraticCurveTo(22, 4, 6, -6);
  ctx.lineTo(6, -22);
  ctx.closePath();
  ctx.fillStyle = 'rgba(235,250,255,0.9)';
  ctx.fill();
  outline(ctx, 2.5);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = liquid;
  ctx.fillRect(-24, 4, 48, 24);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ellipse(ctx, -4, 12, 3, 3);
  ctx.fill();
  ellipse(ctx, 5, 8, 2, 2);
  ctx.fill();
  ctx.fillStyle = '#c98a4a';
  roundRect(ctx, -9, -26, 18, 6, 2);
  ctx.fill();
  ctx.restore();
}

const PROGRESS_GLYPHS: Record<string, [number, Painter]> = {
  // Kitchen Lab tab badge.
  lab: [0x4a8c3a, (ctx) => flask(ctx, 0, 1, '#7ad65a')],
  // Secret Spices: a red chili.
  spices: [
    0xd8452b,
    (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-18, -12);
      ctx.quadraticCurveTo(12, -16, 18, 4);
      ctx.quadraticCurveTo(20, 18, 8, 22);
      ctx.quadraticCurveTo(10, 4, -16, -2);
      ctx.closePath();
      ctx.fillStyle = vGradient(ctx, -14, 22, [
        [0, '#ff5a3c'],
        [1, '#b8261a'],
      ]);
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#5aa03c';
      roundRect(ctx, -24, -16, 10, 8, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ellipse(ctx, 0, -9, 7, 2.5);
      ctx.fill();
    },
  ],
  // Local Suppliers: a wooden crate.
  suppliers: [
    0xb8693d,
    (ctx) => {
      ctx.fillStyle = vGradient(ctx, -18, 18, [
        [0, '#e0a868'],
        [1, '#a8683a'],
      ]);
      roundRect(ctx, -20, -16, 40, 34, 4);
      ctx.fill();
      outline(ctx);
      ctx.strokeStyle = 'rgba(90,50,25,0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-20, -4);
      ctx.lineTo(20, -4);
      ctx.moveTo(-20, 8);
      ctx.lineTo(20, 8);
      ctx.moveTo(-18, -14);
      ctx.lineTo(18, 16);
      ctx.stroke();
    },
  ],
  // Night Shift: a moon and a star.
  nightShift: [
    0x3d4f9a,
    (ctx) => {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(-2, 2, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(8, -4, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff4c0';
      star5(ctx, 14, 10, 7, 3);
      ctx.fill();
    },
  ],
  // Tour Guide: a little guide flag.
  tourGuide: [
    0x2f8fb0,
    (ctx) => {
      ctx.fillStyle = '#6e3e22';
      ctx.fillRect(-14, -22, 4, 44);
      ctx.beginPath();
      ctx.moveTo(-10, -20);
      ctx.lineTo(20, -12);
      ctx.lineTo(-10, -2);
      ctx.closePath();
      ctx.fillStyle = '#ffbe1a';
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#fff';
      star5(ctx, 0, -11, 5, 2);
      ctx.fill();
    },
  ],
  // Event Planner: a lightning bolt (Rush).
  eventPlanner: [
    0xe08e0b,
    (ctx) => {
      ctx.beginPath();
      ctx.moveTo(4, -24);
      ctx.lineTo(-14, 4);
      ctx.lineTo(-1, 4);
      ctx.lineTo(-6, 24);
      ctx.lineTo(14, -6);
      ctx.lineTo(1, -6);
      ctx.closePath();
      ctx.fillStyle = '#fff2a0';
      ctx.fill();
      outline(ctx);
    },
  ],
  // Manager: a clipboard with a check mark.
  manager: [
    0x7b4fa0,
    (ctx) => {
      ctx.fillStyle = '#a0623a';
      roundRect(ctx, -16, -20, 32, 42, 4);
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(-12, -14, 24, 32);
      ctx.fillStyle = '#c9ccd2';
      roundRect(ctx, -8, -24, 16, 8, 3);
      ctx.fill();
      ctx.strokeStyle = '#4a8c3a';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, 2);
      ctx.lineTo(-1, 8);
      ctx.lineTo(8, -4);
      ctx.stroke();
    },
  ],
  // Head Start: an up arrow.
  headStart: [
    0x4a8c3a,
    (ctx) => {
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(20, 0);
      ctx.lineTo(8, 0);
      ctx.lineTo(8, 22);
      ctx.lineTo(-8, 22);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-20, 0);
      ctx.closePath();
      ctx.fillStyle = '#d6ffb8';
      ctx.fill();
      outline(ctx);
    },
  ],
  // Famous Chain: a crown.
  chain: [
    0xc0392b,
    (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-20, 14);
      ctx.lineTo(-22, -12);
      ctx.lineTo(-10, 0);
      ctx.lineTo(0, -18);
      ctx.lineTo(10, 0);
      ctx.lineTo(22, -12);
      ctx.lineTo(20, 14);
      ctx.closePath();
      ctx.fillStyle = vGradient(ctx, -18, 14, [
        [0, '#ffe066'],
        [1, '#e0a00b'],
      ]);
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#e8463a';
      ellipse(ctx, 0, 6, 4, 4);
      ctx.fill();
    },
  ],
  // Brand Value: a star medal.
  brand: [
    0xe0a00b,
    (ctx) => {
      ctx.fillStyle = '#e8463a';
      ctx.beginPath();
      ctx.moveTo(-10, 4);
      ctx.lineTo(-16, 24);
      ctx.lineTo(-6, 20);
      ctx.lineTo(0, 26);
      ctx.lineTo(6, 20);
      ctx.lineTo(16, 24);
      ctx.lineTo(10, 4);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      star5(ctx, 0, -4, 20, 9);
      ctx.fill();
      outline(ctx);
    },
  ],
  // Research Grant: a flask with a coin.
  grant: [
    0x1f6f8b,
    (ctx) => {
      flask(ctx, -4, 0.9, '#7ad65a');
      ctx.fillStyle = '#ffd23a';
      ellipse(ctx, 14, 12, 9, 9);
      ctx.fill();
      outline(ctx);
    },
  ],
  // Second Lab: two flasks.
  secondLab: [
    0x5f8fa6,
    (ctx) => {
      flask(ctx, -10, 0.75, '#7ad65a');
      flask(ctx, 11, 0.75, '#ff8a5a');
    },
  ],
};

// Badges for the Kitchen Lab tab, its research projects, and the franchise perks.
export function progressIcon(scene: Phaser.Scene, id: string): string {
  const [color, glyph] = PROGRESS_GLYPHS[id] ?? PROGRESS_GLYPHS.lab;
  return paintTexture(scene, `icon-progress-${id}`, ICON_SIZE, ICON_SIZE, (ctx) => badge(ctx, color, glyph));
}

// A wrapped gift box for the daily rewards button.
export function giftIcon(scene: Phaser.Scene): string {
  return paintTexture(scene, 'icon-gift', 64, 64, (ctx) => {
    ctx.translate(32, 34);
    ctx.fillStyle = 'rgba(40,20,10,0.3)';
    roundRect(ctx, -22, -8, 44, 34, 6);
    ctx.fill();
    // Box and lid.
    ctx.fillStyle = vGradient(ctx, -6, 26, [
      [0, '#ff6a55'],
      [1, '#c0302a'],
    ]);
    roundRect(ctx, -20, -6, 40, 30, 5);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, -16, -4, [
      [0, '#ff8a70'],
      [1, '#e8463a'],
    ]);
    roundRect(ctx, -24, -16, 48, 13, 5);
    ctx.fill();
    // Ribbon and bow.
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(-5, -16, 10, 40);
    ctx.beginPath();
    ctx.ellipse(-10, -21, 10, 6, -0.5, 0, Math.PI * 2);
    ctx.ellipse(10, -21, 10, 6, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8a800';
    ellipse(ctx, 0, -19, 5, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, -20, -14, 16, 4, 2);
    ctx.fill();
  });
}

// A puffy chef's hat for the chef collection button.
export function chefHatIcon(scene: Phaser.Scene): string {
  return paintTexture(scene, 'icon-chef-hat', 64, 64, (ctx) => {
    ctx.translate(32, 34);
    ctx.fillStyle = 'rgba(40,20,10,0.3)';
    roundRect(ctx, -17, 6, 34, 18, 5);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, -26, 12, [
      [0, '#ffffff'],
      [1, '#d9d4ca'],
    ]);
    ctx.beginPath();
    ctx.arc(-13, -8, 13, 0, Math.PI * 2);
    ctx.arc(0, -15, 15, 0, Math.PI * 2);
    ctx.arc(13, -8, 13, 0, Math.PI * 2);
    ctx.fill();
    roundRect(ctx, -16, -8, 32, 22, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 2;
    [-6, 6].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, -4);
      ctx.lineTo(x, 12);
      ctx.stroke();
    });
    ctx.fillStyle = vGradient(ctx, 12, 22, [
      [0, '#ece7dd'],
      [1, '#bdb6a8'],
    ]);
    roundRect(ctx, -18, 12, 36, 10, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ellipse(ctx, -4, -22, 7, 4);
    ctx.fill();
  });
}

// A striped shopping bag for the shop button.
export function shopIcon(scene: Phaser.Scene): string {
  return paintTexture(scene, 'icon-shop', 64, 64, (ctx) => {
    ctx.translate(32, 34);
    ctx.fillStyle = 'rgba(40,20,10,0.3)';
    roundRect(ctx, -20, -6, 40, 34, 6);
    ctx.fill();
    // Handles.
    ctx.strokeStyle = '#8a4a00';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -10, 11, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = vGradient(ctx, -12, 24, [
      [0, '#ffd23a'],
      [1, '#e89a00'],
    ]);
    roundRect(ctx, -21, -12, 42, 36, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-9, -12, 6, 36);
    ctx.fillRect(5, -12, 6, 36);
    // A star on the bag.
    ctx.fillStyle = '#e8463a';
    star5(ctx, 0, 8, 10, 4.5);
    ctx.fill();
  });
}

// A small chef card (a recipe card with a hat), shown next to card counts.
export function chefCardIcon(scene: Phaser.Scene): string {
  return paintTexture(scene, 'icon-chef-card', 48, 56, (ctx) => {
    ctx.translate(24, 28);
    ctx.rotate(-0.12);
    ctx.fillStyle = 'rgba(40,20,10,0.3)';
    roundRect(ctx, -16, -20, 34, 44, 5);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, -22, 22, [
      [0, '#fff6d8'],
      [1, '#f3d58a'],
    ]);
    roundRect(ctx, -18, -23, 34, 44, 5);
    ctx.fill();
    ctx.strokeStyle = '#c08a20';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-7, -9, 6, 0, Math.PI * 2);
    ctx.arc(-1, -12, 7, 0, Math.PI * 2);
    ctx.arc(5, -9, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-8, -9, 14, 9);
    ctx.fillStyle = '#c0302a';
    roundRect(ctx, -12, 6, 22, 4, 2);
    ctx.fill();
    roundRect(ctx, -12, 13, 15, 4, 2);
    ctx.fill();
  });
}
