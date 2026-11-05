import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { ROOM_FX_DEPTH, sparkle } from '../fx';
import { ROOM, TABLES, depthScale } from './layout';
import {
  type Ctx,
  ART_RES,
  addArt,
  css,
  ellipse,
  floorShadow,
  hGradient,
  paintTexture,
  radial,
  roundRect,
  vGradient,
} from './paint';
import { paintPlant } from './room';
import type { CityTheme } from './themes';

// The restaurant gets nicer as the menu grows: each new dish adds a piece of decor, so the
// player sees their place go from plain to cozy to grand within every city.
// Stage = dishes on the menu (1 = just opened, 7 = full menu).
const LIGHTS_Y = ROOM.top + 6;
const PLANTS = [
  { x: 1034, y: 640, scale: 1 },
  { x: 48, y: 566, scale: 0.85 },
];
const RUG = { backY: 592, frontY: 968, backLeft: 352, backRight: 968, frontLeft: 322, frontRight: 1000 } as const;
const BOARD = { x: 302, y: 381, width: 196, height: 66 } as const;
const CARPET = { left: 0, right: 300, top: 814, bottom: 870 } as const;
const STANCHIONS = [
  { x: 92, y: 806 },
  { x: 252, y: 806 },
  { x: 92, y: 884 },
  { x: 252, y: 884 },
];
const POP_MS = 420;

export class Decor {
  private stage = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly theme: CityTheme,
  ) {}

  // Adds every piece up to `stage`. New pieces pop in when animate is set (a dish was just
  // unlocked), and simply appear when a saved game loads.
  setStage(stage: number, animate: boolean): void {
    while (this.stage < stage) {
      this.stage++;
      const pieces = this.build(this.stage);
      if (animate) pieces.forEach((piece) => this.popIn(piece));
    }
  }

  private build(stage: number): Phaser.GameObjects.Image[] {
    switch (stage) {
      case 2:
        return this.stringLights();
      case 3:
        return this.plants();
      case 4:
        return this.rug();
      case 5:
        return this.chalkboard();
      case 6:
        return this.candles();
      case 7:
        return this.entrance();
      default:
        return [];
    }
  }

  private popIn(piece: Phaser.GameObjects.Image): void {
    const scale = piece.scaleX;
    piece.setScale(scale * 0.6).setAlpha(0);
    this.scene.tweens.add({ targets: piece, scale, alpha: 1, duration: POP_MS, ease: 'Back.easeOut' });
    sparkle(this.scene, piece.x, piece.y - 20, 0xfff3c4, ROOM_FX_DEPTH);
  }

  private key(name: string): string {
    return `decor-${name}-${this.theme.accent.toString(16)}`;
  }

  private stringLights(): Phaser.GameObjects.Image[] {
    const lights = addArt(this.scene, 0, LIGHTS_Y, paintTexture(this.scene, 'decor-lights', GAME_WIDTH, 70, paintStringLights), 0, 0).setDepth(-990);
    // A soft glow layer that breathes slowly.
    const glow = addArt(this.scene, 0, LIGHTS_Y, paintTexture(this.scene, 'decor-lights-glow', GAME_WIDTH, 70, paintLightsGlow), 0, 0)
      .setDepth(-989)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: glow, alpha: 0.45, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return [lights];
  }

  private plants(): Phaser.GameObjects.Image[] {
    return PLANTS.flatMap((p) => {
      const shadow = addArt(this.scene, p.x, p.y, paintTexture(this.scene, 'decor-plant-shadow', 110, 30, paintPlantShadow), 55, 15)
        .setScale(p.scale / ART_RES)
        .setDepth(-990);
      const plant = addArt(this.scene, p.x, p.y, paintTexture(this.scene, 'plant', 110, 150, paintPlant), 55, 146)
        .setScale(p.scale / ART_RES)
        .setDepth(p.y);
      return [shadow, plant];
    });
  }

  private rug(): Phaser.GameObjects.Image[] {
    const key = paintTexture(this.scene, this.key('rug'), GAME_WIDTH, RUG.frontY - RUG.backY + 40, (ctx) => paintRug(ctx, this.theme));
    const rug = addArt(this.scene, GAME_WIDTH / 2, (RUG.backY + RUG.frontY) / 2, key, GAME_WIDTH / 2, (RUG.frontY - RUG.backY) / 2);
    return [rug.setDepth(-990)];
  }

  private chalkboard(): Phaser.GameObjects.Image[] {
    const key = paintTexture(this.scene, 'decor-board', BOARD.width + 16, BOARD.height + 16, paintChalkboard);
    return [addArt(this.scene, BOARD.x - 8, BOARD.y - 8, key, 0, 0).setDepth(-995)];
  }

  private candles(): Phaser.GameObjects.Image[] {
    const key = paintTexture(this.scene, 'decor-candle', 40, 60, paintCandle);
    return TABLES.map((t) => {
      const s = depthScale(t.y);
      const candle = addArt(this.scene, t.x + 22 * s, t.y - 6 * s, key, 20, 50)
        .setScale(s / ART_RES)
        .setDepth(t.y + 1.5);
      // Flicker.
      this.scene.tweens.add({
        targets: candle,
        alpha: { from: 1, to: 0.82 },
        duration: 160 + Math.random() * 120,
        yoyo: true,
        repeat: -1,
      });
      return candle;
    });
  }

  private entrance(): Phaser.GameObjects.Image[] {
    const carpetKey = paintTexture(this.scene, 'decor-carpet', CARPET.right - CARPET.left, CARPET.bottom - CARPET.top + 8, paintCarpet);
    const carpet = addArt(this.scene, CARPET.left, CARPET.top, carpetKey, 0, 0).setDepth(-990);
    // Brass posts with velvet ropes: the back pair behind people walking in, the front pair in front.
    const ropeKey = paintTexture(this.scene, 'decor-rope', 180, 70, paintRopeLine);
    const back = addArt(this.scene, STANCHIONS[0].x - 10, STANCHIONS[0].y, ropeKey, 0, 60).setDepth(STANCHIONS[0].y).setScale(depthScale(806) / ART_RES);
    const front = addArt(this.scene, STANCHIONS[2].x - 10, STANCHIONS[2].y, ropeKey, 0, 60).setDepth(STANCHIONS[2].y).setScale(depthScale(884) / ART_RES);
    return [carpet, back, front];
  }
}

