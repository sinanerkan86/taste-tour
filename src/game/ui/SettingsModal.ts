import Phaser from 'phaser';
import { t } from '../../i18n';
import { audio } from '../audio';
import { PALETTE } from '../config';
import { saveSettings, settings } from '../settings';
import { BUTTON_STYLES, Button } from './Button';
import { createModalCard, modalText } from './modalCard';

const CARD_WIDTH = 760;
const CARD_HEIGHT = 560;
const ROW_GAP = 130;

type Toggle = 'sound' | 'music';

// Sound and music switches. (Language and ad consent will join here before release.)
export class SettingsModal extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, depth: number) {
    super(scene, 0, 0);
    const card = createModalCard(scene, CARD_WIDTH, CARD_HEIGHT, t('settings.title'));
    const { cx, top } = card;
    const rows = (['sound', 'music'] as Toggle[]).flatMap((key, i) => {
      const y = top + 220 + i * ROW_GAP;
      const label = modalText(scene, card, CARD_WIDTH, y, t(`settings.${key}`), 42, PALETTE.ink, true).setOrigin(0, 0.5);
      label.x = cx - CARD_WIDTH / 2 + 70;
      const button = new Button(scene, cx + CARD_WIDTH / 2 - 160, y, 200, 90, () => {
        settings[key] = !settings[key];
        saveSettings();
        audio.applySettings();
        show();
      });
      const show = () =>
        button
          .setLabel(t(settings[key] ? 'settings.on' : 'settings.off'))
          .setButtonStyle(settings[key] ? BUTTON_STYLES.toggle : BUTTON_STYLES.disabled, true);
      show();
      return [label, button];
    });
    const close = new Button(scene, cx, top + CARD_HEIGHT - 80, 320, 90, () => this.destroy());
    close.setLabel(t('settings.close')).setButtonStyle(BUTTON_STYLES.primary);

    this.add([...card.objects, ...rows, close]);
    this.setDepth(depth);
    scene.add.existing(this);
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
  }
}
