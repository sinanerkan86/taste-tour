import Phaser from 'phaser';
import {
  BUY_AMOUNTS,
  DISH_MAX_LEVEL,
  DISH_TIERS,
  MILESTONE_BONUS,
  SECTION_IDS,
  cityConfig,
  dishBuyPlan,
  dishCost,
  dishPrice,
  nextLockedDish,
  nextMilestone,
  sectionBuyPlan,
  sectionRates,
  throughput,
  type BuyAmount,
  type EconomyState,
  type SectionId,
} from '../../core/economy';
import { formatNumber } from '../../core/format';
import { t, type TranslationKey } from '../../i18n';
import { FONT, GAME_WIDTH, LAYOUT, PALETTE, toCss } from '../config';
import { DISH_COLORS, SECTION_COLORS } from '../colors';
import { BUTTON_STYLES, Button } from './Button';
import { dishIcon, lockIcon, sectionIcon } from './icons';
import { ART_RES, paintTexture, roundRect, vGradient } from '../view/paint';
import { card } from './style';
import { saveSettings, settings } from '../settings';

const MARGIN = 24;
const ROW_HEIGHT = 100;
const ROW_GAP = 6;
const TAB_HEIGHT = 90;
const BUTTON_WIDTH = 270;
const AMOUNT_WIDTH = 150;



type Tab = 'restaurant' | 'menu';

const ROW_CARDS = {
  normal: { top: 0xffffff, bottom: 0xfff0d6, border: 0xe6c49a, radius: 24 },
  highlight: { top: 0xfff2ee, bottom: 0xffd2c6, border: 0xec4a3c, radius: 24, borderWidth: 5 },
};

// Warm cream sheet with a glossy top edge, like a menu card.
function paintPanelBackground(scene: Phaser.Scene): string {
  const height = LAYOUT.panelHeight + 60;
  return paintTexture(scene, 'panel-bg', GAME_WIDTH, height, (ctx) => {
    ctx.fillStyle = 'rgba(40,15,5,0.3)';
    roundRect(ctx, 0, 0, GAME_WIDTH, height, 44);
    ctx.fill();
    ctx.fillStyle = '#c98a4a';
    roundRect(ctx, 0, 6, GAME_WIDTH, height, 44);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, 12, height, [
      [0, '#fff8ea'],
      [0.25, '#fbeccf'],
      [1, '#f3dcb6'],
    ]);
    roundRect(ctx, 0, 13, GAME_WIDTH, height, 40);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    roundRect(ctx, 40, 18, GAME_WIDTH - 80, 6, 3);
    ctx.fill();
  });
}

interface RowView {
  title: string;
  level: string;
  detail: string;
  buttonLabel: string;
  buttonIcon: boolean;
  affordable: boolean;
  buyable: boolean;
  highlight: boolean;
  // Texture key of the row's badge.
  icon: string;
  // Not available yet: faded, with a padlock over the badge.
  locked: boolean;
}

