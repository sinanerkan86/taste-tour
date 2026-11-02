import Phaser from 'phaser';
import { FONT, GAME_WIDTH, PALETTE, toCss } from '../config';
import type { Point } from '../view/layout';

const CARD_WIDTH = 660;
const PADDING = 28;
const ARROW = 22;
const EDGE = 24;

// A one-time tip card with an arrow pointing up at something in the scene. Tapping it closes it.
export class HintBubble extends Phaser.GameObjects.Container {
  private closed = false;

  constructor(scene: Phaser.Scene, target: Point, text: string, depth: number, onClose: () => void) {
    const x = Phaser.Math.Clamp(target.x, EDGE + CARD_WIDTH / 2, GAME_WIDTH - EDGE - CARD_WIDTH / 2);
    super(scene, x, target.y);

    const label = scene.add
      .text(0, 0, text, {
        fontFamily: FONT,
        fontSize: '32px',
        color: toCss(PALETTE.ink),
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: CARD_WIDTH - PADDING * 2 },
      })
      .setOrigin(0.5, 0);
    const height = label.height + PADDING * 2;
    label.setY(ARROW + PADDING);

    const arrowX = target.x - x;
    const card = scene.add.graphics();
    card.fillStyle(PALETTE.ink, 0.3).fillRoundedRect(-CARD_WIDTH / 2, ARROW + 8, CARD_WIDTH, height, 28);
    card.fillStyle(PALETTE.cream, 1).fillRoundedRect(-CARD_WIDTH / 2, ARROW, CARD_WIDTH, height, 28);
    card.fillTriangle(arrowX - ARROW, ARROW + 2, arrowX + ARROW, ARROW + 2, arrowX, 0);
    card.lineStyle(5, PALETTE.saffron, 1).strokeRoundedRect(-CARD_WIDTH / 2, ARROW, CARD_WIDTH, height, 28);

    const hit = scene.add.zone(0, ARROW + height / 2, CARD_WIDTH, height).setInteractive();
    this.add([card, label, hit]);
    hit.on('pointerdown', (_: Phaser.Input.Pointer, __: number, ___: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.close();
    });
    this.once(Phaser.GameObjects.Events.DESTROY, onClose);
    this.setDepth(depth);
    scene.add.existing(this);

    // Pop in, then bob gently so it reads as something to act on.
    this.setScale(0);
    scene.tweens.add({ targets: this, scale: 1, duration: 300, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: this, y: target.y + 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, scale: 0, alpha: 0, duration: 180, onComplete: () => this.destroy() });
  }
}
