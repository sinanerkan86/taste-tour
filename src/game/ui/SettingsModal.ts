import Phaser from 'phaser';
import { LANGUAGES, type Locale, getLocale, setLocale, t } from '../../i18n';
import { ads } from '../ads/AdService';
import { audio } from '../audio';
import { notifications } from '../notifications';
import { PRIVACY_POLICY_URL, openExternal } from '../native';
import { PALETTE } from '../config';
import { saveSettings, settings } from '../settings';
import { BUTTON_STYLES, Button } from './Button';
import { createModalCard, modalText } from './modalCard';
import { plain } from './style';

const CARD_WIDTH = 760;
const CARD_HEIGHT = 1030;
// Extra room for the privacy options button, shown only to players who need it.
const PRIVACY_ROW = 120;
const ROW_GAP = 130;
const LANGUAGE_BUTTON = { width: 162, height: 84, gap: 12 };

type Toggle = 'sound' | 'music' | 'notifications';

// Sound, music and reminder switches, the language and (where the law requires it) the ad privacy choices.
export class SettingsModal extends Phaser.GameObjects.Container {
  // onLanguageChange runs after a new language is chosen; the caller redraws its texts.
  constructor(scene: Phaser.Scene, depth: number, onLanguageChange: () => void) {
    super(scene, 0, 0);
    const privacy = ads.privacyOptionsRequired;
    const cardHeight = CARD_HEIGHT + (privacy ? PRIVACY_ROW : 0);
    const card = createModalCard(scene, CARD_WIDTH, cardHeight, t('settings.title'));
    const { cx, top } = card;
    const left = cx - CARD_WIDTH / 2 + 70;
    const toggles: Toggle[] = ['sound', 'music', 'notifications'];
    const rows = toggles.flatMap((key, i) => {
      const y = top + 220 + i * ROW_GAP;
      const label = modalText(scene, card, CARD_WIDTH, y, t(`settings.${key}`), 42, PALETTE.ink, true).setOrigin(0, 0.5);
      label.x = left;
      const button = new Button(scene, cx + CARD_WIDTH / 2 - 160, y, 200, 90, () => void flip());
      const flip = async () => {
        // Turning reminders on needs the system permission; refused, the switch stays off.
        const on = !settings[key];
        settings[key] = on && key === 'notifications' ? await notifications.requestPermission() : on;
        if (key === 'notifications') settings.notificationsAsked = true;
        saveSettings();
        audio.applySettings();
        if (button.active) show();
      };
      const show = () =>
        button
          .setLabel(t(settings[key] ? 'settings.on' : 'settings.off'))
          .setButtonStyle(settings[key] ? BUTTON_STYLES.toggle : BUTTON_STYLES.disabled, true);
      show();
      return [label, button];
    });

    // Language: one button per language, the current one highlighted.
    const languageY = top + 220 + toggles.length * ROW_GAP;
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

    const extras: Phaser.GameObjects.GameObject[] = [];
    if (privacy) {
      const button = new Button(scene, cx, languageY + 110 + PRIVACY_ROW, 480, 84, () => void ads.showPrivacyOptions());
      button.setLabel(t('settings.privacy')).setButtonStyle(BUTTON_STYLES.toggle);
      extras.push(button);
    }

    // A plain link to the privacy policy, for every player.
    const policy = scene.add.text(cx, top + cardHeight - 165, t('settings.policy'), plain(32, PALETTE.muted, true)).setOrigin(0.5);
    const underline = scene.add.rectangle(cx, policy.y + 21, policy.width, 3, PALETTE.muted);
    policy.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      audio.play('click');
      openExternal(PRIVACY_POLICY_URL);
    });
    extras.push(policy, underline);

    const close = new Button(scene, cx, top + cardHeight - 80, 320, 90, () => this.destroy());
    close.setLabel(t('settings.close')).setButtonStyle(BUTTON_STYLES.primary);

    this.add([...card.objects, ...rows, languageLabel, ...languages, ...extras, close]);
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
