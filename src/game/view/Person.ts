import Phaser from 'phaser';
import type { Point } from './layout';

export type PersonKind = 'customer' | 'waiter' | 'chef' | 'cashier' | 'dishwasher' | 'vip';

const SKIN_TONES = [0xf6d2b0, 0xe8b48c, 0xc98e66, 0x9c6644, 0x6e4630];
const SHIRT_COLORS = [0xc0392b, 0x1f6f8b, 0x4a8c3a, 0xe08e0b, 0x7b4fa0, 0x2f8fb0, 0xd35d8a, 0x5f6b73];
const HAIR_COLORS = [0x2b1d14, 0x5a3a24, 0x8c5a2b, 0xd9a21b, 0x1c1c1c];
const BOW_TIE = 0xc0392b;
const LIPS = 0xb03a48;
type HairStyle = 'short' | 'long' | 'bob' | 'bun' | 'ponytail';
const FEMALE_HAIR: HairStyle[] = ['long', 'bob', 'bun', 'ponytail'];
// Share of women among customers and staff, and of women customers wearing a skirt.
const FEMALE_SHARE = 0.5;
const SKIRT_SHARE = 0.6;
const STAFF_SHIRTS: Record<Exclude<PersonKind, 'customer'>, number> = {
  waiter: 0xffffff,
  chef: 0xffffff,
  cashier: 0xf3e3c3,
  dishwasher: 0x9ec9d9,
  vip: 0x6c3483,
};
const GOLD = 0xf4b400;

export const WALK_SPEED = 260; // pixels per second
const BOB_HEIGHT = 7;

