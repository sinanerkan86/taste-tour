import Phaser from 'phaser';
import { CELL, PEOPLE_TEXTURE, ensurePeopleAtlas, type Part } from './characterArt';
import { depthScale, type Point } from './layout';
import { ART_RES, type Ctx, addArt, ellipse, paintTexture, radial } from './paint';

export type PersonKind = 'customer' | 'waiter' | 'chef' | 'cashier' | 'dishwasher' | 'vip';

const SKIN_TONES = [0xffdcbf, 0xf3c29b, 0xd9a27a, 0xb07a52, 0x82573a];
const SHIRT_COLORS = [0xe0503f, 0x2f88a8, 0x5fae4a, 0xf5a623, 0x9466c0, 0x45b0d6, 0xec7aa6, 0x7d8a93];
const PANTS_COLORS = [0x3f5f8f, 0x34343f, 0x6b5a48, 0x4a6b5a, 0x2e4a6e];
const HAIR_COLORS = [0x3a2a1e, 0x6b4630, 0xa8703a, 0xe8b84a, 0x262626, 0x8a3a24];
type HairStyle = 'short' | 'long' | 'bob' | 'bun' | 'ponytail';
const FEMALE_HAIR: HairStyle[] = ['long', 'bob', 'bun', 'ponytail'];
// Share of women among customers and staff, and of women customers wearing a skirt.
const FEMALE_SHARE = 0.5;
const SKIRT_SHARE = 0.6;
const STAFF_SHIRTS: Record<Exclude<PersonKind, 'customer'>, number> = {
  waiter: 0xffffff,
  chef: 0xffffff,
  cashier: 0xfff0d4,
  dishwasher: 0xb4def0,
  vip: 0x8e4fb0,
};
const STAFF_PANTS = 0x2b2b3a;
const CHEF_PANTS = 0x6f7b84;
// Staff dress better as their section levels up (style tiers 0-3, see styleTier in core).
interface Look {
  shirt: number;
  // Sleeve color when it differs from the shirt (a jacket).
  sleeves?: number;
  body: Part[];
  head: Part[];
}
const RED_SCARF = 0xd8452b;
const BLUE_SCARF = 0x2f88a8;
const SERVICE_LOOKS = (simpleShirt: number): Look[] => [
  { shirt: simpleShirt, body: ['waistApron'], head: [] },
  { shirt: 0xffffff, body: ['vest'], head: [] },
  { shirt: 0xffffff, body: ['vest', 'bowTie'], head: [] },
  { shirt: 0xffffff, sleeves: 0x2a2a36, body: ['tailcoat', 'bowTie'], head: [] },
];
const STAFF_LOOKS: Partial<Record<PersonKind, Look[]>> = {
  waiter: SERVICE_LOOKS(0x6fb3cf),
  cashier: SERVICE_LOOKS(0xf0c987),
  chef: [
    { shirt: 0xf2efe8, body: ['waistApron'], head: [] },
    { shirt: 0xffffff, body: ['chefApron'], head: ['toque'] },
    { shirt: 0xffffff, body: ['chefApron', 'neckerchief'], head: ['toque'] },
    { shirt: 0xffffff, body: ['chefApron', 'neckerchief'], head: ['tallToque'] },
  ],
  dishwasher: [
    { shirt: 0x9aa3a8, body: ['rubberApron'], head: [] },
    { shirt: 0xb4def0, body: ['rubberApron'], head: [] },
    { shirt: 0xb4def0, body: ['rubberApron', 'neckerchief'], head: [] },
    { shirt: 0xffffff, body: ['rubberApron', 'neckerchief'], head: [] },
  ],
};
const SCARF_TINT: Partial<Record<PersonKind, number>> = { chef: RED_SCARF, dishwasher: BLUE_SCARF };
// Fixed outfits for guests.
const OUTFITS: Partial<Record<PersonKind, { body?: Part; head?: Part }>> = {
  vip: { body: 'sash', head: 'sunHat' },
};

function makePart(scene: Phaser.Scene, name: Part, tint?: number): Phaser.GameObjects.Image {
  const image = scene.add.image(0, 0, PEOPLE_TEXTURE, name).setScale(1 / ART_RES);
  image.setOrigin(CELL.left / CELL.width, CELL.top / CELL.height);
  if (tint !== undefined) image.setTint(tint);
  return image;
}

