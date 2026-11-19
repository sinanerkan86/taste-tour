import Phaser from 'phaser';
import { SPOT_AREAS, type SpotId } from './layout';

// A soft golden outline around the part of the restaurant whose upgrades are open in the drawer.

const DEPTH = 5898;
const GOLD = 0xf5b82e;

export class SpotMarkers {
  private readonly outline: Phaser.GameObjects.Graphics;
  private selected: SpotId | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.outline = scene.add.graphics().setDepth(DEPTH).setVisible(false);
  }

  update(selected: SpotId | null): void {
    if (selected === this.selected) return;
    this.selected = selected;
    this.scene.tweens.killTweensOf(this.outline);
    this.outline.clear().setVisible(selected !== null);
    if (!selected) return;
    const rects = SPOT_AREAS.find(([id]) => id === selected)?.[1] ?? [];
    for (const [x, y, w, h] of rects) {
      this.outline.fillStyle(GOLD, 0.06).fillRoundedRect(x + 6, y + 6, w - 12, h - 12, 26);
      this.outline.lineStyle(3.5, GOLD, 0.7).strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, 26);
    }
    this.outline.setAlpha(0);
    this.scene.tweens.add({ targets: this.outline, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
