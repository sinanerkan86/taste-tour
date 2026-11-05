import Phaser from 'phaser';
import { STYLE_TIERS, styleTier, type SectionId } from '../../core/economy';
import { ROOM_FX_DEPTH, sparkle } from '../fx';
import { CASHIER_DESK, DISHPIT, DOOR, KITCHEN, PASS_SPOTS, ROOM, TABLES, depthScale } from './layout';
import { type Ctx, ART_RES, addArt, css, ellipse, floorShadow, hGradient, paintTexture, radial, roundRect, vGradient } from './paint';
import { type RoomArt, paintTable } from './room';
import type { CityTheme } from './themes';

// Furniture and props that get better as each section levels up (style tiers from core).
// Staff outfits follow the same tiers; RestaurantView handles those.
type Piece = Phaser.GameObjects.Image;
type Builder = (looks: SectionLooks) => Piece[];

const GOLD = 0xd4a437;
const COUNTER_TOP = KITCHEN.counterY - 66;
const DISHPIT_TOP = DISHPIT.counterY - 76;
const DESK_TOP = CASHIER_DESK.y - 66;
const HOOD_LIP = ROOM.top + 96;
const PAN_XS = [673, 763, 853, 943];
const POP_MS = 420;

const ROOM_SECTIONS = ['entrance', 'seating', 'kitchen', 'cashier', 'dishwashing'] as const;
type RoomSection = (typeof ROOM_SECTIONS)[number];

// Builders per section, one per tier (index 0 = tier 1).
const BUILDERS: Record<RoomSection, Builder[]> = {
  kitchen: [(l) => l.counterProps(), (l) => l.copperPans(), (l) => l.heatLamps()],
  seating: [(l) => l.fancyTables(), (l) => l.chairCushions(), (l) => l.tableLamps()],
  entrance: [(l) => l.welcomeSign(), (l) => l.topiaries(), (l) => l.doorLanterns()],
  cashier: [(l) => l.tipJar(), (l) => l.cardTerminal(), (l) => l.deskFlowers()],
  dishwashing: [(l) => l.soap(), (l) => l.plateRack(), (l) => l.steelSplash()],
};

export class SectionLooks {
  private readonly tiers: Record<RoomSection, number> = { entrance: 0, seating: 0, kitchen: 0, cashier: 0, dishwashing: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly theme: CityTheme,
    private readonly art: RoomArt,
  ) {}

  // Brings every section up to the tier its level earns. New pieces pop in when animate is set.
  // Returns the sections that got a new look.
  update(levels: Record<SectionId, number>, animate: boolean): RoomSection[] {
    const changed: RoomSection[] = [];
    for (const id of ROOM_SECTIONS) {
      const target = Math.min(STYLE_TIERS, styleTier(levels[id]));
      while (this.tiers[id] < target) {
        const pieces = BUILDERS[id][this.tiers[id]](this);
        this.tiers[id]++;
        if (animate) pieces.forEach((piece) => this.popIn(piece));
        if (!changed.includes(id)) changed.push(id);
      }
    }
    return changed;
  }

  private popIn(piece: Piece): void {
    const scaleX = piece.scaleX;
    const scaleY = piece.scaleY;
    const alpha = piece.alpha;
    piece.setScale(scaleX * 0.6, scaleY * 0.6).setAlpha(0);
    this.scene.tweens.add({ targets: piece, scaleX, scaleY, alpha, duration: POP_MS, ease: 'Back.easeOut' });
    sparkle(this.scene, piece.x, piece.y - 20, 0xfff3c4, ROOM_FX_DEPTH);
  }

  private image(x: number, y: number, key: string, w: number, h: number, ox: number, oy: number, paint: (ctx: Ctx) => void): Piece {
    return addArt(this.scene, x, y, paintTexture(this.scene, key, w, h, paint), ox, oy);
  }

  private glow(x: number, y: number, radius: number, alpha: number, depth: number): Piece {
    const key = paintTexture(this.scene, 'looks-glow', 100, 100, (ctx) => {
      ctx.fillStyle = radial(ctx, 50, 50, 0, 50, [
        [0, 'rgba(255,214,140,0.9)'],
        [1, 'rgba(255,214,140,0)'],
      ]);
      ctx.fillRect(0, 0, 100, 100);
    });
    const image = addArt(this.scene, x, y, key, 50, 50)
      .setScale((radius / 50) / ART_RES)
      .setAlpha(alpha)
      .setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: image, alpha: alpha * 0.75, duration: 1400 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return image;
  }

