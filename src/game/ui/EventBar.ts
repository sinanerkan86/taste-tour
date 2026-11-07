import Phaser from 'phaser';
import { FONT, PALETTE, toCss } from '../config';
import { ART_RES } from '../view/paint';
import { card } from './style';

const WIDTH = 720;
const HEIGHT = 108;
const ICON_X = -WIDTH / 2 + 56;
const TEXT_X = ICON_X + 52;
const TRACK = { x: TEXT_X, y: 30, width: WIDTH - (TEXT_X + WIDTH / 2) - 120, height: 16 };

export interface EventView {
  // Texture key of the icon on the left, and its display size.
  icon: string;
  iconSize: number;
  title: string;
  detail: string;
  // Bar fill, 0 to 1, and its color.
  progress: number;
  barColor: number;
  // Short text on the right (time left).
  timer: string;
}

// A card under the goal card while a scene event runs (food critic, tour bus, festival).
export class EventBar extends Phaser.GameObjects.Container {
  private readonly icon: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly timer: Phaser.GameObjects.Text;
  private readonly fill: Phaser.GameObjects.Graphics;
  private iconKey = '';
  private hiding = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const bg = scene.add
      .image(0, 4, card(scene, 'event-card', WIDTH, HEIGHT, { top: 0xfff8e8, bottom: 0xffdca0, border: 0xd8342a, radius: 30, borderWidth: 5 }))
      .setScale(1 / ART_RES);
    const track = scene.add.graphics();
    track.fillStyle(0x5a3a20, 0.35).fillRoundedRect(TRACK.x - 2, TRACK.y - TRACK.height / 2 - 2, TRACK.width + 4, TRACK.height + 4, 9);
    track.fillStyle(0xe8d8bc, 1).fillRoundedRect(TRACK.x, TRACK.y - TRACK.height / 2, TRACK.width, TRACK.height, 7);
    this.fill = scene.add.graphics();
    this.icon = scene.add.image(ICON_X, 0, '__DEFAULT');
    const text = (size: number, color: number, bold: boolean) =>
      scene.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: toCss(color) })
        .setOrigin(0, 0.5);
    this.title = text(30, PALETTE.pomegranate, true).setPosition(TEXT_X, -30);
    this.detail = text(26, PALETTE.ink, true).setPosition(TEXT_X, 0);
    this.timer = text(32, PALETTE.ink, true).setOrigin(1, 0.5).setPosition(WIDTH / 2 - 26, 0);
    this.add([bg, track, this.fill, this.icon, this.title, this.detail, this.timer]);
    this.setVisible(false);
    scene.add.existing(this);
  }

  show(view: EventView): void {
    if (!this.visible || this.hiding) {
      this.hiding = false;
      this.scene.tweens.killTweensOf(this);
      this.setVisible(true).setScale(0.4).setAlpha(0);
      this.scene.tweens.add({ targets: this, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
    }
    if (this.iconKey !== view.icon) {
      this.iconKey = view.icon;
      this.icon.setTexture(view.icon);
    }
    this.icon.setScale(view.iconSize / Math.max(this.icon.width, this.icon.height));
    if (this.title.text !== view.title) this.title.setText(view.title);
    if (this.detail.text !== view.detail) this.detail.setText(view.detail);
    const room = WIDTH - (TEXT_X + WIDTH / 2) - 110;
    this.title.setScale(Math.min(1, room / this.title.width));
    this.detail.setScale(Math.min(1, room / this.detail.width));
    if (this.timer.text !== view.timer) this.timer.setText(view.timer);
    const progress = Phaser.Math.Clamp(view.progress, 0, 1);
    this.fill.clear();
    if (progress > 0) {
      const w = Math.max(TRACK.height, TRACK.width * progress);
      this.fill.fillStyle(view.barColor, 1).fillRoundedRect(TRACK.x, TRACK.y - TRACK.height / 2, w, TRACK.height, 7);
      this.fill.fillStyle(0xffffff, 0.45).fillRoundedRect(TRACK.x + 3, TRACK.y - TRACK.height / 2 + 2, Math.max(0, w - 6), TRACK.height * 0.35, 3);
    }
  }

  hide(): void {
    if (!this.visible || this.hiding) return;
    this.hiding = true;
    this.scene.tweens.add({
      targets: this,
      scale: 0.4,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.hiding = false;
        this.setVisible(false);
      },
    });
  }
}
