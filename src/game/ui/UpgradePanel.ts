import Phaser from 'phaser';
import {
  BUY_AMOUNTS,
  DISH_MAX_LEVEL,
  DISH_TIERS,
  MILESTONE_BONUS,
  RESEARCH_IDS,
  SAFE,
  offlineCapSeconds,
  safeUpgradeCost,
  SECTION_IDS,
  freeLabSlots,
  labNeedsAttention,
  labSlotCount,
  researchDuration,
  researchMaxLevel,
  researchMaxed,
  canSpeedUpResearch,
  researchSlot,
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
  type ResearchId,
  type SectionId,
} from '../../core/economy';
import { formatNumber } from '../../core/format';
import { t, tDuration, tDurationShort, type TranslationKey } from '../../i18n';
import { researchEffect, researchName } from './progressText';
import { FONT, GAME_WIDTH, LAYOUT, PALETTE, toCss } from '../config';
import { adIcon } from '../ads/AdService';
import { DISH_COLORS, SECTION_COLORS } from '../colors';
import { BUTTON_STYLES, Button } from './Button';
import { dishIcon, lockIcon, progressIcon, sectionIcon } from './icons';
import { ART_RES, paintTexture, roundRect, vGradient } from '../view/paint';
import { card, outlined } from './style';
import { saveSettings, settings } from '../settings';

const MARGIN = 24;
const ROW_HEIGHT = 100;
const ROW_GAP = 6;
const TAB_HEIGHT = 90;
const BUTTON_WIDTH = 270;
const AMOUNT_WIDTH = 150;
const PROGRESS_BAR = { width: 360, height: 18 };

export type Tab = 'restaurant' | 'menu' | 'lab';

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

interface LabRowView {
  title: string;
  level: string;
  detail: string;
  // 0..1 while the project runs, null otherwise.
  progress: number | null;
  buttonLabel: string;
  // 'speedUp': running, and an ad can still halve the time left.
  state: 'start' | 'running' | 'speedUp' | 'ready' | 'blocked' | 'maxed';
}

// One research project in the Lab tab: start it, watch its progress bar, collect it.
class LabRow extends Phaser.GameObjects.Container {
  private readonly title: Phaser.GameObjects.Text;
  private readonly level: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  readonly button: Button;
  private lastState: LabRowView['state'] | null = null;

  constructor(scene: Phaser.Scene, y: number, id: ResearchId, onPress: () => void) {
    super(scene, 0, y);
    const width = GAME_WIDTH - MARGIN * 2;
    const bg = scene.add
      .image(GAME_WIDTH / 2, 0, card(scene, 'row-plain', width, ROW_HEIGHT, ROW_CARDS.normal))
      .setScale(1 / ART_RES);
    this.icon = scene.add.image(MARGIN + 56, 0, progressIcon(scene, id)).setScale(1 / ART_RES);
    this.title = scene.add
      .text(MARGIN + 112, -20, '', { fontFamily: FONT, fontSize: '32px', fontStyle: 'bold', color: toCss(PALETTE.ink) })
      .setOrigin(0, 0.5);
    this.level = scene.add
      .text(0, -18, '', { fontFamily: FONT, fontSize: '26px', color: toCss(PALETTE.muted) })
      .setOrigin(0, 0.5);
    this.detail = scene.add
      .text(MARGIN + 112, 22, '', { fontFamily: FONT, fontSize: '24px', color: toCss(PALETTE.muted) })
      .setOrigin(0, 0.5);
    this.bar = scene.add.graphics();
    this.button = new Button(scene, MARGIN + width - BUTTON_WIDTH / 2 - 14, 0, BUTTON_WIDTH, 80, onPress, 'ad');
    this.add([bg, this.icon, this.title, this.level, this.detail, this.bar, this.button]);
    scene.add.existing(this);
  }

