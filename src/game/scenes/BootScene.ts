import Phaser from 'phaser';
import { PALETTE } from '../config';
import { saves } from '../persistence';
import type { RestaurantSceneData } from './RestaurantScene';

// Generates placeholder textures in code, so the prototype needs no image files yet.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeCoinTexture();
    this.makeParticleTextures();
    void this.loadAndStart();
  }

  private async loadAndStart(): Promise<void> {
    // Dev-only shortcut for testing: /?reset=1 starts a fresh game.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('reset')) await saves.clear();
    const data: RestaurantSceneData = { save: await saves.load() };
    this.scene.start('Restaurant', data);
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