export const WALK_SPEED = 165; // pixels per second, unhurried so the scene stays calm
const BOB_HEIGHT = 7;
const BLINK_MS = 140;

// A painted character built from atlas parts (see characterArt.ts). The container's origin is at
// the feet, so depth = y sorts correctly.
export class Person extends Phaser.GameObjects.Container {
  private readonly figure: Phaser.GameObjects.Container;
  // Things carried in front of the body (plates).
  readonly hands: Phaser.GameObjects.Container;
  private walking = false;
  private move?: { tween: Phaser.Tweens.Tween; done: () => void };
  private phase = Math.random() * Math.PI * 2;
  private readonly eyelids: Phaser.GameObjects.Image;
  private nextBlink = 1000 + Math.random() * 4000;
  // Working staff wobble in place (stirring, scrubbing, counting money).
  busy = false;
  private readonly kind: PersonKind;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly arms: Phaser.GameObjects.Image;
  private readonly bodyWear: Phaser.GameObjects.Container;
  private readonly headWear: Phaser.GameObjects.Container;
  private style = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PersonKind) {
    super(scene, x, y);
    this.kind = kind;
    ensurePeopleAtlas(scene);
    const pick = <T>(list: T[]): T => Phaser.Utils.Array.GetRandom(list);
    const skin = pick(SKIN_TONES);
    const hair = pick(HAIR_COLORS);
    const shirt = kind === 'customer' ? pick(SHIRT_COLORS) : STAFF_SHIRTS[kind];
    const pants = kind === 'chef' ? CHEF_PANTS : kind === 'customer' || kind === 'vip' ? pick(PANTS_COLORS) : STAFF_PANTS;
    const female = Math.random() < FEMALE_SHARE;
    const hairStyle: HairStyle = female ? pick(FEMALE_HAIR) : 'short';
    const skirt = female && (kind === 'customer' || kind === 'vip') && Math.random() < SKIRT_SHARE;
    const outfit = OUTFITS[kind] ?? {};

    const part = (name: Part, tint?: number) => makePart(scene, name, tint);

    const shadow = part('shadow');
    const body: Phaser.GameObjects.GameObject[] = [part('legs', skirt ? skin : pants), part('shoes')];
    if (skirt) body.push(part('skirt', pick(SHIRT_COLORS.filter((c) => c !== shirt))));
    this.torso = part('torso', shirt);
    this.arms = part('arms', shirt);
    this.bodyWear = scene.add.container(0, 0);
    this.headWear = scene.add.container(0, 0);
    body.push(this.torso, this.arms, part('hands', skin), this.bodyWear);
    if (outfit.body) body.push(part(outfit.body));
    if (hairStyle === 'long') body.push(part('hairLong', hair));
    if (hairStyle === 'bob') body.push(part('hairBob', hair));
    if (hairStyle === 'ponytail') body.push(part('hairPonytail', hair));
    this.eyelids = part('eyelids', skin).setVisible(false);
    body.push(part('head', skin), part('shine'), part(female ? 'faceFemale' : 'faceMale'), this.eyelids);
    body.push(part(female ? 'hairTop' : 'hairShort', hair));
    if (hairStyle === 'bun') body.push(part('hairBun', hair));
    if (outfit.head) body.push(part(outfit.head));
    body.push(this.headWear);

    this.hands = scene.add.container(0, -62);
    this.figure = scene.add.container(0, 0, [...body, this.hands]);
    this.add([shadow, this.figure]);
    this.setDepth(y).setScale(depthScale(y));
    this.setStyle(0);
    scene.add.existing(this);
  }

  // Dresses staff for their section's style tier. Returns true when the look changed.
  setStyle(tier: number): boolean {
    const looks = STAFF_LOOKS[this.kind];
    if (!looks) return false;
    const index = Phaser.Math.Clamp(tier, 0, looks.length - 1);
    if (index === this.style) return false;
    this.style = index;
    const look = looks[index];
    this.torso.setTint(look.shirt);
    this.arms.setTint(look.sleeves ?? look.shirt);
    const wear = (name: Part) => makePart(this.scene, name, name === 'neckerchief' ? SCARF_TINT[this.kind] : undefined);
    this.bodyWear.removeAll(true).add(look.body.map(wear));
    this.headWear.removeAll(true).add(look.head.map(wear));
    return true;
  }

  get isWalking(): boolean {
    return this.walking;
  }

  // Walk to a point; resolves when arrived. A new walk replaces the current one, which then
  // resolves where the person stopped.
  walkTo(target: Point, speed = WALK_SPEED): Promise<void> {
    this.stopWalking();
    const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (distance < 1) return Promise.resolve();
    this.walking = true;
    this.figure.scaleX = target.x < this.x ? -1 : 1;
    return new Promise((resolve) => {
      const tween = this.scene.tweens.add({
        targets: this,
        x: target.x,
        y: target.y,
        duration: (distance / speed) * 1000,
        onUpdate: () => this.setDepth(this.y),
        onComplete: () => this.endWalk(false),
      });
      this.move = { tween, done: resolve };
    });
  }

  stopWalking(): void {
    this.endWalk(true);
  }

  private endWalk(interrupted: boolean): void {
    const move = this.move;
    if (!move) return;
    this.move = undefined;
    if (interrupted) move.tween.stop();
    this.walking = false;
    this.figure.y = 0;
    move.done();
  }

  face(direction: -1 | 1): void {
    this.figure.scaleX = direction;
  }

  // Drop the body so the table hides the legs, as if sitting on the chair.
  sit(): void {
    this.figure.y = 24;
  }

  // Called every frame for the walking bob and idle breathing.
  animate(time: number): void {
    if (this.walking) {
      this.figure.y = -Math.abs(Math.sin(time * 0.008 + this.phase)) * BOB_HEIGHT;
    } else {
      this.figure.scaleY = 1 + Math.sin(time * 0.003 + this.phase) * 0.015;
    }
    this.figure.angle = this.busy && !this.walking ? Math.sin(time * 0.011 + this.phase) * 3 : 0;
    this.setScale(depthScale(this.y));
    this.blink(time);
  }

  // Eyes close for a moment every few seconds.
  private blink(time: number): void {
    if (time < this.nextBlink) return;
    const closed = time < this.nextBlink + BLINK_MS;
    this.eyelids.setVisible(closed);
    if (!closed) this.nextBlink = time + 2500 + Math.random() * 4000;
  }

  destroy(fromScene?: boolean): void {
    this.move?.tween.stop();
    this.move = undefined;
    super.destroy(fromScene);
  }
}