  // --- Kitchen ------------------------------------------------------------------------------

  counterProps(): Piece[] {
    const pot = this.image(594, COUNTER_TOP + 2, 'looks-stockpot', 60, 60, 30, 56, paintStockpot).setDepth(KITCHEN.counterY + 2);
    const board = this.image(1032, COUNTER_TOP + 2, 'looks-board', 60, 40, 30, 32, paintCuttingBoard).setDepth(KITCHEN.counterY + 2);
    return [pot, board];
  }

  copperPans(): Piece[] {
    return PAN_XS.map((x, i) =>
      this.image(x, HOOD_LIP, `looks-pan-${i % 2}`, 40, 70, 20, 4, (ctx) => paintHangingPan(ctx, i % 2 === 0)).setDepth(-990),
    );
  }

  heatLamps(): Piece[] {
    const glows = PASS_SPOTS.map((spot) => this.glow(spot.x, spot.y - 6, 46, 0.5, KITCHEN.counterY + 0.5));
    const bell = this.image(PASS_SPOTS[0].x - 52, KITCHEN.counterY + 2, 'looks-bell', 30, 30, 15, 26, paintServiceBell).setDepth(KITCHEN.counterY + 3);
    return [...glows, bell];
  }

  // --- Dining room --------------------------------------------------------------------------

  fancyTables(): Piece[] {
    const key = paintTexture(this.scene, `looks-table-${this.theme.accent.toString(16)}`, 180, 100, (ctx) => paintFancyTable(ctx, this.theme));
    this.art.tables.forEach((table) => table.setTexture(key));
    return this.art.tables;
  }

  chairCushions(): Piece[] {
    const key = paintTexture(this.scene, `looks-cushion-${this.theme.accent.toString(16)}`, 64, 84, (ctx) => paintCushion(ctx, this.theme.accent));
    return this.art.chairs.map((chair) =>
      addArt(this.scene, chair.x, chair.y, key, 32, 80)
        .setScale(chair.scaleX, chair.scaleY)
        .setDepth(chair.depth + 0.1),
    );
  }

  tableLamps(): Piece[] {
    return TABLES.flatMap((t) => {
      const s = depthScale(t.y);
      const x = t.x - 40 * s;
      const y = t.y - 6 * s;
      const lamp = this.image(x, y, 'looks-table-lamp', 30, 50, 15, 46, paintTableLamp).setScale(s / ART_RES).setDepth(t.y + 1.6);
      return [lamp, this.glow(x, y - 30 * s, 60 * s, 0.45, t.y + 1.7)];
    });
  }

  // --- Entrance -----------------------------------------------------------------------------

  welcomeSign(): Piece[] {
    const y = ROOM.bottom - 8;
    return [this.image(205, y, 'looks-aframe', 70, 90, 35, 86, paintAFrame).setScale(depthScale(y) / ART_RES).setDepth(y)];
  }

  topiaries(): Piece[] {
    return [DOOR.y - 60, DOOR.y + 105].map((y) => {
      const s = depthScale(y);
      return this.image(42, y, 'looks-topiary', 80, 150, 40, 146, paintTopiary).setScale((s * 0.9) / ART_RES).setDepth(y);
    });
  }

  doorLanterns(): Piece[] {
    const y = DOOR.y - 250;
    const lantern = this.image(40, y, 'looks-lantern', 40, 70, 8, 6, paintLantern).setDepth(-980);
    return [lantern, this.glow(52, y + 44, 90, 0.55, -979)];
  }

  // --- Cashier ------------------------------------------------------------------------------

  tipJar(): Piece[] {
    return [this.image(CASHIER_DESK.x - 58, DESK_TOP, 'looks-tipjar', 30, 40, 15, 36, paintTipJar).setDepth(CASHIER_DESK.y + 41)];
  }

  cardTerminal(): Piece[] {
    return [this.image(CASHIER_DESK.x + 62, DESK_TOP, 'looks-terminal', 30, 40, 15, 36, paintTerminal).setDepth(CASHIER_DESK.y + 41)];
  }