// --- Painters ----------------------------------------------------------------------------

const BULB_COLORS = ['#ffd98a', '#ffb36b', '#fff1c4'];

function lightsCurve(x: number): number {
  // A rope sagging between hooks every 270 px.
  const span = 270;
  const t = (x % span) / span;
  return 14 + Math.sin(t * Math.PI) * 22;
}

function paintStringLights(ctx: Ctx): void {
  ctx.strokeStyle = '#3a2a1e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= GAME_WIDTH; x += 6) {
    if (x === 0) ctx.moveTo(x, lightsCurve(x));
    else ctx.lineTo(x, lightsCurve(x));
  }
  ctx.stroke();
  for (let i = 0, x = 22; x < GAME_WIDTH; i++, x += 45) {
    const y = lightsCurve(x) + 6;
    ctx.fillStyle = '#4a3a2e';
    ctx.fillRect(x - 2.5, y - 6, 5, 5);
    ctx.fillStyle = radial(ctx, x, y + 5, 0, 7, [
      [0, '#ffffff'],
      [0.4, BULB_COLORS[i % BULB_COLORS.length]],
      [1, css(0xe08e0b, -0.2)],
    ], x - 2, y + 2);
    ellipse(ctx, x, y + 5, 5, 7);
    ctx.fill();
  }
}

function paintLightsGlow(ctx: Ctx): void {
  for (let x = 22; x < GAME_WIDTH; x += 45) {
    const y = lightsCurve(x) + 11;
    ctx.fillStyle = radial(ctx, x, y, 0, 26, [
      [0, 'rgba(255,200,120,0.55)'],
      [1, 'rgba(255,200,120,0)'],
    ]);
    ctx.fillRect(x - 26, y - 26, 52, 52);
  }
}

function paintPlantShadow(ctx: Ctx): void {
  floorShadow(ctx, 59, 15, 44, 12, 0.35);
}

// Texture origin: the rug's center; the rug is a trapezoid narrowing toward the back.
function paintRug(ctx: Ctx, theme: CityTheme): void {
  const height = RUG.frontY - RUG.backY;
  ctx.translate(GAME_WIDTH / 2, height / 2);
  const back = -height / 2;
  const front = height / 2;
  const cx = GAME_WIDTH / 2;
  const shape = (inset: number) => {
    const k = inset / height;
    ctx.beginPath();
    ctx.moveTo(RUG.backLeft - cx + inset, back + inset * 0.6);
    ctx.lineTo(RUG.backRight - cx - inset, back + inset * 0.6);
    ctx.lineTo(RUG.frontRight - cx - inset * (1 + k), front - inset);
    ctx.lineTo(RUG.frontLeft - cx + inset * (1 + k), front - inset);
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(30,15,5,0.3)';
  ctx.save();
  ctx.translate(4, 8);
  shape(0);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = vGradient(ctx, back, front, [
    [0, css(theme.accent, -0.35)],
    [1, css(theme.accent, -0.15)],
  ]);
  shape(0);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, back, front, [
    [0, css(0xf3e6d0, -0.25)],
    [1, css(0xf3e6d0, -0.05)],
  ]);
  shape(16);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, back, front, [
    [0, css(theme.accent, -0.2)],
    [1, css(theme.accent, 0)],
  ]);
  shape(26);
  ctx.fill();
  // Diamond pattern in the middle field.
  ctx.save();
  shape(40);
  ctx.clip();
  ctx.strokeStyle = css(0xf3e6d0, 0, 0.35);
  ctx.lineWidth = 3;
  for (let x = -700; x < 700; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, back);
    ctx.lineTo(x + height * 0.6, front);
    ctx.moveTo(x + height * 0.6, back);
    ctx.lineTo(x, front);
    ctx.stroke();
  }
  ctx.restore();
  // The tables' shadows fall on the rug too.
  TABLES.forEach((t) => {
    const s = depthScale(t.y);
    floorShadow(ctx, t.x - cx + 6, t.y + 46 * s - (RUG.backY + height / 2), 100 * s, 24 * s, 0.38);
  });
}

