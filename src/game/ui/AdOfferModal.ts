import Phaser from 'phaser';
import { t } from '../../i18n';
import { PALETTE } from '../config';
import { BUTTON_STYLES, Button } from './Button';
import { createModalCard, modalText } from './modalCard';

const CARD_WIDTH = 860;
const CARD_HEIGHT = 680;

export interface AdOffer {
  title: string;
  body: string;
  // The reward in big letters, e.g. "2x" or "+1.2M".
  reward: string;
  // Texture shown next to the reward, if any.
  rewardIcon?: string;
}

// Explains what a rewarded ad gives before the ad starts, so the player chooses to watch it.
export class AdOfferModal extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, offer: AdOffer, depth: number, onWatch: () => void) {
    super(scene, 0, 0);
    const card = createModalCard(scene, CARD_WIDTH, CARD_HEIGHT, offer.title);
    const { cx, top } = card;

    const body = modalText(scene, card, CARD_WIDTH, top + 215, offer.body, 34, PALETTE.ink);
    const reward = modalText(scene, card, CARD_WIDTH, top + 365, offer.reward, 96, PALETTE.saffronDark, true);
    const children: Phaser.GameObjects.GameObject[] = [...card.objects, body, reward];
    if (offer.rewardIcon) {
      reward.setX(cx + 40);
      children.push(scene.add.image(reward.x - reward.width / 2 - 50, reward.y, offer.rewardIcon).setScale(1.3));
    }

    const watch = new Button(
      scene,
      cx,
      top + CARD_HEIGHT - 180,
      480,
      120,
      () => {
        this.destroy();
        onWatch();
      },
      'ad',
    );
    watch.setLabel(t('ads.watch')).setButtonStyle(BUTTON_STYLES.buy);
    const cancel = new Button(scene, cx, top + CARD_HEIGHT - 70, 360, 90, () => this.destroy());
    cancel.setLabel(t('ads.noThanks')).setButtonStyle(BUTTON_STYLES.disabled, true);
    children.push(watch, cancel);

    this.add(children);
    this.setDepth(depth);
    scene.add.existing(this);

    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
    scene.tweens.add({ targets: reward, scale: { from: 0.6, to: 1 }, duration: 450, ease: 'Back.easeOut' });
  }
}
