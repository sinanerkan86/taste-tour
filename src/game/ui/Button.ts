import Phaser from 'phaser';
import { type Sfx, audio } from '../audio';
import { ART_RES } from '../view/paint';
import { LIP, glossyButton, outlined } from './style';

export interface ButtonStyle {
  face: number;
  // Label color and its outline.
  text: number;
  stroke: number;
}

export const BUTTON_STYLES = {
  buy: { face: 0xffbe1a, text: 0xffffff, stroke: 0x8a4a00 },
  primary: { face: 0xec4a3c, text: 0xffffff, stroke: 0x7a1a12 },
  disabled: { face: 0xcbc0b2, text: 0xf7f2ea, stroke: 0x8a7f72 },
  toggle: { face: 0x2fa4d8, text: 0xffffff, stroke: 0x0f4a6a },
  go: { face: 0x5cc23a, text: 0xffffff, stroke: 0x245a10 },
} satisfies Record<string, ButtonStyle>;

// A glossy candy button. Children are positioned relative to the container's center.
export class Button extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon?: Phaser.GameObjects.Image;
  private style: ButtonStyle | null = null;
  private enabled = true;
  // Played on a press while enabled; null for silence.
  sound: Sfx | null = 'click';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly buttonWidth: number,
    private readonly buttonHeight: number,
    onClick: () => void,
    iconKey?: string,
  ) {
    super(scene, x, y);
    const w = buttonWidth;
    const h = buttonHeight;
    this.face = scene.add.image(0, 0, '__DEFAULT').setScale(1 / ART_RES);
    const size = Math.round(Math.min(38, h * 0.4));
    this.label = scene.add.text(0, -LIP / 2, '', outlined(size)).setOrigin(0.5);
    this.add([this.face, this.label]);
    if (iconKey) {
      this.icon = scene.add.image(0, -LIP / 2, iconKey).setScale(Math.min(0.75, (h * 0.5) / 64));
      this.add(this.icon);
    }
    this.setSize(w, h).setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      audio.unlock();
      if (this.sound) audio.play(this.sound);
      scene.tweens.add({ targets: this, scale: 0.93, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
      onClick();
    });
    this.setButtonStyle(BUTTON_STYLES.buy);
    scene.add.existing(this);
  }

  setLabel(text: string, showIcon = true): this {
    if (this.label.text !== text) this.label.setText(text);
    // Center icon + label together.
    if (this.icon) {
      this.icon.setVisible(showIcon);
      const gap = 10;
      const iconWidth = showIcon ? this.icon.displayWidth + gap : 0;
      const left = -(iconWidth + this.label.width) / 2;
      this.icon.x = left + this.icon.displayWidth / 2;
      this.label.x = left + iconWidth + this.label.width / 2;
    }
    return this;
  }

  setButtonStyle(style: ButtonStyle, enabled = true): this {
    if (this.style === style && this.enabled === enabled) return this;
    this.style = style;
    this.enabled = enabled;
    this.face.setTexture(glossyButton(this.scene, this.buttonWidth, this.buttonHeight, { face: style.face }));
    this.label.setColor(`#${style.text.toString(16).padStart(6, '0')}`);
    this.label.setStroke(`#${style.stroke.toString(16).padStart(6, '0')}`, this.label.style.strokeThickness);
    this.icon?.setAlpha(style === BUTTON_STYLES.disabled ? 0.6 : 1);
    return this;
  }
}
