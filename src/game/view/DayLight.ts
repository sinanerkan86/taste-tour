import Phaser from 'phaser';
import { DAY } from '../../core/economy';
import { GAME_WIDTH } from '../config';
import { AC, BACKDROP_BOTTOM, NEAR_BUILDINGS, TANK } from './terraceArt';
import { DOOR_X, FRONT, ROOF, WORLD } from './layout';
import { type Ctx, addArt, paintTexture, radial, rgba, seeded, vGradient } from './paint';
import { LAMPS } from './street';

// The light of the day over the whole world (GDD 6g). Everything is a few tinted overlays that
// change color slowly, no repainting:
// - multiply layers darken and tint the roof, the room and the street (the room stays brighter at
//   night: its lamps are on);
// - the sky gets a warm glow near the horizon at sunset and a navy layer with stars at night, and
//   the little window in the room's back wall follows the same sky;
// - lamps (street lamps, the name board's lamps, the door, the terrace's string lights) and the
//   windows of the nearby buildings glow after dusk (additive layers above the dark ones).

// Depths: the sky layers sit between the haze and the roof (so only the sky is tinted), the
// multiply layers above every scene object but below the effects, glows on top of them.
const SKY_DEPTH = -990.8;
const MULTIPLY_DEPTH = 6000;
const GLOW_DEPTH = 6100;
const SIDE = 140;

interface Key {
  // Fraction of the day.
  at: number;
  // Multiply colors for the outdoors and the room.
  out: number;
  room: number;
  // Warm sky glow (sunrise and sunset) and night, each 0 to 1.
  warm: number;
  night: number;
}

// The day's light, keyed on the fractions of an older day (morning 0-0.18, lunch to 0.34, afternoon
// to 0.58, dinner to 0.78, night to 1); `lightFraction` maps today's phases onto it, so the sun
// sets over the dinner rush and it is dark when the doors close. The last key wraps into the first.
const KEYS: Key[] = [
  { at: 0, out: 0xa9b8e6, room: 0xd3dcf6, warm: 0.25, night: 0.38 },
  { at: 0.05, out: 0xd6e4ff, room: 0xeef3ff, warm: 0.1, night: 0 },
  { at: 0.18, out: 0xe9f2ff, room: 0xf6f9ff, warm: 0, night: 0 },
  { at: 0.27, out: 0xffffff, room: 0xffffff, warm: 0, night: 0 },
  { at: 0.4, out: 0xfffaf0, room: 0xfffdf8, warm: 0, night: 0 },
  { at: 0.5, out: 0xffeccc, room: 0xfff4e2, warm: 0.12, night: 0 },
  { at: 0.6, out: 0xffd6a0, room: 0xffeacc, warm: 0.5, night: 0 },
  { at: 0.69, out: 0xffae7c, room: 0xffd2ae, warm: 0.95, night: 0.05 },
  { at: 0.77, out: 0xb88aa6, room: 0xe2bccb, warm: 0.6, night: 0.45 },
  { at: 0.83, out: 0x5b69a8, room: 0x9ca4d2, warm: 0.12, night: 0.92 },
  { at: 0.91, out: 0x46568f, room: 0x8f98c6, warm: 0, night: 1 },
  { at: 0.96, out: 0x536398, room: 0x9aa3cf, warm: 0, night: 0.78 },
];

const WARM_SKY = 0xff8a3d;
const NIGHT_SKY = 0x0a1436;
// The window over the dish pit (see room.ts).
const WINDOW = { x: 40, y: 222, width: 190, height: 84 };
const LAMP_TOP_Y = 1015;
const BOARD_LAMPS = [540, 760];

const KEY_PHASE_ENDS = [0.18, 0.34, 0.58, 0.78, 1];

// Maps a fraction of the day (phases from DAY.phases) to the fraction the keys were written for.
function lightFraction(fraction: number): number {
  let start = 0;
  let keyStart = 0;
  for (let i = 0; i < DAY.phases.length; i++) {
    const end = DAY.phases[i].end;
    if (fraction < end || i === DAY.phases.length - 1) {
      return keyStart + ((fraction - start) / (end - start)) * (KEY_PHASE_ENDS[i] - keyStart);
    }
    start = end;
    keyStart = KEY_PHASE_ENDS[i];
  }
  return fraction;
}

