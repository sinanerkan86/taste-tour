import Phaser from 'phaser';
import { OFFLINE } from '../../core/economy';
import { formatNumber } from '../../core/format';
import type { OfflineReward } from '../../core/save';
import { t, tDuration } from '../../i18n';
import { FONT, GAME_HEIGHT, GAME_WIDTH, PALETTE, toCss } from '../config';
import { BUTTON_STYLES, Button } from './Button';

const CARD_WIDTH = 860;
const CARD_HEIGHT = 640;

// Blocks the game until the player collects what the restaurant earned while they were away.
export class WelcomeBackModal extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, reward: OfflineReward, depth: number, onCollect: () => void) {
    super(scene, 0, 0);
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0).setInteractive();

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 80;
    const card = scene.add.graphics();
    card.fillStyle(PALETTE.ink, 0.35).fillRoundedRect(cx - CARD_WIDTH / 2, cy - CARD_HEIGHT / 2 + 12, CARD_WIDTH, CARD_HEIGHT, 40);
    card.fillStyle(PALETTE.cream, 1).fillRoundedRect(cx - CARD_WIDTH / 2, cy - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 40);
    card.fillStyle(PALETTE.pomegranate, 1).fillRoundedRect(cx - CARD_WIDTH / 2, cy - CARD_HEIGHT / 2, CARD_WIDTH, 130, {
      tl: 40,
      tr: 40,
      bl: 0,
      br: 0,
    });

    const title = scene.add
      .text(cx, cy - CARD_HEIGHT / 2 + 65, t('offline.title'), {
        fontFamily: FONT,
        fontSize: '60px',
        fontStyle: 'bold',
        color: toCss(PALETTE.cream),
      })
      .setOrigin(0.5);
    const body = scene.add
      .text(cx, cy - 120, t('offline.body', { time: tDuration(reward.secondsAway) }), {
        fontFamily: FONT,
        fontSize: '36px',
        color: toCss(PALETTE.ink),
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    const amount = scene.add
      .text(cx + 40, cy + 20, formatNumber(reward.amount), {
        fontFamily: FONT,
        fontSize: '96px',
        fontStyle: 'bold',
        color: toCss(PALETTE.saffronDark),
      })
      .setOrigin(0.5);
    const coin = scene.add.image(amount.x - amount.width / 2 - 50, cy + 20, 'coin').setScale(1.3);

    const children: Phaser.GameObjects.GameObject[] = [dim, card, title, body, coin, amount];
    if (reward.secondsAway > reward.seconds) {
      const capped = scene.add
        .text(cx, cy + 105, t('offline.capped', { time: tDuration(OFFLINE.baseCapSeconds) }), {
          fontFamily: FONT,
          fontSize: '28px',
          color: toCss(PALETTE.muted),
        })
        .setOrigin(0.5);
      children.push(capped);
    }

    const button = new Button(scene, cx, cy + CARD_HEIGHT / 2 - 100, 460, 120, () => {
      this.destroy();
      onCollect();
    });
    button.setLabel(t('offline.collect')).setButtonStyle(BUTTON_STYLES.buy);
    children.push(button);

    this.add(children);
    this.setDepth(depth);
    scene.add.existing(this);

    // Pop in.
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
    scene.tweens.add({ targets: amount, scale: { from: 0.6, to: 1 }, duration: 450, ease: 'Back.easeOut' });
  }
}
