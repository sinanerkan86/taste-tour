import Phaser from 'phaser';
import { FONT, PALETTE, toCss } from '../config';
import { type Ctx, ART_RES, paintTexture } from '../view/paint';
import { card } from './style';

const WIDTH = 200;
const HEIGHT = 76;
const ICON_X = -WIDTH / 2 + 40;
const TEXT_X = ICON_X + 38;
const TEXT_WIDTH = WIDTH / 2 - 12 - TEXT_X;
const ICON_SIZE = 56;

export type DayIcon = 'sun' | 'sunset' | 'moon';

export interface DayChipView {
  icon: DayIcon;
  // First line: the phase. Second line: the time to the next rush, or left of this one.
  title: string;
  subtitle: string;
  // A rush is on: the chip is red.
  rush: boolean;
}

// A small card at the top left of the restaurant showing the time of day: a sun, sunset or moon, the
// phase and the time to the next rush. Tapping it explains the day.
export class DayChip extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private view: DayChipView | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, onTap: () => void) {
    super(scene, x, y);
    this.face = scene.add.image(0, 4, this.cardKey(false)).setScale(1 / ART_RES);
    this.icon = scene.add.image(ICON_X, 0, iconTexture(scene, 'sun')).setScale(1 / ART_RES);
    const text = (size: number, color: number) =>
      scene.add.text(TEXT_X, 0, '', { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: toCss(color) }).setOrigin(0, 0.5);
    this.title = text(25, PALETTE.ink).setY(-13);
    this.subtitle = text(21, PALETTE.muted).setY(14);
    this.add([this.face, this.icon, this.title, this.subtitle]);
    this.setSize(WIDTH, HEIGHT).setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      scene.tweens.add({ targets: this, scale: 0.94, duration: 70, yoyo: true });
      onTap();
    });
    scene.add.existing(this);
  }

  private cardKey(rush: boolean): string {
    return card(this.scene, rush ? 'day-card-rush' : 'day-card', WIDTH, HEIGHT, rush
      ? { top: 0xfff2e0, bottom: 0xffc79a, border: PALETTE.pomegranate, radius: HEIGHT / 2, borderWidth: 5 }
      : { top: 0xfffdf6, bottom: 0xffe9c4, border: 0xf0a020, radius: HEIGHT / 2 });
  }

  render(view: DayChipView): void {
    const old = this.view;
    this.view = view;
    if (!old || old.rush !== view.rush) this.face.setTexture(this.cardKey(view.rush));
    if (!old || old.icon !== view.icon) this.icon.setTexture(iconTexture(this.scene, view.icon));
    this.fit(this.title, view.title);
    this.fit(this.subtitle, view.subtitle);
  }

  // Long words in other languages shrink to fit the chip.
  private fit(label: Phaser.GameObjects.Text, text: string): void {
    if (label.text !== text) label.setText(text);
    label.setScale(Math.min(1, TEXT_WIDTH / Math.max(label.width, 1)));
  }
}

function iconTexture(scene: Phaser.Scene, icon: DayIcon): string {
  return paintTexture(scene, `day-icon-${icon}`, ICON_SIZE, ICON_SIZE, (ctx) => {
    ctx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
    if (icon === 'moon') paintMoon(ctx);
    else paintSun(ctx, icon === 'sunset');
  });
}

function paintSun(ctx: Ctx, low: boolean): void {
  const color = low ? '#f08a2c' : '#f4b400';
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 17, Math.sin(angle) * 17);
    ctx.lineTo(Math.cos(angle) * 25, Math.sin(angle) * 25);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 14);
  g.addColorStop(0, low ? '#ffd27a' : '#fff0a0');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = low ? '#b0561a' : '#b07f00';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function paintMoon(ctx: Ctx): void {
  // A crescent: a disc with a bite taken out of it.
  ctx.fillStyle = '#5a6fb8';
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(10, -7, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffe9a8';
  [
    [14, 11, 2.4],
    [20, -2, 1.8],
  ].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
}
