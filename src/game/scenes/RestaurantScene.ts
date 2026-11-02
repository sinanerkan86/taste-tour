import Phaser from 'phaser';
import {
  DISH_MAX_LEVEL,
  DISHES,
  MILESTONE_BONUS,
  advanceTime,
  buyDish,
  buySectionLevel,
  incomePerSecond,
  milestonesReached,
  newEconomy,
  tap,
  throughput,
  type EconomyState,
  type SectionId,
} from '../../core/economy';
import { formatNumber } from '../../core/format';
import { t, type TranslationKey } from '../../i18n';
import { FONT, GAME_WIDTH, LAYOUT, PALETTE, toCss } from '../config';
import { FX_DEPTH, banner, confetti, floatingText, sparkle } from '../fx';
import { UpgradePanel } from '../ui/UpgradePanel';
import { ROOM, type Point } from '../view/layout';
import { RestaurantView } from '../view/RestaurantView';

const PANEL_REFRESH_MS = 100;
// HUD and panel draw above everything in the restaurant scene.
const UI_DEPTH = 10000;
const HUD_COIN: Point = { x: GAME_WIDTH / 2 - 150, y: 78 };
const BANNER_Y = 330;

export class RestaurantScene extends Phaser.Scene {
  private economy!: EconomyState;
  private view!: RestaurantView;
  private panel!: UpgradePanel;
  private moneyText!: Phaser.GameObjects.Text;
  private incomeText!: Phaser.GameObjects.Text;
  private hudCoin!: Phaser.GameObjects.Image;
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
    this.createTapArea();
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

  // Tapping the restaurant earns a tip; it matters most before the restaurant runs itself.
  private createTapArea(): void {
    const area = this.add
      .zone(0, ROOM.top, GAME_WIDTH, ROOM.bottom - ROOM.top)
      .setOrigin(0)
      .setInteractive();
    area.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const amount = tap(this.economy);
      sparkle(this, pointer.x, pointer.y);
      floatingText(this, pointer.x, pointer.y - 40, `+${formatNumber(amount)}`, PALETTE.saffron, 38);
      this.flyCoinToHud(pointer);
    });
  }

  private buySection(id: SectionId): void {
    const before = milestonesReached(this.economy.sectionLevels[id]);
    if (!buySectionLevel(this.economy, id)) return;
    this.panel.pulseSection(id);
    this.celebratePurchase();
    if (milestonesReached(this.economy.sectionLevels[id]) > before) {
      const name = t(`section.${id}` as TranslationKey);
      this.celebrate(t('banner.milestone', { name, bonus: MILESTONE_BONUS.section }));
    }
    this.refreshUi();
  }

  private buyDish(index: number): void {
    const level = this.economy.dishLevels[index];
    if (!buyDish(this.economy, index)) return;
    this.panel.pulseDish(index);
    this.celebratePurchase();
    const name = t(`dish.${DISHES[index].id}` as TranslationKey);
    const newLevel = this.economy.dishLevels[index];
    if (level === 0) {
      this.celebrate(t('banner.newDish', { name }), PALETTE.success);
    } else if (newLevel === DISH_MAX_LEVEL) {
      this.celebrate(t('banner.mastered', { name }), PALETTE.tileBlue);
    } else if (milestonesReached(newLevel) > milestonesReached(level)) {
      this.celebrate(t('banner.milestone', { name, bonus: MILESTONE_BONUS.dish }));
    }
    this.refreshUi();
  }

  // Small sparkle where the player pressed the buy button.
  private celebratePurchase(): void {
    const pointer = this.input.activePointer;
    sparkle(this, pointer.x, pointer.y, 0xffffff);
  }

  private celebrate(message: string, color: number = PALETTE.pomegranate): void {
    banner(this, BANNER_Y, message, color);
    confetti(this, GAME_WIDTH / 2, BANNER_Y + 40);
    this.cameras.main.shake(180, 0.004);
  }

  private flyCoinToHud(from: Point): void {
    const coin = this.add.image(from.x, from.y, 'coin').setScale(0.6).setDepth(FX_DEPTH);
    this.tweens.add({
      targets: coin,
      x: HUD_COIN.x,
      y: HUD_COIN.y,
      scale: 0.9,
      duration: 550,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        coin.destroy();
        this.bumpHud();
      },
    });
  }

  private bumpHud(): void {
    this.tweens.killTweensOf([this.hudCoin, this.moneyText]);
    this.hudCoin.setScale(1.1);
    this.moneyText.setScale(1);
    this.tweens.add({ targets: this.hudCoin, scale: 1.35, duration: 70, yoyo: true });
    this.tweens.add({ targets: this.moneyText, scale: 1.08, duration: 70, yoyo: true });
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
    this.hudCoin = this.add.image(HUD_COIN.x, HUD_COIN.y, 'coin').setScale(1.1).setDepth(UI_DEPTH);
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
    const popup = this.add.container(at.x, at.y, [coin, text]).setDepth(FX_DEPTH);
    this.flyCoinToHud(at);
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
