import Phaser from 'phaser';
import { SPOT_ANCHORS, SPOT_AREAS, type SpotId } from './layout';
import { addArt, css, paintTexture, radial, type Ctx } from './paint';

// Small badges over the parts of the restaurant: a green arrow where an upgrade is affordable,
// and a glowing golden outline around the part whose upgrades are open in the drawer.

// Badges sit beside the bottleneck marker's anchor, so both can show at once.
const OFFSET = { x: 64, y: 6 };
const DEPTH = 5900;

function paintArrow(ctx: Ctx, color: number): void {
  ctx.translate(30, 30);
  ctx.fillStyle = 'rgba(30,20,10,0.3)';
  ctx.beginPath();
  ctx.arc(0, 3, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = radial(ctx, -6, -8, 2, 27, [
    [0, css(color, 0.35)],
    [1, css(color, -0.2)],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(13, 0);
  ctx.lineTo(5, 0);
  ctx.lineTo(5, 13);
  ctx.lineTo(-5, 13);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-13, 0);
  ctx.closePath();
  ctx.fill();
}

export class SpotMarkers {
  private readonly arrows = new Map<SpotId, Phaser.GameObjects.Image>();
  private readonly outline: Phaser.GameObjects.Graphics;
  private selected: SpotId | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const arrow = paintTexture(scene, 'spot-arrow', 60, 60, (ctx) => paintArrow(ctx, 0x3fae49));
    for (const id of Object.keys(SPOT_ANCHORS) as SpotId[]) {
      const at = SPOT_ANCHORS[id];
      const image = addArt(scene, at.x + OFFSET.x, at.y + OFFSET.y, arrow, 30, 30).setDepth(DEPTH).setVisible(false);
      scene.tweens.add({ targets: image, y: image.y - 10, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 500 });
      this.arrows.set(id, image);
    }
    this.outline = scene.add.graphics().setDepth(DEPTH - 1).setVisible(false);
  }

  // affordable: parts with an upgrade the player can pay for right now.
  update(affordable: Set<SpotId>, selected: SpotId | null): void {
    this.arrows.forEach((image, id) => image.setVisible(affordable.has(id) && id !== selected));
    if (selected === this.selected) return;
    this.selected = selected;
    this.scene.tweens.killTweensOf(this.outline);
    this.outline.clear().setVisible(selected !== null);
    if (!selected) return;
    const rects = SPOT_AREAS.find(([id]) => id === selected)?.[1] ?? [];
    for (const [x, y, w, h] of rects) {
      this.outline.fillStyle(0xffd34d, 0.1).fillRoundedRect(x + 6, y + 6, w - 12, h - 12, 26);
      this.outline.lineStyle(7, 0xffd34d, 1).strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, 26);
    }
    this.outline.setAlpha(0);
    this.scene.tweens.add({ targets: this.outline, alpha: { from: 0.35, to: 0.95 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