  deskFlowers(): Piece[] {
    return [this.image(CASHIER_DESK.x - 84, DESK_TOP, 'looks-flowers', 30, 60, 15, 56, paintFlowers).setDepth(CASHIER_DESK.y + 41)];
  }

  // --- Dish pit -----------------------------------------------------------------------------

  soap(): Piece[] {
    return [this.image(DISHPIT.left + 78, DISHPIT_TOP, 'looks-soap', 50, 40, 25, 36, paintSoap).setDepth(DISHPIT.counterY + 2)];
  }

  plateRack(): Piece[] {
    return [this.image((DISHPIT.left + DISHPIT.right) / 2, ROOM.wallBottom - 160, 'looks-rack', 170, 50, 85, 0, paintPlateRack).setDepth(-990)];
  }

  steelSplash(): Piece[] {
    const width = DISHPIT.right - DISHPIT.left;
    return [this.image(DISHPIT.left, ROOM.wallBottom - 166, 'looks-splash', width, 92, 0, 0, (ctx) => paintSteelSplash(ctx, width)).setDepth(-992)];
  }
}

// --- Painters ------------------------------------------------------------------------------

function outline(ctx: Ctx, width = 1.5): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = 'rgba(60,35,20,0.55)';
  ctx.stroke();
}

const steel = (ctx: Ctx, x0: number, x1: number) =>
  hGradient(ctx, x0, x1, [
    [0, '#7d858c'],
    [0.3, '#f2f4f6'],
    [0.6, '#bcc3c9'],
    [1, '#6f777e'],
  ]);

const copper = (ctx: Ctx, x0: number, x1: number) =>
  hGradient(ctx, x0, x1, [
    [0, '#7a3a18'],
    [0.35, '#f0a070'],
    [0.6, '#c06a38'],
    [1, '#6a3010'],
  ]);

// Origin (30, 56): bottom middle.
function paintStockpot(ctx: Ctx): void {
  ctx.translate(30, 56);
  floorShadow(ctx, 2, 0, 24, 5, 0.35);
  ctx.fillStyle = steel(ctx, -20, 20);
  roundRect(ctx, -20, -34, 40, 34, [3, 3, 6, 6]);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = '#6f777e';
  roundRect(ctx, -26, -28, 7, 5, 2);
  ctx.fill();
  roundRect(ctx, 19, -28, 7, 5, 2);
  ctx.fill();
  ctx.fillStyle = steel(ctx, -22, 22);
  ellipse(ctx, 0, -35, 22, 5);
  ctx.fill();
  outline(ctx, 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  [-6, 5].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, -42);
    ctx.bezierCurveTo(x - 5, -48, x + 5, -50, x, -56);
    ctx.stroke();
  });
}

// Origin (30, 32).
function paintCuttingBoard(ctx: Ctx): void {
  ctx.translate(30, 32);
  floorShadow(ctx, 2, 0, 26, 5, 0.3);
  ctx.fillStyle = vGradient(ctx, -10, 0, [
    [0, '#d9a066'],
    [1, '#9a6030'],
  ]);
  roundRect(ctx, -26, -10, 52, 10, 4);
  ctx.fill();
  outline(ctx, 1);
  const veg: [number, number, number, string][] = [
    [-14, -14, 6, '#e8463a'],
    [-3, -13, 5, '#f2a03a'],
    [8, -14, 6, '#5aa03c'],
    [17, -12, 4, '#f2e6a0'],
  ];
  veg.forEach(([x, y, r, c]) => {
    ctx.fillStyle = c;
    ellipse(ctx, x, y, r, r * 0.8);
    ctx.fill();
    outline(ctx, 1);
  });
}

// Origin (20, 4): the hook.
function paintHangingPan(ctx: Ctx, big: boolean): void {
  ctx.translate(20, 4);
  ctx.strokeStyle = '#6a5040';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, 8);
  ctx.stroke();
  const r = big ? 16 : 12;
  const cy = 8 + 22 + r;
  ctx.fillStyle = '#4a2a14';
  roundRect(ctx, -3, 6, 6, 26, 3);
  ctx.fill();
  ctx.fillStyle = copper(ctx, -r, r);
  ellipse(ctx, 0, cy, r, r);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipse(ctx, -r * 0.35, cy - r * 0.35, r * 0.3, r * 0.45);
  ctx.fill();
}

