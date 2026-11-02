import Phaser from 'phaser';
import {
  DISH_MAX_LEVEL,
  DISHES,
  MILESTONE_BONUS,
  SECTION_IDS,
  dishCost,
  nextLockedDish,
  nextMilestone,
  scaledValue,
  sectionRates,
  sectionUpgradeCost,
  throughput,
  type EconomyState,
  type SectionId,
} from '../../core/economy';
import { formatNumber } from '../../core/format';
import { t, type TranslationKey } from '../../i18n';
import { FONT, GAME_HEIGHT, GAME_WIDTH, LAYOUT, PALETTE, toCss } from '../config';
import { DISH_COLORS, SECTION_COLORS } from '../colors';
import { BUTTON_STYLES, Button } from './Button';

const MARGIN = 24;
const ROW_HEIGHT = 100;
const ROW_GAP = 6;
const TAB_HEIGHT = 90;
const BUTTON_WIDTH = 270;


type Tab = 'restaurant' | 'menu';

interface RowView {
  title: string;
  level: string;
  detail: string;
  buttonLabel: string;
  buttonIcon: boolean;
  affordable: boolean;
  buyable: boolean;
  highlight: boolean;
  dimmed: boolean;
}

class UpgradeRow extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly level: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly tag: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Arc;
  private readonly iconLetter: Phaser.GameObjects.Text;
  private readonly glow: Phaser.GameObjects.Graphics;
  readonly button: Button;
  private lastHighlight: boolean | null = null;

  constructor(scene: Phaser.Scene, y: number, color: number, onBuy: () => void) {
    super(scene, 0, y);
    const width = GAME_WIDTH - MARGIN * 2;
    this.bg = scene.add.graphics();
    this.icon = scene.add.circle(MARGIN + 56, 0, 36, color);
    this.iconLetter = scene.add
      .text(MARGIN + 56, 0, '', { fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    this.title = scene.add
      .text(MARGIN + 112, -20, '', { fontFamily: FONT, fontSize: '32px', fontStyle: 'bold', color: toCss(PALETTE.ink) })
      .setOrigin(0, 0.5);
    this.level = scene.add
      .text(0, -18, '', { fontFamily: FONT, fontSize: '26px', color: toCss(PALETTE.muted) })
      .setOrigin(0, 0.5);
    this.tag = scene.add
      .text(0, -18, t('row.bottleneck'), {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: toCss(PALETTE.pomegranate),
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0, 0.5);
    this.detail = scene.add
      .text(MARGIN + 112, 22, '', { fontFamily: FONT, fontSize: '24px', color: toCss(PALETTE.muted) })
      .setOrigin(0, 0.5);
    this.button = new Button(scene, MARGIN + width - BUTTON_WIDTH / 2 - 14, 0, BUTTON_WIDTH, 80, onBuy, 'coin');
    this.glow = scene.add.graphics().setAlpha(0);
    this.glow.lineStyle(10, PALETTE.saffron, 1).strokeRoundedRect(MARGIN - 4, -ROW_HEIGHT / 2 - 4, width + 8, ROW_HEIGHT + 8, 20);
    this.add([this.bg, this.icon, this.iconLetter, this.title, this.level, this.tag, this.detail, this.button, this.glow]);
    scene.add.existing(this);
  }

  render(view: RowView): void {
    if (this.title.text !== view.title) {
      this.title.setText(view.title);
      this.iconLetter.setText(view.dimmed ? '?' : view.title.charAt(0).toUpperCase());
    }
    this.level.setText(view.level);
    this.level.x = this.title.x + this.title.width + 12;
    this.tag.setVisible(view.highlight);
    this.tag.x = this.level.x + this.level.width + (view.level ? 12 : 0);
    this.detail.setText(view.detail);
    this.setAlpha(view.dimmed ? 0.55 : 1);

    this.button.setVisible(view.buyable || view.buttonLabel !== '');
    this.button.setLabel(view.buttonLabel, view.buttonIcon);
    const style = view.buyable && view.affordable ? BUTTON_STYLES.buy : BUTTON_STYLES.disabled;
    this.button.setButtonStyle(style, view.buyable && view.affordable);

    if (this.lastHighlight !== view.highlight) {
      this.lastHighlight = view.highlight;
      const width = GAME_WIDTH - MARGIN * 2;
      this.bg.clear();
      this.bg.fillStyle(view.highlight ? 0xffe9e4 : PALETTE.cream, 1);
      this.bg.fillRoundedRect(MARGIN, -ROW_HEIGHT / 2, width, ROW_HEIGHT, 16);
      if (view.highlight) {
        this.bg.lineStyle(4, PALETTE.pomegranate, 1);
        this.bg.strokeRoundedRect(MARGIN, -ROW_HEIGHT / 2, width, ROW_HEIGHT, 16);
      }
    }
  }

  // Short flash after a purchase.
  pulse(): void {
    this.scene.tweens.add({ targets: this.icon, scale: 1.25, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  // Draws the eye to this row: a blinking outline and a bouncing buy button.
  flash(): void {
    this.scene.tweens.killTweensOf([this.glow, this.button]);
    this.glow.setAlpha(0);
    this.button.setScale(1);
    this.scene.tweens.add({ targets: this.glow, alpha: 1, duration: 180, yoyo: true, repeat: 2 });
    this.scene.tweens.add({ targets: this.button, scale: 1.12, duration: 180, yoyo: true, repeat: 2, ease: 'Quad.easeOut' });
  }
}

function milestoneText(level: number, bonus: number): string {
  const next = nextMilestone(level);
  return next === null ? '' : `  ·  ${t('row.nextMilestone', { bonus, level: next })}`;
}

export class UpgradePanel extends Phaser.GameObjects.Container {
  private tab: Tab = 'restaurant';
  private readonly sectionRows: UpgradeRow[];
  private readonly dishRows: UpgradeRow[];
  private readonly tabButtons: Record<Tab, Button>;

  constructor(
    scene: Phaser.Scene,
    onBuySection: (id: SectionId) => void,
    onBuyDish: (index: number) => void,
  ) {
    super(scene, 0, LAYOUT.panelTop);
    const bg = scene.add.graphics();
    bg.fillStyle(PALETTE.panel, 1);
    bg.fillRoundedRect(0, 0, GAME_WIDTH, GAME_HEIGHT - LAYOUT.panelTop + 40, 36);
    this.add(bg);

    const tabWidth = (GAME_WIDTH - MARGIN * 3) / 2;
    const tabY = 20 + TAB_HEIGHT / 2;
    this.tabButtons = {
      restaurant: new Button(scene, MARGIN + tabWidth / 2, tabY, tabWidth, TAB_HEIGHT, () => this.showTab('restaurant')),
      menu: new Button(scene, MARGIN * 2 + tabWidth * 1.5, tabY, tabWidth, TAB_HEIGHT, () => this.showTab('menu')),
    };
    this.tabButtons.restaurant.setLabel(t('tab.restaurant'));
    this.tabButtons.menu.setLabel(t('tab.menu'));
    this.add([this.tabButtons.restaurant, this.tabButtons.menu]);

    const rowY = (i: number) => 20 + TAB_HEIGHT + 24 + ROW_HEIGHT / 2 + i * (ROW_HEIGHT + ROW_GAP);
    this.sectionRows = SECTION_IDS.map(
      (id, i) => new UpgradeRow(scene, rowY(i), SECTION_COLORS[id], () => onBuySection(id)),
    );
    this.dishRows = DISHES.map((_, i) => new UpgradeRow(scene, rowY(i), DISH_COLORS[i], () => onBuyDish(i)));
    this.add([...this.sectionRows, ...this.dishRows]);

    this.showTab('restaurant');
    scene.add.existing(this);
  }

  pulseSection(id: SectionId): void {
    this.sectionRows[SECTION_IDS.indexOf(id)].pulse();
  }

  // Switches to the restaurant tab and points at the section's row.
  focusSection(id: SectionId): void {
    if (this.tab !== 'restaurant') this.showTab('restaurant');
    this.sectionRows[SECTION_IDS.indexOf(id)].flash();
  }

  pulseDish(index: number): void {
    this.dishRows[index].pulse();
  }

  private showTab(tab: Tab): void {
    this.tab = tab;
    this.sectionRows.forEach((row) => row.setVisible(tab === 'restaurant'));
    this.dishRows.forEach((row) => row.setVisible(tab === 'menu'));
    this.tabButtons.restaurant.setButtonStyle(tab === 'restaurant' ? BUTTON_STYLES.primary : BUTTON_STYLES.disabled);
    this.tabButtons.menu.setButtonStyle(tab === 'menu' ? BUTTON_STYLES.primary : BUTTON_STYLES.disabled);
  }

  refresh(state: EconomyState): void {
    if (this.tab === 'restaurant') this.refreshSections(state);
    else this.refreshDishes(state);
  }

  private refreshSections(state: EconomyState): void {
    const rates = sectionRates(state);
    const { bottleneck } = throughput(state);
    SECTION_IDS.forEach((id, i) => {
      const level = state.sectionLevels[id];
      const cost = sectionUpgradeCost(state, id);
      this.sectionRows[i].render({
        title: t(`section.${id}` as TranslationKey),
        level: t('row.level', { level }),
        detail: t('row.sectionRate', { rate: formatNumber(rates[id], 2) }) + milestoneText(level, MILESTONE_BONUS.section),
        buttonLabel: formatNumber(cost),
        buttonIcon: true,
        affordable: state.money >= cost,
        buyable: true,
        highlight: id === bottleneck,
        dimmed: false,
      });
    });
  }

  private refreshDishes(state: EconomyState): void {
    const nextLocked = nextLockedDish(state);
    DISHES.forEach((dish, i) => {
      const level = state.dishLevels[i];
      const cost = dishCost(state, i);
      const row = this.dishRows[i];
      const title = t(`dish.${dish.id}` as TranslationKey);
      if (level > 0) {
        const mastered = level >= DISH_MAX_LEVEL;
        row.render({
          title,
          level: t('row.level', { level }),
          detail:
            t('row.dishPrice', { price: formatNumber(scaledValue(dish.basePrice, level, MILESTONE_BONUS.dish)) }) +
            (mastered ? '' : milestoneText(level, MILESTONE_BONUS.dish)),
          buttonLabel: mastered ? t('row.mastered') : formatNumber(cost),
          buttonIcon: !mastered,
          affordable: state.money >= cost,
          buyable: !mastered,
          highlight: false,
          dimmed: false,
        });
      } else if (i === nextLocked) {
        row.render({
          title,
          level: '',
          detail: t('row.locked'),
          buttonLabel: formatNumber(cost),
          buttonIcon: true,
          affordable: state.money >= cost,
          buyable: true,
          highlight: false,
          dimmed: false,
        });
      } else {
        row.render({
          title: t('row.hidden'),
          level: '',
          detail: '',
          buttonLabel: '',
          buttonIcon: false,
          affordable: false,
          buyable: false,
          highlight: false,
          dimmed: true,
        });
      }
    });
  }
}
