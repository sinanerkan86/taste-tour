import Phaser from 'phaser';
import { PERK_IDS, PRESTIGE, type PerkId, type PerkLevels } from '../../core/economy';
import { t } from '../../i18n';
import { FONT, PALETTE, toCss } from '../config';
import { ART_RES } from '../view/paint';
import { BUTTON_STYLES, Button } from './Button';
import { progressIcon } from './icons';
import { createModalCard, modalText } from './modalCard';
import { perkDescription, perkName } from './progressText';
import { card, wrapStyle } from './style';

const CARD_WIDTH = 940;
const OPTION = { width: 860, height: 250, gap: 30 };
const LIST_ROW = 130;

const OPTION_CARD = { top: 0xffffff, bottom: 0xfff0d6, border: 0xe6c49a, radius: 28 };

function optionTexts(scene: Phaser.Scene, x: number, y: number, id: PerkId, level: number, textWidth: number) {
  const name = scene.add
    .text(x, y - 30, perkName(id), { fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: toCss(PALETTE.ink) })
    .setOrigin(0, 1);
  name.setScale(Math.min(1, (textWidth - 120) / name.width));
  const tag = scene.add
    .text(x + name.displayWidth + 14, y - 34, level <= 1 ? t('perk.new') : t('perk.level', { level }), {
      fontFamily: FONT,
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: toCss(level <= 1 ? PALETTE.success : PALETTE.tileBlue),
      padding: { x: 8, y: 3 },
    })
    .setOrigin(0, 1);
  const desc = scene.add
    .text(x, y - 16, perkDescription(id, level), {
      fontFamily: FONT,
      fontSize: '28px',
      color: toCss(PALETTE.muted),
      lineSpacing: 4,
      wordWrap: wrapStyle(textWidth),
    })
    .setOrigin(0, 0);
  return [name, tag, desc];
}

// Shown after confirming a franchise: the player picks one of the offered perks.
export class PerkModal extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, offers: PerkId[], perks: PerkLevels, depth: number, onPick: (perk: PerkId) => void) {
    super(scene, 0, 0);
    const height = 300 + offers.length * (OPTION.height + OPTION.gap);
    const modal = createModalCard(scene, CARD_WIDTH, height, t('perk.title'));
    const { cx, top } = modal;
    const body = modalText(scene, modal, CARD_WIDTH, top + 185, t('perk.body'), 34, PALETTE.ink);
    const children: Phaser.GameObjects.GameObject[] = [...modal.objects, body];
    let picked = false;
    const pick = (id: PerkId) => {
      if (picked) return;
      picked = true;
      this.destroy();
      onPick(id);
    };

    offers.forEach((id, i) => {
      const y = top + 260 + OPTION.height / 2 + i * (OPTION.height + OPTION.gap);
      const left = cx - OPTION.width / 2;
      const bg = scene.add
        .image(cx, y, card(scene, 'perk-option', OPTION.width, OPTION.height, OPTION_CARD))
        .setScale(1 / ART_RES)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => pick(id));
      const icon = scene.add.image(left + 90, y, progressIcon(scene, id)).setScale(1.5 / ART_RES);
      const texts = optionTexts(scene, left + 175, y, id, perks[id] + 1, 440);
      const button = new Button(scene, left + OPTION.width - 125, y, 210, 100, () => pick(id));
      button.setLabel(t('perk.choose')).setButtonStyle(BUTTON_STYLES.go);
      children.push(bg, icon, ...texts, button);
      // Options slide in one after another.
      for (const object of [bg, icon, ...texts, button]) {
        const target = object as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Transform;
        target.setAlpha(0);
        scene.tweens.add({ targets: target, alpha: 1, x: { from: target.x + 80, to: target.x }, delay: 150 + i * 120, duration: 300, ease: 'Back.easeOut' });
      }
    });

    this.add(children);
    this.setDepth(depth);
    scene.add.existing(this);
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
  }
}

// Opened from the Chef Stars counter: the star bonus and every perk owned so far.
export class PerksModal extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, stars: number, perks: PerkLevels, depth: number) {
    super(scene, 0, 0);
    const owned = PERK_IDS.filter((id) => perks[id] > 0);
    const rows = Math.max(1, owned.length);
    const height = 400 + rows * LIST_ROW;
    const modal = createModalCard(scene, CARD_WIDTH, height, t('perks.title'));
    const { cx, top } = modal;
    const starsLine = modalText(
      scene,
      modal,
      CARD_WIDTH,
      top + 190,
      t('perks.stars', { value: Math.round(stars * PRESTIGE.bonusPerStar * 100) }),
      34,
      PALETTE.saffronDark,
      true,
    );
    const children: Phaser.GameObjects.GameObject[] = [...modal.objects, starsLine];
    if (owned.length === 0) {
      children.push(modalText(scene, modal, CARD_WIDTH, top + 260 + LIST_ROW / 2, t('perks.none'), 30, PALETTE.muted));
    }
    const left = cx - OPTION.width / 2;
    owned.forEach((id, i) => {
      const y = top + 260 + LIST_ROW / 2 + i * LIST_ROW;
      const icon = scene.add.image(left + 60, y, progressIcon(scene, id)).setScale(1.1 / ART_RES);
      const name = scene.add
        .text(left + 130, y - 4, `${perkName(id)}  ${t('perk.level', { level: perks[id] })}`, {
          fontFamily: FONT,
          fontSize: '32px',
          fontStyle: 'bold',
          color: toCss(PALETTE.ink),
        })
        .setOrigin(0, 1);
      const desc = scene.add
        .text(left + 130, y + 4, perkDescription(id, perks[id]), {
          fontFamily: FONT,
          fontSize: '26px',
          color: toCss(PALETTE.muted),
        })
        .setOrigin(0, 0);
      desc.setScale(Math.min(1, (OPTION.width - 150) / desc.width));
      children.push(icon, name, desc);
    });
    const close = new Button(scene, cx, top + height - 90, 360, 100, () => this.destroy());
    close.setLabel(t('settings.close')).setButtonStyle(BUTTON_STYLES.primary);
    children.push(close);

    this.add(children);
    this.setDepth(depth);
    scene.add.existing(this);
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
  }
}