export interface LightState {
  // Strength of the lamps 0 to 1 (switched on from dusk to dawn).
  lamps: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixColor(a: number, b: number, t: number): number {
  const channel = (shift: number) => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// The light at a fraction of the day, blended between the two neighbouring keys.
export function lightAt(fraction: number): Key {
  let index = KEYS.length - 1;
  for (let i = 0; i < KEYS.length; i++) {
    if (fraction >= KEYS[i].at) index = i;
  }
  const from = KEYS[index];
  const to = KEYS[(index + 1) % KEYS.length];
  const end = index === KEYS.length - 1 ? 1 : to.at;
  const t = Phaser.Math.Clamp((fraction - from.at) / (end - from.at), 0, 1);
  // Ease so the changes start and end gently.
  const eased = t * t * (3 - 2 * t);
  return {
    at: fraction,
    out: mixColor(from.out, to.out, eased),
    room: mixColor(from.room, to.room, eased),
    warm: lerp(from.warm, to.warm, eased),
    night: lerp(from.night, to.night, eased),
  };
}

export class DayLight {
  private readonly outdoors: Phaser.GameObjects.Rectangle[] = [];
  private readonly room: Phaser.GameObjects.Rectangle;
  private readonly roof: Phaser.GameObjects.Rectangle;
  private readonly skyWarm: Phaser.GameObjects.Image;
  private readonly skyNight: Phaser.GameObjects.Rectangle;
  private readonly stars: Phaser.GameObjects.Image;
  private readonly windowWarm: Phaser.GameObjects.Rectangle;
  private readonly windowNight: Phaser.GameObjects.Rectangle;
  // Glow layers and the strength each one has at full lamps.
  private readonly glows: { image: Phaser.GameObjects.Image; strength: number }[] = [];
  private pulse = 1;

  constructor(scene: Phaser.Scene, seed: number) {
    const x = -SIDE;
    const width = GAME_WIDTH + SIDE * 2;
    const layer = (top: number, bottom: number) =>
      scene.add
        .rectangle(x, top, width, bottom - top, 0xffffff)
        .setOrigin(0)
        .setDepth(MULTIPLY_DEPTH)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
    // Above the roof's cornice, in the room, and from the front wall down.
    this.roof = layer(WORLD.top - 600, ROOF.edgeBottom);
    this.room = layer(ROOF.edgeBottom, FRONT.capTop - 6);
    this.outdoors.push(layer(FRONT.capTop - 6, WORLD.bottom + 600));

    // Sky: a warm glow that is strongest at the horizon, a navy layer and stars.
    const skyHeight = BACKDROP_BOTTOM - ROOF.top;
    const gradient = paintTexture(scene, 'day-sky-glow', GAME_WIDTH, skyHeight, (ctx) => {
      ctx.fillStyle = vGradient(ctx, 0, skyHeight, [
        [0, 'rgba(255,255,255,0.05)'],
        [0.55, 'rgba(255,255,255,0.45)'],
        [1, 'rgba(255,255,255,1)'],
      ]);
      ctx.fillRect(0, 0, GAME_WIDTH, skyHeight);
    });
    this.skyWarm = addArt(scene, 0, ROOF.top, gradient, 0, 0).setDepth(SKY_DEPTH).setTint(WARM_SKY).setAlpha(0);
    this.skyNight = scene.add.rectangle(0, ROOF.top, GAME_WIDTH, skyHeight, NIGHT_SKY).setOrigin(0).setDepth(SKY_DEPTH + 0.01).setAlpha(0);
    this.stars = addArt(scene, 0, ROOF.top, paintTexture(scene, `day-stars-${seed}`, GAME_WIDTH, skyHeight, (ctx) => paintStars(ctx, skyHeight, seed)), 0, 0)
      .setDepth(SKY_DEPTH + 0.02)
      .setAlpha(0);

    // The window in the back wall.
    this.windowWarm = scene.add
      .rectangle(WINDOW.x, WINDOW.y, WINDOW.width, WINDOW.height, WARM_SKY)
      .setOrigin(0)
      .setDepth(MULTIPLY_DEPTH + 1)
      .setAlpha(0);
    this.windowNight = scene.add
      .rectangle(WINDOW.x, WINDOW.y, WINDOW.width, WINDOW.height, NIGHT_SKY)
      .setOrigin(0)
      .setDepth(MULTIPLY_DEPTH + 1)
      .setAlpha(0);

    // Glows.
    const glow = paintTexture(scene, 'day-glow', 240, 240, (ctx) => {
      ctx.fillStyle = radial(ctx, 120, 120, 0, 120, [
        [0, 'rgba(255,226,160,0.85)'],
        [0.25, 'rgba(255,210,130,0.38)'],
        [1, 'rgba(255,200,110,0)'],
      ]);
      ctx.fillRect(0, 0, 240, 240);
    });
    LAMPS.forEach((lampX) => this.addGlow(scene, glow, lampX, LAMP_TOP_Y + 14, 1.15, 1));
    BOARD_LAMPS.forEach((lampX) => this.addGlow(scene, glow, lampX + 15, FRONT.capTop - 8, 0.8, 0.9));
    // Light from the board's lamps on the name board, and from the open door on the pavement.
    const wash = paintTexture(scene, 'day-wash', 400, 160, (ctx) => {
      ctx.save();
      ctx.translate(200, 80);
      ctx.scale(1, 0.4);
      ctx.fillStyle = radial(ctx, 0, 0, 0, 200, [
        [0, 'rgba(255,224,160,0.6)'],
        [0.5, 'rgba(255,210,130,0.25)'],
        [1, 'rgba(255,200,110,0)'],
      ]);
      ctx.fillRect(-200, -200, 400, 400);
      ctx.restore();
    });
    this.addGlow(scene, wash, DOOR_X, FRONT.faceBottom + 52, 1, 0.8, 200, 80);
    BOARD_LAMPS.forEach((lampX) => this.addGlow(scene, wash, lampX + 8, FRONT.faceTop + 38, 0.6, 0.55, 200, 80));

    // Lit windows of the nearby buildings, drawn above the dark layers.
    const windows = paintTexture(scene, 'day-windows', GAME_WIDTH, 260, (ctx) => paintWindows(ctx, seed));
    this.addGlow(scene, windows, 0, ROOF.parapetTop - 230, 1, 1, 0, 0);
    this.update(0);
  }

  private addGlow(scene: Phaser.Scene, key: string, x: number, y: number, scale: number, strength: number, ox?: number, oy?: number): void {
    const image = addArt(scene, x, y, key, ox ?? 120, oy ?? 120, undefined)
      .setDepth(GLOW_DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    image.setScale(image.scaleX * scale);
    this.glows.push({ image, strength });
  }

  // Sets the light for a fraction of the day. Cheap: a few fills and alphas.
  update(fraction: number): LightState {
    const key = lightAt(lightFraction(fraction));
    this.roof.setFillStyle(key.out);
    this.room.setFillStyle(key.room);
    this.outdoors.forEach((rect) => rect.setFillStyle(key.out));
    this.skyWarm.setAlpha(key.warm * 0.8);
    this.skyNight.setAlpha(key.night * 0.88);
    this.stars.setAlpha(Math.max(0, key.night * 1.25 - 0.25));
    this.windowWarm.setAlpha(key.warm * 0.55);
    this.windowNight.setAlpha(key.night * 0.9);
    // Lamps come on at dusk and go out after dawn.
    const lamps = Phaser.Math.Clamp(key.night * 1.6 + key.warm * 0.15 - 0.1, 0, 1);
    this.glows.forEach(({ image, strength }) => image.setAlpha(lamps * strength * this.pulse));
    return { lamps };
  }

  // A slow flicker of the glows (called from the scene's clock a few times a second).
  flicker(time: number, lamps: number): void {
    this.pulse = 0.94 + Math.sin(time / 700) * 0.06;
    this.glows.forEach(({ image, strength }) => image.setAlpha(lamps * strength * this.pulse));
  }
}

function paintStars(ctx: Ctx, height: number, seed: number): void {
  const random = seeded(seed + 99);
  for (let i = 0; i < 110; i++) {
    const x = random() * GAME_WIDTH;
    // More stars higher up.
    const y = random() * random() * height * 0.85;
    const size = 0.8 + random() * 1.8;
    ctx.fillStyle = rgba(random() < 0.25 ? 0xffe6b0 : 0xffffff, 0.45 + random() * 0.5);
    ctx.fillRect(x, y, size, size);
  }
}

// Lit windows on the nearby buildings, on the same grid as the painted ones. World y from
// ROOF.parapetTop - 230.
function paintWindows(ctx: Ctx, seed: number): void {
  const origin = ROOF.parapetTop - 230;
  ctx.translate(0, -origin);
  const random = seeded(seed + 5);
  const boxes = [
    // The water tank and the air conditioners stand in front of the buildings, so their windows stay dark.
    { x: 78 - TANK.ox - 6, y: ROOF.deckTop + 6 - TANK.oy - 6, w: TANK.w + 12, h: TANK.oy + 6 },
    { x: 1000 - AC.ox - 6, y: ROOF.deckTop + 6 - AC.oy - 6, w: AC.w + 12, h: AC.oy + 6 },
  ];
  NEAR_BUILDINGS.forEach(([x, w, h]) => {
    const top = ROOF.parapetTop - h;
    const bottom = ROOF.parapetTop + 30;
    for (let wy = top + 14; wy < bottom - 10; wy += 22) {
      for (let wx = x + 9; wx < x + w - 14; wx += 19) {
        const lit = random() < 0.5;
        const hidden = boxes.some((b) => wx + 9 > b.x && wx < b.x + b.w && wy + 13 > b.y && wy < b.y + b.h);
        // Below the parapet's coping the buildings are hidden by the wall.
        if (!lit || hidden || wy + 13 > ROOF.parapetTop + 12) continue;
        ctx.fillStyle = radial(ctx, wx + 4.5, wy + 6.5, 0, 16, [
          [0, 'rgba(255,217,140,0.55)'],
          [1, 'rgba(255,217,140,0)'],
        ]);
        ctx.fillRect(wx - 12, wy - 10, 33, 33);
        ctx.fillStyle = 'rgba(255,226,160,0.95)';
        ctx.fillRect(wx, wy, 9, 13);
      }
    }
  });
}