// Origin (15, 26).
function paintServiceBell(ctx: Ctx): void {
  ctx.translate(15, 26);
  ctx.fillStyle = '#5a3a24';
  ellipse(ctx, 0, -2, 12, 3.5);
  ctx.fill();
  ctx.fillStyle = hGradient(ctx, -10, 10, [
    [0, '#9a7a20'],
    [0.35, '#fff0a8'],
    [1, '#8a6a14'],
  ]);
  ctx.beginPath();
  ctx.arc(0, -4, 10, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = '#c8a030';
  ellipse(ctx, 0, -15, 2.5, 2.5);
  ctx.fill();
}

function paintFancyTable(ctx: Ctx, theme: CityTheme): void {
  paintTable(ctx, { ...theme, accent: GOLD });
  // paintTable leaves the context at the table center.
  // Folded napkins and wine glasses at both places.
  [-1, 1].forEach((side) => {
    const x = side * 46;
    ctx.fillStyle = css(theme.accent, 0.1);
    ctx.beginPath();
    ctx.moveTo(x - 9, -6);
    ctx.lineTo(x + 9, -6);
    ctx.lineTo(x, -22);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 1);
    const gx = x + side * 16;
    ctx.fillStyle = 'rgba(230,245,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(gx - 5, -30);
    ctx.lineTo(gx + 5, -30);
    ctx.quadraticCurveTo(gx + 5, -20, gx, -19);
    ctx.quadraticCurveTo(gx - 5, -20, gx - 5, -30);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,20,40,0.8)';
    ctx.beginPath();
    ctx.moveTo(gx - 4, -25);
    ctx.lineTo(gx + 4, -25);
    ctx.quadraticCurveTo(gx + 4, -20, gx, -20);
    ctx.quadraticCurveTo(gx - 4, -20, gx - 4, -25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,220,230,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx, -19);
    ctx.lineTo(gx, -11);
    ctx.moveTo(gx - 4, -10);
    ctx.lineTo(gx + 4, -10);
    ctx.stroke();
  });
}

// Origin (32, 80) like the chair: a padded back and seat in the city's accent velvet.
function paintCushion(ctx: Ctx, accent: number): void {
  ctx.translate(32, 80);
  ctx.fillStyle = vGradient(ctx, -58, -28, [
    [0, css(accent, 0.15)],
    [1, css(accent, -0.3)],
  ]);
  roundRect(ctx, -15, -58, 30, 30, 7);
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, -11, -55, 14, 4, 2);
  ctx.fill();
  ctx.fillStyle = css(accent, -0.45);
  ellipse(ctx, 0, -43, 1.8, 1.8);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -24, -14, [
    [0, css(accent, 0.1)],
    [1, css(accent, -0.35)],
  ]);
  roundRect(ctx, -26, -24, 52, 9, 4);
  ctx.fill();
}

// Origin (15, 46).
function paintTableLamp(ctx: Ctx): void {
  ctx.translate(15, 46);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ellipse(ctx, 1, 0, 8, 2.5);
  ctx.fill();
  ctx.fillStyle = hGradient(ctx, -3, 3, [
    [0, '#8a6a14'],
    [0.4, '#ffe08a'],
    [1, '#7a5a10'],
  ]);
  ctx.fillRect(-1.5, -24, 3, 24);
  ellipse(ctx, 0, -1, 6, 2);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -40, -22, [
    [0, '#fff4d6'],
    [1, '#f0c870'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-6, -40);
  ctx.lineTo(6, -40);
  ctx.lineTo(11, -22);
  ctx.lineTo(-11, -22);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1);
}

