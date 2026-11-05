import Phaser from 'phaser';
import { LANGUAGES, type Locale, getLocale, setLocale, t } from '../../i18n';
import { audio } from '../audio';
import { PALETTE } from '../config';
import { saveSettings, settings } from '../settings';
import { BUTTON_STYLES, Button } from './Button';
import { createModalCard, modalText } from './modalCard';

const CARD_WIDTH = 760;
const CARD_HEIGHT = 820;
const ROW_GAP = 130;
const LANGUAGE_BUTTON = { width: 162, height: 84, gap: 12 };

type Toggle = 'sound' | 'music';

// Sound and music switches and the language. (Ad consent will join here before release.)
export class SettingsModal extends Phaser.GameObjects.Container {
  // onLanguageChange runs after a new language is chosen; the caller redraws its texts.
  constructor(scene: Phaser.Scene, depth: number, onLanguageChange: () => void) {
    super(scene, 0, 0);
    const card = createModalCard(scene, CARD_WIDTH, CARD_HEIGHT, t('settings.title'));
    const { cx, top } = card;
    const left = cx - CARD_WIDTH / 2 + 70;
    const rows = (['sound', 'music'] as Toggle[]).flatMap((key, i) => {
      const y = top + 220 + i * ROW_GAP;
      const label = modalText(scene, card, CARD_WIDTH, y, t(`settings.${key}`), 42, PALETTE.ink, true).setOrigin(0, 0.5);
      label.x = left;
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

    // Language: one button per language, the current one highlighted.
    const languageY = top + 220 + 2 * ROW_GAP;
    const languageLabel = modalText(scene, card, CARD_WIDTH, languageY, t('settings.language'), 42, PALETTE.ink, true).setOrigin(0, 0.5);
    languageLabel.x = left;
    const { width, height, gap } = LANGUAGE_BUTTON;
    const rowWidth = LANGUAGES.length * width + (LANGUAGES.length - 1) * gap;
    const languages = LANGUAGES.map(({ id, name }, i) => {
      const x = cx - rowWidth / 2 + width / 2 + i * (width + gap);
      const button = new Button(scene, x, languageY + 110, width, height, () => this.chooseLanguage(id, onLanguageChange));
      button.setLabel(name).setButtonStyle(id === getLocale() ? BUTTON_STYLES.toggle : BUTTON_STYLES.disabled, true);
      return button;
    });

    const close = new Button(scene, cx, top + CARD_HEIGHT - 80, 320, 90, () => this.destroy());
    close.setLabel(t('settings.close')).setButtonStyle(BUTTON_STYLES.primary);

    this.add([...card.objects, ...rows, languageLabel, ...languages, close]);
    this.setDepth(depth);
    scene.add.existing(this);
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
  }

  private chooseLanguage(locale: Locale, onLanguageChange: () => void): void {
    if (locale === getLocale()) return;
    setLocale(locale);
    settings.language = locale;
    saveSettings();
    this.destroy();
    onLanguageChange();
  }
}
