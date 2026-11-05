import Phaser from 'phaser';
import { audio } from '../audio';
import { FONT, PALETTE, toCss } from '../config';
import { ART_RES } from '../view/paint';
import { card } from './style';

const WIDTH = 620;
const HEIGHT = 70;
const ICON_X = -WIDTH / 2 + 40;
const TEXT_X = ICON_X + 36;
const TRACK = { x: TEXT_X, y: 17, width: WIDTH - (TEXT_X + WIDTH / 2) - 90, height: 14 };

export interface GoalView {
  label: string;
  progress: number;
  // Dish color for a dish goal; null shows a Chef Star.
  iconColor: number | null;
}

// A small card at the top of the restaurant naming the current goal, with a progress bar.
// Tapping it takes the player to where the goal is done.
export class GoalBar extends Phaser.GameObjects.Container {
  private readonly label: Phaser.GameObjects.Text;
  private readonly percent: Phaser.GameObjects.Text;
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly dishIcon: Phaser.GameObjects.Arc;
  private readonly starIcon: Phaser.GameObjects.Image;
  private ready: boolean | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, onTap: () => void) {
    super(scene, x, y);
    const bg = scene.add
      .image(0, 4, card(scene, 'goal-card', WIDTH, HEIGHT, { top: 0xfffdf6, bottom: 0xffe9c4, border: 0xf0a020, radius: HEIGHT / 2 }))
      .setScale(1 / ART_RES);
    const track = scene.add.graphics();
    track.fillStyle(0x5a3a20, 0.35).fillRoundedRect(TRACK.x - 2, TRACK.y - TRACK.height / 2 - 2, TRACK.width + 4, TRACK.height + 4, 8);
    track.fillStyle(0xe8d8bc, 1).fillRoundedRect(TRACK.x, TRACK.y - TRACK.height / 2, TRACK.width, TRACK.height, 6);
    this.fill = scene.add.graphics();
    this.dishIcon = scene.add.circle(ICON_X, 0, 22, 0xffffff).setStrokeStyle(3, 0xffffff);
    this.starIcon = scene.add.image(ICON_X, 0, 'star').setScale(0.7);
    this.label = scene.add
      .text(TEXT_X, -12, '', { fontFamily: FONT, fontSize: '27px', fontStyle: 'bold', color: toCss(PALETTE.ink) })
      .setOrigin(0, 0.5);
    this.percent = scene.add
      .text(WIDTH / 2 - 24, 0, '', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: toCss(PALETTE.muted) })
      .setOrigin(1, 0.5);
    this.add([bg, track, this.fill, this.dishIcon, this.starIcon, this.label, this.percent]);
    this.setSize(WIDTH, HEIGHT).setInteractive({ useHandCursor: true });
    this.on('pointerdown', onTap);
    scene.add.existing(this);
  }

  render(view: GoalView): void {
    if (this.label.text !== view.label) this.label.setText(view.label);
    this.dishIcon.setVisible(view.iconColor !== null);
    this.starIcon.setVisible(view.iconColor === null);
    if (view.iconColor !== null) this.dishIcon.setFillStyle(view.iconColor);

    const progress = Phaser.Math.Clamp(view.progress, 0, 1);
    const ready = progress >= 1;
    this.fill.clear();
    if (progress > 0) {
      const w = Math.max(TRACK.height, TRACK.width * progress);
      this.fill.fillStyle(ready ? 0x4fb030 : 0xf0a020, 1);
      this.fill.fillRoundedRect(TRACK.x, TRACK.y - TRACK.height / 2, w, TRACK.height, 6);
      this.fill.fillStyle(0xffffff, 0.45);
      this.fill.fillRoundedRect(TRACK.x + 3, TRACK.y - TRACK.height / 2 + 2, Math.max(0, w - 6), TRACK.height * 0.35, 3);
    }
    this.percent.setText(ready ? '✓' : `${Math.floor(progress * 100)}%`);
    this.percent.setColor(toCss(ready ? PALETTE.success : PALETTE.muted));
    // A gentle pulse once, when the goal becomes doable.
    if (ready && this.ready === false) {
      audio.play('unlock', 0.6);
      this.scene.tweens.add({ targets: this, scale: 1.06, duration: 220, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    }
    this.ready = ready;
  }
}
