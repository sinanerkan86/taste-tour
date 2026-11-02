import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE, toCss } from '../config';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

// Placeholder scene: proves rendering, input, tweens and the update loop all work.
export class RestaurantScene extends Phaser.Scene {
  private money = 0;
  private moneyText!: Phaser.GameObjects.Text;
  private steam!: Phaser.GameObjects.Ellipse[];
  private elapsed = 0;

  constructor() {
    super('Restaurant');
  }

  create(): void {
    this.drawRoom();
    this.drawHud();
    this.drawStove();
    this.drawServeButton();
  }

  // Called every frame; delta is milliseconds since the previous frame.
  update(_time: number, delta: number): void {
    this.elapsed += delta / 1000;
    this.steam.forEach((puff, i) => {
      const t = (this.elapsed * 0.6 + i / this.steam.length) % 1;
      puff.y = 560 - t * 120;
      puff.x = 360 + Math.sin((this.elapsed + i) * 2) * 10;
      puff.setAlpha(0.6 * (1 - t));
      puff.setScale(0.6 + t);
    });
  }

  private drawRoom(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, 700, PALETTE.wall).setOrigin(0);
    // Tile band along the wall.
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      const color = (x / 40) % 2 === 0 ? PALETTE.tileBlue : 0x2f8fb0;
      this.add.rectangle(x, 640, 40, 60, color).setOrigin(0);
    }
    // Wooden floor planks.
    for (let i = 0, y = 700; y < GAME_HEIGHT; i++, y += 60) {
      const color = i % 2 === 0 ? PALETTE.floor : PALETTE.floorDark;
      this.add.rectangle(0, y, GAME_WIDTH, 60, color).setOrigin(0);
    }
  }

  private drawHud(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, 120, PALETTE.pomegranate).setOrigin(0);
    this.add
      .text(GAME_WIDTH / 2, 40, 'TASTE TOUR', {
        fontFamily: FONT,
        fontSize: '40px',
        fontStyle: 'bold',
        color: toCss(PALETTE.cream),
      })
      .setOrigin(0.5);
    this.add.image(GAME_WIDTH / 2 - 70, 90, 'coin').setScale(0.6);
    this.moneyText = this.add
      .text(GAME_WIDTH / 2 - 45, 90, '0', {
        fontFamily: FONT,
        fontSize: '32px',
        fontStyle: 'bold',
        color: toCss(PALETTE.saffron),
      })
      .setOrigin(0, 0.5);
  }

  private drawStove(): void {
    this.add.rectangle(360, 640, 260, 110, PALETTE.ink).setOrigin(0.5);
    this.add.circle(320, 590, 26, 0x555555);
    this.add.circle(400, 590, 26, 0x555555);
    this.add.rectangle(360, 570, 120, 40, 0x8c8c8c).setOrigin(0.5);
    this.steam = Array.from({ length: 5 }, () => this.add.ellipse(360, 540, 40, 30, 0xffffff, 0.6));
  }

  private drawServeButton(): void {
    const button = this.add.container(GAME_WIDTH / 2, 1050);
    const shadow = this.add.rectangle(0, 8, 320, 110, 0x7a241b).setOrigin(0.5);
    const face = this.add.rectangle(0, 0, 320, 110, PALETTE.pomegranate).setOrigin(0.5);
    const label = this.add
      .text(0, 0, 'SERVE!', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    button.add([shadow, face, label]);
    button.setSize(320, 110).setInteractive({ useHandCursor: true });

    button.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.tweens.add({ targets: button, scale: 0.92, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
      this.earn(1, pointer.x, pointer.y);
    });
  }

  private earn(amount: number, x: number, y: number): void {
    this.money += amount;
    this.moneyText.setText(String(this.money));
    this.tweens.add({ targets: this.moneyText, scale: 1.25, duration: 80, yoyo: true });

    // Coin flies to the HUD counter.
    const coin = this.add.image(x, y, 'coin');
    this.tweens.add({
      targets: coin,
      x: GAME_WIDTH / 2 - 70,
      y: 90,
      scale: 0.6,
      duration: 500,
      ease: 'Cubic.easeIn',
      onComplete: () => coin.destroy(),
    });

    // Floating "+1" label.
    const popup = this.add
      .text(x, y - 40, `+${amount}`, {
        fontFamily: FONT,
        fontSize: '36px',
        fontStyle: 'bold',
        color: toCss(PALETTE.saffron),
        stroke: toCss(PALETTE.ink),
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: popup,
      y: y - 140,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }
}