// A simple vector character. The container's origin is at the feet, so depth = y sorts correctly.
export class Person extends Phaser.GameObjects.Container {
  private readonly figure: Phaser.GameObjects.Container;
  // Things carried in front of the body (plates).
  readonly hands: Phaser.GameObjects.Container;
  private walking = false;
  private move?: { tween: Phaser.Tweens.Tween; done: () => void };
  private phase = Math.random() * Math.PI * 2;
  // Working staff wobble in place (stirring, scrubbing, counting money).
  busy = false;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PersonKind) {
    super(scene, x, y);
    const skin = Phaser.Utils.Array.GetRandom(SKIN_TONES);
    const hair = Phaser.Utils.Array.GetRandom(HAIR_COLORS);
    const shirt = kind === 'customer' ? Phaser.Utils.Array.GetRandom(SHIRT_COLORS) : STAFF_SHIRTS[kind];
    const female = Math.random() < FEMALE_SHARE;
    const hairStyle: HairStyle = female ? Phaser.Utils.Array.GetRandom(FEMALE_HAIR) : 'short';
    const skirt = female && (kind === 'customer' || kind === 'vip') && Math.random() < SKIRT_SHARE;

    const shadow = scene.add.ellipse(0, 0, 54, 14, 0x000000, 0.18);
    const g = scene.add.graphics();
    // Legs.
    g.fillStyle(kind === 'chef' ? 0x5f6b73 : 0x2b2b3a, 1);
    g.fillRoundedRect(-18, -34, 14, 34, 5).fillRoundedRect(4, -34, 14, 34, 5);
    // Torso.
    g.fillStyle(shirt, 1).fillRoundedRect(-26, -86, 52, 58, 16);
    if (skirt) {
      const color = Phaser.Utils.Array.GetRandom(SHIRT_COLORS.filter((c) => c !== shirt));
      g.fillStyle(color, 1).fillPoints([{ x: -24, y: -42 }, { x: 24, y: -42 }, { x: 31, y: -12 }, { x: -31, y: -12 }], true);
    }
    if (kind === 'waiter' || kind === 'cashier') {
      g.fillStyle(0x2b2b3a, 1).fillRoundedRect(-22, -62, 44, 34, 8);
      g.fillStyle(BOW_TIE, 1).fillTriangle(-10, -84, -10, -74, 0, -79).fillTriangle(10, -84, 10, -74, 0, -79);
    }
    if (kind === 'chef') {
      g.fillStyle(0xe8e2d6, 1).fillRoundedRect(-20, -64, 40, 36, 8);
    }
    if (kind === 'dishwasher') {
      // Rubber apron.
      g.fillStyle(0xf4b400, 1).fillRoundedRect(-20, -70, 40, 42, 8);
    }
    if (kind === 'vip') {
      // Gold sash and a camera: a well-off food tourist.
      g.lineStyle(8, GOLD, 1).lineBetween(-20, -82, 18, -34);
      g.fillStyle(0x2b2b3a, 1).fillRoundedRect(4, -60, 26, 18, 4);
      g.fillStyle(0x9ec9d9, 1).fillCircle(17, -51, 6);
    }
    // Hair that falls behind the head and onto the shoulders.
    g.fillStyle(hair, 1);
    if (hairStyle === 'long') g.fillRoundedRect(-29, -128, 58, 60, 20);
    if (hairStyle === 'bob') g.fillRoundedRect(-29, -128, 58, 40, 18);
    if (hairStyle === 'ponytail') g.fillEllipse(26, -110, 18, 44);
    // Head.
    g.fillStyle(skin, 1).fillCircle(0, -108, 24);
    g.fillStyle(hair, 1);
    if (female) {
      g.fillEllipse(0, -123, 52, 22);
      if (hairStyle === 'bun') g.fillCircle(0, -141, 13);
    } else {
      g.fillEllipse(0, -124, 46, 18);
    }
    g.fillStyle(0x2b1d14, 1).fillCircle(-8, -108, 3).fillCircle(8, -108, 3);
    if (female) {
      // Lashes and lipstick.
      g.lineStyle(2, 0x2b1d14, 1).lineBetween(-11, -110, -14, -113).lineBetween(11, -110, 14, -113);
      g.lineStyle(3, LIPS, 1).beginPath().arc(0, -101, 6, 0.3, Math.PI - 0.3).strokePath();
    } else {
      g.lineStyle(2, 0x2b1d14, 1).beginPath().arc(0, -101, 7, 0.2, Math.PI - 0.2).strokePath();
    }
    if (kind === 'vip') {
      // Sunglasses and a wide sun hat.
      g.fillStyle(0x1c1c1c, 1).fillRoundedRect(-17, -114, 14, 10, 4).fillRoundedRect(3, -114, 14, 10, 4);
      g.fillRect(-4, -111, 8, 3);
      g.fillStyle(0xf3e3c3, 1).fillEllipse(0, -128, 78, 16);
      g.fillStyle(0xf3e3c3, 1).fillRoundedRect(-20, -150, 40, 24, 10);
      g.fillStyle(GOLD, 1).fillRect(-20, -134, 40, 6);
    }
    if (kind === 'chef') {
      // Toque.
      g.fillStyle(0xffffff, 1).fillRoundedRect(-16, -150, 32, 24, 6);
      g.fillCircle(-12, -152, 12).fillCircle(0, -158, 14).fillCircle(12, -152, 12);
      g.lineStyle(2, 0xe0dcd2, 1).strokeRoundedRect(-16, -150, 32, 24, 6);
    }

    this.hands = scene.add.container(0, -62);
    this.figure = scene.add.container(0, 0, [g, this.hands]);
    this.add([shadow, this.figure]);
    this.setDepth(y);
    scene.add.existing(this);
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
      this.figure.y = -Math.abs(Math.sin(time * 0.012 + this.phase)) * BOB_HEIGHT;
    } else {
      this.figure.scaleY = 1 + Math.sin(time * 0.003 + this.phase) * 0.015;
    }
    this.figure.angle = this.busy && !this.walking ? Math.sin(time * 0.02 + this.phase) * 4 : 0;
  }

  destroy(fromScene?: boolean): void {
    this.move?.tween.stop();
    this.move = undefined;
    super.destroy(fromScene);
  }
}

// A plate with food; the color hints at the dish.
export function createPlate(scene: Phaser.Scene, foodColor: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1).fillEllipse(0, 0, 58, 18);
  g.lineStyle(2, 0xc9c1b4, 1).strokeEllipse(0, 0, 58, 18);
  g.fillStyle(foodColor, 1).fillEllipse(0, -6, 34, 16);
  return scene.add.container(0, 0, [g]);
}
