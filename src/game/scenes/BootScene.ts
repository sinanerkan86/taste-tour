import Phaser from 'phaser';
import { PALETTE } from '../config';

// Generates placeholder textures in code, so the skeleton needs no image files yet.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeCoinTexture();
    this.scene.start('Restaurant');
  }

  private makeCoinTexture(): void {
    const g = this.make.graphics({}, false);
    g.fillStyle(PALETTE.floorDark, 1);
    g.fillCircle(24, 26, 22);
    g.fillStyle(PALETTE.saffron, 1);
    g.fillCircle(24, 24, 22);
    g.lineStyle(3, 0xffe08a, 1);
    g.strokeCircle(24, 24, 15);
    g.generateTexture('coin', 48, 50);
    g.destroy();
  }
}
