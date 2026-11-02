import Phaser from 'phaser';
import { PRESTIGE } from '../../core/economy';
import { t } from '../../i18n';
import { FONT, GAME_HEIGHT, GAME_WIDTH, PALETTE, toCss } from '../config';
import { BUTTON_STYLES, Button } from './Button';

const CARD_WIDTH = 900;
const CARD_HEIGHT = 820;

export interface FranchiseOffer {
  // Localized name of the next city.
  city: string;
  starsNow: number;
  starsGained: number;
}

function bonusPercent(stars: number): number {
  return Math.round(stars * PRESTIGE.bonusPerStar * 100);
}

// Asks the player to confirm selling the restaurant and moving to the next city.
export class FranchiseModal extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, offer: FranchiseOffer, depth: number, onConfirm: () => void) {
    super(scene, 0, 0);
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0).setInteractive();

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 60;
    const top = cy - CARD_HEIGHT / 2;
    const card = scene.add.graphics();
    card.fillStyle(PALETTE.ink, 0.35).fillRoundedRect(cx - CARD_WIDTH / 2, top + 12, CARD_WIDTH, CARD_HEIGHT, 40);
    card.fillStyle(PALETTE.cream, 1).fillRoundedRect(cx - CARD_WIDTH / 2, top, CARD_WIDTH, CARD_HEIGHT, 40);
    card.fillStyle(PALETTE.pomegranate, 1).fillRoundedRect(cx - CARD_WIDTH / 2, top, CARD_WIDTH, 130, {
      tl: 40,
      tr: 40,
      bl: 0,
      br: 0,
    });

    const text = (y: number, value: string, size: number, color: number, bold = false) =>
      scene.add
        .text(cx, y, value, {
          fontFamily: FONT,
          fontSize: `${size}px`,
          fontStyle: bold ? 'bold' : 'normal',
          color: toCss(color),
          align: 'center',
          lineSpacing: 10,
          wordWrap: { width: CARD_WIDTH - 100 },
        })
        .setOrigin(0.5);

    const title = text(top + 65, t('franchise.title'), 58, PALETTE.cream, true);
    const body = text(top + 225, t('franchise.body', { city: offer.city }), 34, PALETTE.ink);
    const stars = text(top + 375, t('franchise.stars', { stars: offer.starsGained }), 64, PALETTE.saffronDark, true);
    const star = scene.add.image(stars.x - stars.width / 2 - 50, stars.y, 'star').setScale(1.1);
    const bonus = text(
      top + 460,
      t('franchise.bonus', { from: bonusPercent(offer.starsNow), to: bonusPercent(offer.starsNow + offer.starsGained) }),
      34,
      PALETTE.success,
      true,
    );
    const reset = text(top + 530, t('franchise.reset'), 28, PALETTE.muted);

    const confirm = new Button(scene, cx, top + CARD_HEIGHT - 200, 520, 120, () => {
      this.destroy();
      onConfirm();
    });
    confirm.setLabel(t('franchise.confirm', { city: offer.city })).setButtonStyle(BUTTON_STYLES.buy);
    const cancel = new Button(scene, cx, top + CARD_HEIGHT - 75, 360, 90, () => this.destroy());
    cancel.setLabel(t('franchise.cancel')).setButtonStyle(BUTTON_STYLES.disabled, true);

    this.add([dim, card, title, body, star, stars, bonus, reset, confirm, cancel]);
    this.setDepth(depth);
    scene.add.existing(this);

    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
    scene.tweens.add({ targets: [stars, star], scale: { from: 0.6, to: 1 }, duration: 450, ease: 'Back.easeOut' });
  }
}