function paintChalkboard(ctx: Ctx): void {
  const { width, height } = BOARD;
  ctx.translate(8, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -2, 2, width + 8, height + 8, 6);
  ctx.fill();
  ctx.fillStyle = hGradient(ctx, -6, width + 6, [
    [0, '#8a5530'],
    [0.5, '#b07040'],
    [1, '#6b3f22'],
  ]);
  roundRect(ctx, -6, -6, width + 12, height + 12, 6);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, 0, height, [
    [0, '#2f3b34'],
    [1, '#1f2924'],
  ]);
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MENU', width / 2, 22);
  // Chalk scribbles for the dishes, with dotted lines to the prices.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  [34, 46, 58].forEach((y, i) => {
    ctx.beginPath();
    for (let x = 20; x < 90 + i * 8; x += 8) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 2, y - 3, x + 5, y);
    }
    ctx.stroke();
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(104 + i * 8, y);
    ctx.lineTo(160, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(172, y - 2, 4, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// Texture origin: the bottom middle of the glass (20, 50).
function paintCandle(ctx: Ctx): void {
  ctx.translate(20, 50);
  ctx.fillStyle = radial(ctx, 0, -22, 0, 20, [
    [0, 'rgba(255,210,120,0.6)'],
    [1, 'rgba(255,210,120,0)'],
  ]);
  ctx.fillRect(-20, -42, 40, 40);
  ctx.fillStyle = hGradient(ctx, -8, 8, [
    [0, 'rgba(200,120,60,0.8)'],
    [0.4, 'rgba(255,220,170,0.95)'],
    [1, 'rgba(180,100,50,0.8)'],
  ]);
  roundRect(ctx, -8, -14, 16, 14, 3);
  ctx.fill();
  ctx.fillStyle = radial(ctx, 0, -20, 0, 6, [
    [0, '#ffffff'],
    [0.5, '#ffd34d'],
    [1, 'rgba(255,140,40,0)'],
  ]);
  ellipse(ctx, 0, -20, 3.5, 7);
  ctx.fill();
}

function paintCarpet(ctx: Ctx): void {
  const w = CARPET.right - CARPET.left;
  const h = CARPET.bottom - CARPET.top;
  ctx.fillStyle = 'rgba(30,15,5,0.3)';
  ctx.fillRect(0, 6, w, h);
  ctx.fillStyle = hGradient(ctx, 0, w, [
    [0, '#7a1420'],
    [0.5, '#b8243a'],
    [1, 'rgba(184,36,58,0.85)'],
  ]);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e0b04a';
  ctx.fillRect(0, 4, w, 3);
  ctx.fillRect(0, h - 7, w, 3);
}

// One rope between two brass posts 160 px apart. Texture origin: left post's foot (10, 60).
function paintRopeLine(ctx: Ctx): void {
  ctx.translate(10, 60);
  const post = (x: number) => {
    ctx.fillStyle = 'rgba(30,15,5,0.3)';
    ellipse(ctx, x + 2, 0, 12, 4);
    ctx.fill();
    ctx.fillStyle = hGradient(ctx, x - 4, x + 4, [
      [0, '#8a6a1e'],
      [0.4, '#ffe08a'],
      [1, '#7a5a14'],
    ]);
    ctx.fillRect(x - 3.5, -46, 7, 44);
    ctx.fillStyle = radial(ctx, x, -48, 0, 7, [
      [0, '#fff3c4'],
      [1, '#a07a20'],
    ], x - 2, -50);
    ctx.beginPath();
    ctx.arc(x, -48, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a07a20';
    ellipse(ctx, x, -2, 9, 3);
    ctx.fill();
  };
  ctx.strokeStyle = '#9a1c2c';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.quadraticCurveTo(80, -14, 160, -44);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(2, -46);
  ctx.quadraticCurveTo(80, -17, 158, -46);
  ctx.stroke();
  post(0);
  post(160);
}
