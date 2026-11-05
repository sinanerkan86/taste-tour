import Phaser from 'phaser';
import { FONT, PALETTE, toCss } from '../config';

export interface ButtonStyle {
  face: number;
  shadow: number;
  text: number;
}

export const BUTTON_STYLES = {
  buy: { face: PALETTE.saffron, shadow: PALETTE.saffronDark, text: PALETTE.ink },
  primary: { face: PALETTE.pomegranate, shadow: PALETTE.pomegranateDark, text: PALETTE.cream },
  disabled: { face: PALETTE.disabled, shadow: PALETTE.disabledDark, text: PALETTE.muted },
  toggle: { face: PALETTE.tileBlue, shadow: 0x134a5e, text: PALETTE.cream },
} satisfies Record<string, ButtonStyle>;

const SHADOW_DEPTH = 8;

// A rounded "3D" button. Children are positioned relative to the container's center.
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon?: Phaser.GameObjects.Image;
  private style: ButtonStyle = BUTTON_STYLES.buy;
  private enabled = true;

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
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, -SHADOW_DEPTH / 2, '', { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    if (iconKey) {
      this.icon = scene.add.image(0, -SHADOW_DEPTH / 2, iconKey).setScale(0.75);
      this.add(this.icon);
    }
    this.setSize(w, h).setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, scale: 0.93, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
      onClick();
    });
    this.redraw();
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
    this.redraw();
    return this;
  }

  private redraw(): void {
    const w = this.buttonWidth;
    const h = this.buttonHeight;
    const radius = 18;
    this.bg.clear();
    this.bg.fillStyle(this.style.shadow, 1);
    this.bg.fillRoundedRect(-w / 2, -h / 2 + SHADOW_DEPTH, w, h - SHADOW_DEPTH, radius);
    this.bg.fillStyle(this.style.face, 1);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h - SHADOW_DEPTH, radius);
    this.label.setColor(toCss(this.style.text));
  }
}
