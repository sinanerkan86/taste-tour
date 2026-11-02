import Phaser from 'phaser';
import {
  advanceTime,
  buyDish,
  buySectionLevel,
  incomePerSecond,
  newEconomy,
  throughput,
  type EconomyState,
  type SectionId,
} from '../../core/economy';
import { formatNumber } from '../../core/format';
import { t } from '../../i18n';
import { FONT, GAME_WIDTH, LAYOUT, PALETTE, toCss } from '../config';
import { UpgradePanel } from '../ui/UpgradePanel';
import type { Point } from '../view/layout';
import { RestaurantView } from '../view/RestaurantView';

const PANEL_REFRESH_MS = 100;
// HUD and panel draw above everything in the restaurant scene.
const UI_DEPTH = 10000;

export class RestaurantScene extends Phaser.Scene {
  private economy!: EconomyState;
  private view!: RestaurantView;
  private panel!: UpgradePanel;
  private moneyText!: Phaser.GameObjects.Text;
  private incomeText!: Phaser.GameObjects.Text;
  private sincePanelRefresh = 0;

  constructor() {
    super('Restaurant');
  }

  create(): void {
    this.economy = newEconomy();
    // Dev-only shortcut for testing: /?money=1e6
    if (import.meta.env.DEV) {
      const money = Number(new URLSearchParams(location.search).get('money'));
      if (money > 0) this.economy.money = money;
    }
    this.view = new RestaurantView(this);
    this.view.onPayment = (amount, at) => this.showPayment(amount, at);
    this.drawHud();
    this.panel = new UpgradePanel(
      this,
      (id) => this.buySection(id),
      (index) => this.buyDish(index),
    );
    this.panel.setDepth(UI_DEPTH);
    this.refreshUi();
  }

  // Called every frame; delta is milliseconds since the previous frame.
  update(time: number, delta: number): void {
    advanceTime(this.economy, delta / 1000);
    const flow = throughput(this.economy);
    this.view.update(
      {
        customersPerSecond: flow.customersPerSecond,
        incomePerSecond: incomePerSecond(this.economy),
        bottleneck: flow.bottleneck,
        kitchenLevel: this.economy.sectionLevels.kitchen,
        menu: this.economy.dishLevels.flatMap((level, i) => (level > 0 ? [i] : [])),
      },
      time,
      delta,
    );

    this.sincePanelRefresh += delta;
    if (this.sincePanelRefresh >= PANEL_REFRESH_MS) {
      this.sincePanelRefresh = 0;
      this.refreshUi();
    } else {
      this.moneyText.setText(formatNumber(this.economy.money, 0));
    }
  }

  private buySection(id: SectionId): void {
    if (!buySectionLevel(this.economy, id)) return;
    this.panel.pulseSection(id);
    this.refreshUi();
  }

  private buyDish(index: number): void {
    if (!buyDish(this.economy, index)) return;
    this.panel.pulseDish(index);
    this.refreshUi();
  }

  private refreshUi(): void {
    this.moneyText.setText(formatNumber(this.economy.money, 0));
    this.incomeText.setText(t('hud.perSecond', { amount: formatNumber(incomePerSecond(this.economy)) }));
    this.panel.refresh(this.economy);
  }

  private drawHud(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, LAYOUT.hudHeight, PALETTE.pomegranate).setOrigin(0).setDepth(UI_DEPTH);
    this.add
      .rectangle(0, LAYOUT.hudHeight, GAME_WIDTH, 8, PALETTE.pomegranateDark)
      .setOrigin(0)
      .setDepth(UI_DEPTH);
    this.add.image(GAME_WIDTH / 2 - 150, 78, 'coin').setScale(1.1).setDepth(UI_DEPTH);
    this.moneyText = this.add
      .text(GAME_WIDTH / 2 - 100, 78, '0', {
        fontFamily: FONT,
        fontSize: '72px',
        fontStyle: 'bold',
        color: toCss(PALETTE.cream),
      })
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH);
    this.incomeText = this.add
      .text(GAME_WIDTH / 2, 150, '', { fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: toCss(PALETTE.saffron) })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH);
  }

  private showPayment(amount: number, at: Point): void {
    if (amount <= 0) return;
    const coin = this.add.image(-34, 0, 'coin').setScale(0.7);
    const text = this.add
      .text(0, 0, `+${formatNumber(amount)}`, {
        fontFamily: FONT,
        fontSize: '42px',
        fontStyle: 'bold',
        color: toCss(PALETTE.saffron),
        stroke: toCss(PALETTE.ink),
        strokeThickness: 8,
      })
      .setOrigin(0, 0.5);
    const popup = this.add.container(at.x, at.y, [coin, text]).setDepth(UI_DEPTH - 1);
    this.tweens.add({
      targets: popup,
      y: at.y - 130,
      alpha: 0,
      duration: 1100,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }
}