// A plate with food; the food is painted in grey and tinted with the dish color.
export function createPlate(scene: Phaser.Scene, foodColor: number): Phaser.GameObjects.Container {
  const plate = addArt(scene, 0, 0, paintTexture(scene, 'plate', 64, 26, paintPlate), 32, 12);
  const food = addArt(scene, 0, 0, paintTexture(scene, 'food', 40, 24, paintFood), 20, 18).setTint(foodColor);
  return scene.add.container(0, 0, [plate, food]);
}

function paintPlate(ctx: Ctx): void {
  ctx.translate(32, 12);
  ctx.fillStyle = '#b9b1a3';
  ellipse(ctx, 0, 3, 29, 9);
  ctx.fill();
  ctx.fillStyle = radial(ctx, 0, 0, 0, 30, [
    [0, '#f4f0e8'],
    [0.55, '#ffffff'],
    [1, '#d9d2c4'],
  ]);
  ellipse(ctx, 0, 0, 29, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,150,135,0.6)';
  ctx.lineWidth = 1.2;
  ellipse(ctx, 0, 0, 19, 5.5);
  ctx.stroke();
}

function paintFood(ctx: Ctx): void {
  ctx.translate(20, 18);
  ctx.fillStyle = radial(ctx, 0, -6, 0, 18, [
    [0, '#ffffff'],
    [0.7, '#d0d0d0'],
    [1, '#8c8c8c'],
  ], -5, -11);
  ellipse(ctx, 0, -6, 17, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ellipse(ctx, -5, -10, 5, 2);
  ctx.fill();
}