class UpgradeRow extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly level: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly tag: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly lock: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Graphics;
  readonly button: Button;
  private lastHighlight: boolean | null = null;

  constructor(scene: Phaser.Scene, y: number, onBuy: () => void) {
    super(scene, 0, y);
    const width = GAME_WIDTH - MARGIN * 2;
    this.bg = scene.add.image(GAME_WIDTH / 2, 0, '__DEFAULT').setScale(1 / ART_RES);
    this.icon = scene.add.image(MARGIN + 56, 0, '__DEFAULT').setScale(1 / ART_RES);
    this.lock = scene.add.image(MARGIN + 80, 22, lockIcon(scene)).setScale(1 / ART_RES).setVisible(false);
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
    this.button.sound = 'buy';
    this.glow = scene.add.graphics().setAlpha(0);
    this.glow.lineStyle(10, PALETTE.saffron, 1).strokeRoundedRect(MARGIN - 4, -ROW_HEIGHT / 2 - 4, width + 8, ROW_HEIGHT + 8, 20);
    this.add([this.bg, this.icon, this.lock, this.title, this.level, this.tag, this.detail, this.button, this.glow]);
    scene.add.existing(this);
  }

  render(view: RowView): void {
    if (this.title.text !== view.title) this.title.setText(view.title);
    if (this.icon.texture.key !== view.icon) this.icon.setTexture(view.icon);
    this.lock.setVisible(view.locked);
    if (view.locked) this.icon.setTint(0xbbbbbb);
    else this.icon.clearTint();
    this.level.setText(view.level);
    this.level.x = this.title.x + this.title.width + 12;
    this.tag.setVisible(view.highlight);
    this.tag.x = this.level.x + this.level.width + (view.level ? 12 : 0);
    this.detail.setText(view.detail);
    this.title.setAlpha(view.locked ? 0.6 : 1);
    this.icon.setAlpha(view.locked ? 0.7 : 1);

    this.button.setVisible(view.buyable || view.buttonLabel !== '');
    this.button.setLabel(view.buttonLabel, view.buttonIcon);
    const style = view.buyable && view.affordable ? BUTTON_STYLES.buy : BUTTON_STYLES.disabled;
    this.button.setButtonStyle(style, view.buyable && view.affordable);

    if (this.lastHighlight !== view.highlight) {
      this.lastHighlight = view.highlight;
      const width = GAME_WIDTH - MARGIN * 2;
      const look = view.highlight ? ROW_CARDS.highlight : ROW_CARDS.normal;
      this.bg.setTexture(card(this.scene, `row-${view.highlight ? 'hot' : 'plain'}`, width, ROW_HEIGHT, look));
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

// "Lv 5", or "Lv 5 (+10)" when a tap buys more than one level.
function levelText(level: number, levels: number): string {
  return levels > 1 ? t('row.levelGain', { level, gain: levels }) : t('row.level', { level });
}

function milestoneText(level: number, bonus: number): string {
  const next = nextMilestone(level);
  return next === null ? '' : `  ·  ${t('row.nextMilestone', { bonus, level: next })}`;
}

export class UpgradePanel extends Phaser.GameObjects.Container {
  private tab: Tab = 'restaurant';
  private lastState: EconomyState | null = null;
  private readonly sectionRows: UpgradeRow[];
  private readonly dishRows: UpgradeRow[];
  private readonly tabButtons: Record<Tab, Button>;
  private readonly amountButton: Button;

  constructor(
    scene: Phaser.Scene,
    onBuySection: (id: SectionId) => void,
    onBuyDish: (index: number) => void,
  ) {
    // The scene places the panel at the bottom of the screen.
    super(scene, 0, 0);
    const bg = scene.add.image(0, -8, paintPanelBackground(scene)).setOrigin(0).setScale(1 / ART_RES);
    this.add(bg);

    // Two tabs, then a button that cycles how many levels a buy tap gets.
    const tabWidth = (GAME_WIDTH - MARGIN * 4 - AMOUNT_WIDTH) / 2;
    const tabY = 20 + TAB_HEIGHT / 2;
    this.tabButtons = {
      restaurant: new Button(scene, MARGIN + tabWidth / 2, tabY, tabWidth, TAB_HEIGHT, () => this.showTab('restaurant')),
      menu: new Button(scene, MARGIN * 2 + tabWidth * 1.5, tabY, tabWidth, TAB_HEIGHT, () => this.showTab('menu')),
    };
    this.tabButtons.restaurant.setLabel(t('tab.restaurant'));
    this.tabButtons.menu.setLabel(t('tab.menu'));
    this.amountButton = new Button(scene, GAME_WIDTH - MARGIN - AMOUNT_WIDTH / 2, tabY, AMOUNT_WIDTH, TAB_HEIGHT, () => this.cycleAmount());
    this.amountButton.setButtonStyle(BUTTON_STYLES.toggle);
    this.showAmount();
    this.add([this.tabButtons.restaurant, this.tabButtons.menu, this.amountButton]);

    const rowY = (i: number) => 20 + TAB_HEIGHT + 24 + ROW_HEIGHT / 2 + i * (ROW_HEIGHT + ROW_GAP);
    this.sectionRows = SECTION_IDS.map(
      (id, i) => new UpgradeRow(scene, rowY(i), () => onBuySection(id)),
    );
    this.dishRows = DISH_TIERS.map((_, i) => new UpgradeRow(scene, rowY(i), () => onBuyDish(i)));
    this.add([...this.sectionRows, ...this.dishRows]);

    this.showTab('restaurant');
    scene.add.existing(this);
  }

  get buyAmount(): BuyAmount {
    return settings.buyAmount;
  }

  private cycleAmount(): void {
    settings.buyAmount = BUY_AMOUNTS[(BUY_AMOUNTS.indexOf(settings.buyAmount) + 1) % BUY_AMOUNTS.length];
    saveSettings();
    this.showAmount();
    if (this.lastState) this.refresh(this.lastState);
  }

  private showAmount(): void {
    this.amountButton.setLabel(settings.buyAmount === 'max' ? t('buy.max') : t('buy.amount', { amount: settings.buyAmount }), false);
  }

  pulseSection(id: SectionId): void {
    this.sectionRows[SECTION_IDS.indexOf(id)].pulse();
  }

  // Switches to the restaurant tab and points at the section's row.
  focusSection(id: SectionId): void {
    if (this.tab !== 'restaurant') this.showTab('restaurant');
    this.sectionRows[SECTION_IDS.indexOf(id)].flash();
  }

  // Switches to the menu tab and points at the dish's row.
  focusDish(index: number): void {
    if (this.tab !== 'menu') this.showTab('menu');
    this.dishRows[index].flash();
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
    // Draw the new tab right away instead of on the next refresh tick.
    if (this.lastState) this.refresh(this.lastState);
  }

  refresh(state: EconomyState): void {
    this.lastState = state;
    if (this.tab === 'restaurant') this.refreshSections(state);
    else this.refreshDishes(state);
  }

  private refreshSections(state: EconomyState): void {
    const rates = sectionRates(state);
    const { bottleneck } = throughput(state);
    SECTION_IDS.forEach((id, i) => {
      const level = state.sectionLevels[id];
      const { levels, cost } = sectionBuyPlan(state, id, settings.buyAmount);
      this.sectionRows[i].render({
        title: t(`section.${id}` as TranslationKey),
        level: levelText(level, levels),
        detail: t('row.sectionRate', { rate: formatNumber(rates[id], 2) }) + milestoneText(level, MILESTONE_BONUS.section),
        buttonLabel: formatNumber(cost),
        buttonIcon: true,
        affordable: state.money >= cost,
        buyable: true,
        highlight: id === bottleneck,
        icon: sectionIcon(this.scene, id, SECTION_COLORS[id]),
        locked: false,
      });
    });
  }

  private refreshDishes(state: EconomyState): void {
    const nextLocked = nextLockedDish(state);
    const city = cityConfig(state.city);
    DISH_TIERS.forEach((_, i) => {
      const level = state.dishLevels[i];
      const { levels, cost } = dishBuyPlan(state, i, settings.buyAmount);
      const row = this.dishRows[i];
      const title = t(`dish.${city.dishes[i]}` as TranslationKey);
      const icon = dishIcon(this.scene, city.dishes[i], DISH_COLORS[i]);
      if (level > 0) {
        const mastered = level >= DISH_MAX_LEVEL;
        row.render({
          title,
          level: mastered ? t('row.level', { level }) : levelText(level, levels),
          detail:
            t('row.dishPrice', { price: formatNumber(dishPrice(state, i)) }) +
            (mastered ? '' : milestoneText(level, MILESTONE_BONUS.dish)),
          buttonLabel: mastered ? t('row.mastered') : formatNumber(cost),
          buttonIcon: !mastered,
          affordable: state.money >= cost,
          buyable: !mastered,
          highlight: false,
          icon,
          locked: false,
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
          icon,
          locked: false,
        });
      } else {
        // Shown ahead of time so the player sees what is coming, but bought strictly in order.
        const previous = t(`dish.${city.dishes[i - 1]}` as TranslationKey);
        row.render({
          title,
          level: '',
          detail: t('row.unlockAfter', { dish: previous }),
          buttonLabel: formatNumber(dishCost(state, i)),
          buttonIcon: true,
          affordable: false,
          buyable: false,
          highlight: false,
          icon,
          locked: true,
        });
      }
    });
  }
}
