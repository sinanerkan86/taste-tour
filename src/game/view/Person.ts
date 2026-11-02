import Phaser from 'phaser';
import type { Point } from './layout';

export type PersonKind = 'customer' | 'waiter' | 'chef';

const SKIN_TONES = [0xf6d2b0, 0xe8b48c, 0xc98e66, 0x9c6644, 0x6e4630];
const SHIRT_COLORS = [0xc0392b, 0x1f6f8b, 0x4a8c3a, 0xe08e0b, 0x7b4fa0, 0x2f8fb0, 0xd35d8a, 0x5f6b73];
const HAIR_COLORS = [0x2b1d14, 0x5a3a24, 0x8c5a2b, 0xd9a21b, 0x1c1c1c];
const BOW_TIE = 0xc0392b;

const WALK_SPEED = 260; // pixels per second
const BOB_HEIGHT = 7;

// A simple vector character. The container's origin is at the feet, so depth = y sorts correctly.
export class Person extends Phaser.GameObjects.Container {
  private readonly figure: Phaser.GameObjects.Container;
  // Things carried in front of the body (plates).
  readonly hands: Phaser.GameObjects.Container;
  private walking = false;
  private phase = Math.random() * Math.PI * 2;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PersonKind) {
    super(scene, x, y);
    const skin = Phaser.Utils.Array.GetRandom(SKIN_TONES);
    const hair = Phaser.Utils.Array.GetRandom(HAIR_COLORS);
    const shirt = kind === 'customer' ? Phaser.Utils.Array.GetRandom(SHIRT_COLORS) : 0xffffff;

    const shadow = scene.add.ellipse(0, 0, 54, 14, 0x000000, 0.18);
    const g = scene.add.graphics();
    // Legs.
    g.fillStyle(kind === 'chef' ? 0x5f6b73 : 0x2b2b3a, 1);
    g.fillRoundedRect(-18, -34, 14, 34, 5).fillRoundedRect(4, -34, 14, 34, 5);
    // Torso.
    g.fillStyle(shirt, 1).fillRoundedRect(-26, -86, 52, 58, 16);
    if (kind === 'waiter') {
      g.fillStyle(0x2b2b3a, 1).fillRoundedRect(-22, -62, 44, 34, 8);
      g.fillStyle(BOW_TIE, 1).fillTriangle(-10, -84, -10, -74, 0, -79).fillTriangle(10, -84, 10, -74, 0, -79);
    }
    if (kind === 'chef') {
      g.fillStyle(0xe8e2d6, 1).fillRoundedRect(-20, -64, 40, 36, 8);
    }
    // Head.
    g.fillStyle(skin, 1).fillCircle(0, -108, 24);
    g.fillStyle(hair, 1).fillEllipse(0, -124, 46, 18);
    g.fillStyle(0x2b1d14, 1).fillCircle(-8, -108, 3).fillCircle(8, -108, 3);
    g.lineStyle(2, 0x2b1d14, 1).beginPath().arc(0, -101, 7, 0.2, Math.PI - 0.2).strokePath();
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

  // Walk to a point; resolves when arrived.
  walkTo(target: Point): Promise<void> {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (distance < 1) return Promise.resolve();
    this.walking = true;
    this.figure.scaleX = target.x < this.x ? -1 : 1;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x: target.x,
        y: target.y,
        duration: (distance / WALK_SPEED) * 1000,
        onUpdate: () => this.setDepth(this.y),
        onComplete: () => {
          this.walking = false;
          this.figure.y = 0;
          resolve();
        },
      });
    });
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