// Origin (35, 86).
function paintAFrame(ctx: Ctx): void {
  ctx.translate(35, 86);
  floorShadow(ctx, 4, 0, 30, 6, 0.35);
  ctx.fillStyle = '#6b3f22';
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.lineTo(-16, -80);
  ctx.lineTo(16, -80);
  ctx.lineTo(26, 0);
  ctx.lineTo(20, 0);
  ctx.lineTo(12, -72);
  ctx.lineTo(-12, -72);
  ctx.lineTo(-20, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -72, -14, [
    [0, '#34403a'],
    [1, '#222b26'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-12, -72);
  ctx.lineTo(12, -72);
  ctx.lineTo(18, -14);
  ctx.lineTo(-18, -14);
  ctx.closePath();
  ctx.fill();
  // Chalk fork and knife with a little star.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -58);
  ctx.lineTo(-6, -26);
  ctx.moveTo(-9, -58);
  ctx.lineTo(-9, -50);
  ctx.moveTo(-3, -58);
  ctx.lineTo(-3, -50);
  ctx.moveTo(-9, -50);
  ctx.quadraticCurveTo(-6, -46, -3, -50);
  ctx.moveTo(6, -26);
  ctx.lineTo(6, -58);
  ctx.quadraticCurveTo(11, -50, 6, -42);
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ellipse(ctx, 0, -66, 2.5, 2.5);
  ctx.fill();
}

// Origin (40, 146): a clipped bay tree in a pot.
function paintTopiary(ctx: Ctx): void {
  ctx.translate(40, 146);
  floorShadow(ctx, 4, 0, 30, 7, 0.35);
  ctx.fillStyle = hGradient(ctx, -4, 4, [
    [0, '#4a2a14'],
    [0.5, '#9a6038'],
    [1, '#3d2210'],
  ]);
  ctx.fillRect(-3, -110, 6, 80);
  [
    [0, -112, 30],
    [0, -62, 20],
  ].forEach(([x, y, r]) => {
    ctx.fillStyle = radial(ctx, x, y, 2, r, [
      [0, '#8fd06a'],
      [0.6, '#4a9a3a'],
      [1, '#2a6a24'],
    ], x - r * 0.35, y - r * 0.4);
    ellipse(ctx, x, y, r, r);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      ellipse(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, 3, 2);
      ctx.fill();
    }
  });
  ctx.fillStyle = vGradient(ctx, -36, 0, [
    [0, '#e8e2d6'],
    [1, '#a8a196'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-22, -36);
  ctx.lineTo(22, -36);
  ctx.lineTo(16, 0);
  ctx.lineTo(-16, 0);
  ctx.closePath();
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = '#d0c9bc';
  roundRect(ctx, -25, -40, 50, 8, 3);
  ctx.fill();
}

// Origin (8, 6): bracket on the door frame.
function paintLantern(ctx: Ctx): void {
  ctx.translate(8, 6);
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(16, 0);
  ctx.lineTo(16, 10);
  ctx.stroke();
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.moveTo(4, 18);
  ctx.lineTo(28, 18);
  ctx.lineTo(16, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = radial(ctx, 16, 32, 0, 12, [
    [0, '#fffbe0'],
    [0.6, '#ffd36a'],
    [1, '#e09a2a'],
  ]);
  ctx.fillRect(7, 18, 18, 26);
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 2;
  ctx.strokeRect(7, 18, 18, 26);
  ctx.beginPath();
  ctx.moveTo(16, 18);
  ctx.lineTo(16, 44);
  ctx.stroke();
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(5, 44, 22, 4);
}

// Origin (15, 36).
function paintTipJar(ctx: Ctx): void {
  ctx.translate(15, 36);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ellipse(ctx, 1, 0, 11, 3);
  ctx.fill();
  ctx.fillStyle = '#f2c94c';
  [-4, 3, -1, 5, -6].forEach((x, i) => {
    ellipse(ctx, x, -3 - i * 3, 4, 1.8);
    ctx.fill();
  });
  ctx.fillStyle = hGradient(ctx, -10, 10, [
    [0, 'rgba(160,210,230,0.45)'],
    [0.35, 'rgba(255,255,255,0.75)'],
    [1, 'rgba(120,170,190,0.45)'],
  ]);
  roundRect(ctx, -10, -26, 20, 26, 5);
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = '#9a7a40';
  roundRect(ctx, -11, -29, 22, 4, 2);
  ctx.fill();
}

// Origin (15, 36).
function paintTerminal(ctx: Ctx): void {
  ctx.translate(15, 36);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ellipse(ctx, 1, 0, 11, 3);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -30, 0, [
    [0, '#4a4f55'],
    [1, '#1e2023'],
  ]);
  roundRect(ctx, -9, -30, 18, 30, 4);
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = '#7ad8ff';
  roundRect(ctx, -6, -27, 12, 8, 2);
  ctx.fill();
  ctx.fillStyle = '#9aa1a8';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.fillRect(-6 + c * 4.5, -16 + r * 4.5, 3, 3);
}

// Origin (15, 56).
function paintFlowers(ctx: Ctx): void {
  ctx.translate(15, 56);
  ctx.strokeStyle = '#4a8c3a';
  ctx.lineWidth = 2;
  [
    [-7, -44],
    [0, -50],
    [7, -42],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.quadraticCurveTo(x * 0.5, (y - 18) / 2, x, y);
    ctx.stroke();
  });
  [
    [-7, -44, '#ec7aa6'],
    [0, -50, '#ffd34d'],
    [7, -42, '#e8463a'],
  ].forEach(([x, y, c]) => {
    ctx.fillStyle = c as string;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ellipse(ctx, (x as number) + Math.cos(a) * 3.5, (y as number) + Math.sin(a) * 3.5, 3, 3);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3c4';
    ellipse(ctx, x as number, y as number, 2, 2);
    ctx.fill();
  });
  ctx.fillStyle = hGradient(ctx, -7, 7, [
    [0, '#2f6f8b'],
    [0.4, '#7ac0da'],
    [1, '#235a70'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-5, -20);
  ctx.lineTo(5, -20);
  ctx.quadraticCurveTo(9, -8, 6, 0);
  ctx.lineTo(-6, 0);
  ctx.quadraticCurveTo(-9, -8, -5, -20);
  ctx.fill();
  outline(ctx, 1);
}

// Origin (25, 36).
function paintSoap(ctx: Ctx): void {
  ctx.translate(25, 36);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ellipse(ctx, 0, 0, 20, 3);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -28, 0, [
    [0, '#7ad87a'],
    [1, '#2f8f4a'],
  ]);
  roundRect(ctx, -16, -24, 14, 24, 4);
  ctx.fill();
  outline(ctx, 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-12, -32, 6, 8);
  ctx.fillRect(-12, -32, 12, 3);
  ctx.fillStyle = vGradient(ctx, -10, 0, [
    [0, '#ffe066'],
    [1, '#d9a21b'],
  ]);
  roundRect(ctx, 2, -10, 18, 10, 3);
  ctx.fill();
  ctx.fillStyle = '#3a8f4a';
  ctx.fillRect(2, -10, 18, 3);
  [
    [8, -16, 4],
    [15, -20, 3],
  ].forEach(([x, y, r]) => {
    ctx.fillStyle = 'rgba(230,248,255,0.8)';
    ellipse(ctx, x, y, r, r);
    ctx.fill();
  });
}

// Origin (85, 0): top middle. A wooden rack with plates standing in it.
function paintPlateRack(ctx: Ctx): void {
  ctx.translate(85, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(-76, 40, 156, 6);
  for (let i = 0; i < 9; i++) {
    const x = -64 + i * 16;
    ctx.fillStyle = vGradient(ctx, 8, 40, [
      [0, '#ffffff'],
      [1, '#cfd6db'],
    ]);
    ellipse(ctx, x, 24, 7, 17);
    ctx.fill();
    outline(ctx, 1);
    ctx.strokeStyle = css(i % 2 === 0 ? 0x1f6f8b : 0xc0392b, 0, 0.6);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, 24, 4.5, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = vGradient(ctx, 32, 42, [
    [0, '#b07a48'],
    [1, '#6b3f22'],
  ]);
  roundRect(ctx, -80, 32, 160, 10, 3);
  ctx.fill();
  ctx.fillRect(-80, 6, 6, 36);
  ctx.fillRect(74, 6, 6, 36);
}

function paintSteelSplash(ctx: Ctx, width: number): void {
  ctx.fillStyle = hGradient(ctx, 0, width, [
    [0, '#8e959c'],
    [0.25, '#e4e8eb'],
    [0.5, '#b5bcc2'],
    [0.8, '#eef1f3'],
    [1, '#8a9198'],
  ]);
  ctx.fillRect(0, 0, width, 92);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 58) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 92);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, 0, width, 3);
}
