import Phaser from 'phaser';
import { PALETTE } from '../config';

// Generates placeholder textures in code, so the prototype needs no image files yet.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeCoinTexture();
    this.makeParticleTextures();
    this.scene.start('Restaurant');
  }

  // White shapes, tinted per effect.
  private makeParticleTextures(): void {
    const g = this.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
    g.generateTexture('spark', 16, 16);
    g.clear();
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 14, 8);
    g.generateTexture('confetti', 14, 8);
    g.destroy();
  }

  private makeCoinTexture(): void {
    const g = this.make.graphics({}, false);
    g.fillStyle(PALETTE.saffronDark, 1);
    g.fillCircle(32, 35, 30);
    g.fillStyle(PALETTE.saffron, 1);
    g.fillCircle(32, 32, 30);
    g.lineStyle(4, 0xffe08a, 1);
    g.strokeCircle(32, 32, 20);
    g.generateTexture('coin', 64, 66);
    g.destroy();
  }
}
