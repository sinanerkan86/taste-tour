import Phaser from 'phaser';
import { PRESTIGE } from '../../core/economy';
import { t } from '../../i18n';
import { PALETTE } from '../config';
import { BUTTON_STYLES, Button } from './Button';
import { createModalCard, modalText } from './modalCard';

const CARD_WIDTH = 900;
const CARD_HEIGHT = 900;

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
    const card = createModalCard(scene, CARD_WIDTH, CARD_HEIGHT, t('franchise.title'));
    const { cx, top } = card;
    const text = (y: number, value: string, size: number, color: number, bold = false) =>
      modalText(scene, card, CARD_WIDTH, y, value, size, color, bold);

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
    const perk = text(top + 600, t('franchise.perk'), 32, PALETTE.tileBlue, true);

    const confirm = new Button(scene, cx, top + CARD_HEIGHT - 200, 520, 120, () => {
      this.destroy();
      onConfirm();
    });
    confirm.setLabel(t('franchise.confirm', { city: offer.city })).setButtonStyle(BUTTON_STYLES.buy);
    const cancel = new Button(scene, cx, top + CARD_HEIGHT - 75, 360, 90, () => this.destroy());
    cancel.setLabel(t('franchise.cancel')).setButtonStyle(BUTTON_STYLES.disabled, true);

    this.add([...card.objects, body, star, stars, bonus, reset, perk, confirm, cancel]);
    this.setDepth(depth);
    scene.add.existing(this);

    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
    scene.tweens.add({ targets: [stars, star], scale: { from: 0.6, to: 1 }, duration: 450, ease: 'Back.easeOut' });
  }
}
