import Phaser from 'phaser';
import { ADS } from '../../core/economy';
import { formatNumber } from '../../core/format';
import type { OfflineReward } from '../../core/save';
import { t, tDuration } from '../../i18n';
import { PALETTE } from '../config';
import { BUTTON_STYLES, Button } from './Button';
import { adIcon } from '../ads/AdService';
import { createModalCard, modalText } from './modalCard';

const CARD_WIDTH = 860;
const CARD_HEIGHT = 640;
// Extra room for the "research finished" line.
const RESEARCH_HEIGHT = 80;
const BUTTON_WIDTH = 370;

// Blocks the game until the player collects what the restaurant earned while they were away,
// either as is or multiplied by watching a rewarded ad.
export class WelcomeBackModal extends Phaser.GameObjects.Container {
  private busy = false;

  constructor(
    scene: Phaser.Scene,
    reward: OfflineReward,
    depth: number,
    onCollect: (multiplier: number) => void,
    watchAd: () => Promise<boolean>,
    // Names of lab projects that finished while the player was away.
    research: string[] = [],
  ) {
    super(scene, 0, 0);
    const height = CARD_HEIGHT + (research.length > 0 ? RESEARCH_HEIGHT : 0);
    const card = createModalCard(scene, CARD_WIDTH, height, t('offline.title'));
    const { cx, top } = card;
    const cy = top + CARD_HEIGHT / 2;

    const body = modalText(scene, card, CARD_WIDTH, cy - 120, t('offline.body', { time: tDuration(reward.secondsAway) }), 36, PALETTE.ink);
    const amount = modalText(scene, card, CARD_WIDTH, cy + 20, formatNumber(reward.amount), 96, PALETTE.saffronDark, true);
    amount.setX(cx + 40);
    const coin = scene.add.image(amount.x - amount.width / 2 - 50, cy + 20, 'coin').setScale(1.3);

    const children: Phaser.GameObjects.GameObject[] = [...card.objects, body, coin, amount];
    if (reward.secondsAway > reward.seconds) {
      children.push(
        modalText(scene, card, CARD_WIDTH, cy + 105, t('offline.capped', { time: tDuration(reward.capSeconds) }), 28, PALETTE.muted),
      );
    }
    if (research.length > 0) {
      const line = modalText(scene, card, CARD_WIDTH, cy + 170, t('offline.research', { names: research.join(', ') }), 32, PALETTE.success, true);
      children.push(line);
      scene.tweens.add({ targets: line, scale: 1.06, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const buttonY = top + height - 100;
    const collect = new Button(scene, cx - BUTTON_WIDTH / 2 - 15, buttonY, BUTTON_WIDTH, 120, () => {
      if (this.busy) return;
      this.destroy();
      onCollect(1);
    });
    collect.setLabel(t('offline.collect')).setButtonStyle(BUTTON_STYLES.primary);
    const double = new Button(
      scene,
      cx + BUTTON_WIDTH / 2 + 15,
      buttonY,
      BUTTON_WIDTH,
      120,
      () => void this.collectWithAd(onCollect, watchAd),
      adIcon(),
    );
    double.setLabel(t('offline.collectMore', { multiplier: ADS.offlineMultiplier })).setButtonStyle(BUTTON_STYLES.buy);
    children.push(collect, double);

    this.add(children);
    this.setDepth(depth);
    scene.add.existing(this);

    // Pop in.
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
    scene.tweens.add({ targets: amount, scale: { from: 0.6, to: 1 }, duration: 450, ease: 'Back.easeOut' });
  }

  // A skipped ad leaves the dialog open so the player can still collect normally.
  private async collectWithAd(onCollect: (multiplier: number) => void, watchAd: () => Promise<boolean>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const watched = await watchAd();
    this.busy = false;
    if (!watched || !this.active) return;
    this.destroy();
    onCollect(ADS.offlineMultiplier);
  }
}