  render(view: LabRowView): void {
    if (this.title.text !== view.title) this.title.setText(view.title);
    this.level.setText(view.level);
    this.level.x = this.title.x + this.title.width + 12;
    this.detail.setText(view.detail).setVisible(view.progress === null);
    // Long effect texts shrink to stay clear of the button.
    this.detail.setScale(1);
    this.detail.setScale(Math.min(1, (GAME_WIDTH - MARGIN * 2 - BUTTON_WIDTH - 150) / Math.max(1, this.detail.width)));
    this.bar.clear();
    if (view.progress !== null) {
      const x = MARGIN + 112;
      const y = 22 - PROGRESS_BAR.height / 2;
      const r = PROGRESS_BAR.height / 2;
      this.bar.fillStyle(0x3a2618, 0.18).fillRoundedRect(x, y, PROGRESS_BAR.width, PROGRESS_BAR.height, r);
      const fill = Math.max(PROGRESS_BAR.height, PROGRESS_BAR.width * view.progress);
      this.bar.fillStyle(PALETTE.success, 1).fillRoundedRect(x, y, fill, PROGRESS_BAR.height, r);
    }
    const speedUp = view.state === 'speedUp';
    this.button.setLabel(view.buttonLabel, speedUp && adIcon() !== undefined);
    const style =
      view.state === 'ready'
        ? BUTTON_STYLES.go
        : view.state === 'start'
          ? BUTTON_STYLES.buy
          : speedUp
            ? BUTTON_STYLES.toggle
            : BUTTON_STYLES.disabled;
    this.button.setButtonStyle(style, view.state === 'ready' || view.state === 'start' || speedUp);
    // A finished project bounces its button until it is collected.
    if (view.state === 'ready' && this.lastState !== 'ready') {
      this.scene.tweens.add({ targets: this.button, scale: 1.08, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (view.state !== 'ready' && this.lastState === 'ready') {
      this.scene.tweens.killTweensOf(this.button);
      this.button.setScale(1);
    }
    this.lastState = view.state;
    this.icon.setAlpha(view.state === 'maxed' ? 0.7 : 1);
  }

  pulse(): void {
    this.scene.tweens.add({ targets: this.icon, scale: 1.25, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
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
  onTabChange: ((tab: Tab) => void) | null = null;
  private lastState: EconomyState | null = null;
  private readonly sectionRows: UpgradeRow[];
  private readonly safeRow: UpgradeRow;
  private readonly dishRows: UpgradeRow[];
  private readonly labRows: LabRow[];
  private readonly labInfo: Phaser.GameObjects.Text;
  private readonly labBadge: Phaser.GameObjects.Container;
  private readonly tabButtons: Record<Tab, Button>;
  private readonly amountButton: Button;

  constructor(
    scene: Phaser.Scene,
    onBuySection: (id: SectionId) => void,
    onBuyDish: (index: number) => void,
    onResearch: (id: ResearchId) => void,
    onBuySafe: () => void,
  ) {
    // The scene places the panel at the bottom of the screen.
    super(scene, 0, 0);
    const bg = scene.add.image(0, -8, paintPanelBackground(scene)).setOrigin(0).setScale(1 / ART_RES);
    this.add(bg);

    // Three tabs, then a button that cycles how many levels a buy tap gets.
    const gap = MARGIN / 2;
    const tabWidth = (GAME_WIDTH - MARGIN * 3 - gap * 2 - AMOUNT_WIDTH) / 3;
    const tabY = 20 + TAB_HEIGHT / 2;
    const tabX = (i: number) => MARGIN + tabWidth / 2 + i * (tabWidth + gap);
    this.tabButtons = {
      restaurant: new Button(scene, tabX(0), tabY, tabWidth, TAB_HEIGHT, () => this.showTab('restaurant')),
      menu: new Button(scene, tabX(1), tabY, tabWidth, TAB_HEIGHT, () => this.showTab('menu')),
      lab: new Button(scene, tabX(2), tabY, tabWidth, TAB_HEIGHT, () => this.showTab('lab')),
    };
    this.tabButtons.restaurant.setLabel(t('tab.restaurant'));
    this.tabButtons.menu.setLabel(t('tab.menu'));
    this.tabButtons.lab.setLabel(t('tab.lab'));
    this.amountButton = new Button(scene, GAME_WIDTH - MARGIN - AMOUNT_WIDTH / 2, tabY, AMOUNT_WIDTH, TAB_HEIGHT, () => this.cycleAmount());
    this.amountButton.setButtonStyle(BUTTON_STYLES.toggle);
    this.showAmount();
    // A red "!" on the Lab tab when a project is done or a lab stands idle.
    const dot = scene.add.circle(0, 0, 22, PALETTE.pomegranate).setStrokeStyle(4, 0xffffff);
    const mark = scene.add.text(0, -2, '!', outlined(30)).setOrigin(0.5);
    this.labBadge = scene.add.container(tabX(2) + tabWidth / 2 - 14, tabY - TAB_HEIGHT / 2 + 8, [dot, mark]).setVisible(false);
    scene.tweens.add({ targets: this.labBadge, scale: 1.18, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add([this.tabButtons.restaurant, this.tabButtons.menu, this.tabButtons.lab, this.amountButton, this.labBadge]);

    const rowY = (i: number) => 20 + TAB_HEIGHT + 24 + ROW_HEIGHT / 2 + i * (ROW_HEIGHT + ROW_GAP);
    this.sectionRows = SECTION_IDS.map(
      (id, i) => new UpgradeRow(scene, rowY(i), () => onBuySection(id)),
    );
    this.safeRow = new UpgradeRow(scene, rowY(SECTION_IDS.length), onBuySafe);
    this.dishRows = DISH_TIERS.map((_, i) => new UpgradeRow(scene, rowY(i), () => onBuyDish(i)));
    this.labRows = RESEARCH_IDS.map((id, i) => new LabRow(scene, rowY(i), id, () => onResearch(id)));
    this.labInfo = scene.add
      .text(GAME_WIDTH / 2, rowY(RESEARCH_IDS.length), '', {
        fontFamily: FONT,
        fontSize: '26px',
        color: toCss(PALETTE.muted),
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    this.add([...this.sectionRows, this.safeRow, ...this.dishRows, ...this.labRows, this.labInfo]);

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

  pulseSafe(): void {
    this.safeRow.pulse();
  }

  pulseDish(index: number): void {
    this.dishRows[index].pulse();
  }

  pulseResearch(id: ResearchId): void {
    this.labRows[RESEARCH_IDS.indexOf(id)].pulse();
  }

  // Screen position of the bottom edge of the Lab tab, for the first-time hint.
  get labTabPosition(): { x: number; y: number } {
    const tab = this.tabButtons.lab;
    return { x: tab.x, y: this.y + tab.y + TAB_HEIGHT / 2 };
  }

  showTab(tab: Tab): void {
    this.tab = tab;
    this.sectionRows.forEach((row) => row.setVisible(tab === 'restaurant'));
    this.safeRow.setVisible(tab === 'restaurant');
    this.dishRows.forEach((row) => row.setVisible(tab === 'menu'));
    this.labRows.forEach((row) => row.setVisible(tab === 'lab'));
    this.labInfo.setVisible(tab === 'lab');
    this.amountButton.setVisible(tab !== 'lab');
    for (const id of ['restaurant', 'menu', 'lab'] as Tab[]) {
      this.tabButtons[id].setButtonStyle(tab === id ? BUTTON_STYLES.primary : BUTTON_STYLES.disabled);
    }
    this.onTabChange?.(tab);
    // Draw the new tab right away instead of on the next refresh tick.
    if (this.lastState) this.refresh(this.lastState);
  }

  refresh(state: EconomyState): void {
    this.lastState = state;
    this.labBadge.setVisible(labNeedsAttention(state));
    if (this.tab === 'restaurant') this.refreshSections(state);
    else if (this.tab === 'menu') this.refreshDishes(state);
    else this.refreshLab(state);
  }

  private refreshLab(state: EconomyState): void {
    const free = freeLabSlots(state) > 0;
    RESEARCH_IDS.forEach((id, i) => {
      const row = this.labRows[i];
      const level = state.lab.levels[id];
      const slot = researchSlot(state, id);
      const title = researchName(id);
      const levelLabel = t('row.level', { level: `${level}/${researchMaxLevel(id)}` });
      if (researchMaxed(state, id)) {
        row.render({ title, level: levelLabel, detail: researchEffect(id, level), progress: null, buttonLabel: t('lab.maxed'), state: 'maxed' });
        return;
      }
      const detail = t('lab.next', { effect: researchEffect(id, level + 1) });
      if (slot && slot.remaining <= 0) {
        row.render({ title, level: levelLabel, detail, progress: null, buttonLabel: t('lab.collect'), state: 'ready' });
      } else if (slot) {
        // The Research Grant may have sped up the lab since this level started.
        const total = Math.max(slot.remaining, researchDuration(state, id));
        row.render({
          title,
          level: levelLabel,
          detail,
          progress: 1 - slot.remaining / total,
          buttonLabel: t('lab.left', { time: tDuration(Math.ceil(slot.remaining)) }),
          state: canSpeedUpResearch(state, id) ? 'speedUp' : 'running',
        });
      } else {
        row.render({
          title,
          level: levelLabel,
          detail,
          progress: null,
          buttonLabel: free ? t('lab.start', { time: tDurationShort(researchDuration(state, id)) }) : t('lab.busy'),
          state: free ? 'start' : 'blocked',
        });
      }
    });
    this.labInfo.setText(`${t('lab.info')}\n${t('lab.slots', { used: state.lab.slots.length, total: labSlotCount(state) })}`);
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
    // The Night Safe: one level per tap whatever the buy amount says.
    const cost = safeUpgradeCost(state);
    const maxed = !Number.isFinite(cost);
    this.safeRow.render({
      title: t('row.safe'),
      level: t('row.level', { level: `${state.safeLevel}/${SAFE.costs.length}` }),
      detail: t('row.safeDetail', { time: tDurationShort(offlineCapSeconds(state)) }) +
        (maxed ? '' : `  ·  ${t('row.safeNext', { time: tDurationShort(SAFE.secondsPerLevel) })}`),
      buttonLabel: maxed ? t('lab.maxed') : formatNumber(cost),
      buttonIcon: !maxed,
      affordable: state.money >= cost,
      buyable: !maxed,
      highlight: false,
      icon: progressIcon(this.scene, 'nightShift'),
      locked: false,
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
