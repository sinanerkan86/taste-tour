import Phaser from 'phaser';
import {
  DISH_MAX_LEVEL,
  MILESTONE_BONUS,
  advanceTime,
  buyDish,
  buySectionLevel,
  cityConfig,
  earn,
  incomePerSecond,
  milestonesReached,
  newEconomy,
  sectionRates,
  tap,
  throughput,
  type EconomyState,
  type SectionId,
} from '../../core/economy';
import { formatNumber } from '../../core/format';
import { offlineReward, type OfflineReward, type SaveData } from '../../core/save';
import { t, type TranslationKey } from '../../i18n';
import { FONT, GAME_WIDTH, LAYOUT, PALETTE, toCss } from '../config';
import { FX_DEPTH, banner, confetti, floatingText, sparkle } from '../fx';
import { saves } from '../persistence';
import { HintBubble } from '../ui/HintBubble';
import { UpgradePanel } from '../ui/UpgradePanel';
import { WelcomeBackModal } from '../ui/WelcomeBackModal';
import { ROOM, type Point } from '../view/layout';
import { RestaurantView } from '../view/RestaurantView';

const PANEL_REFRESH_MS = 100;
// HUD and panel draw above everything in the restaurant scene.
const UI_DEPTH = 10000;
const HUD_COIN: Point = { x: GAME_WIDTH / 2 - 150, y: 78 };
const BANNER_Y = 330;
const AUTOSAVE_MS = 10_000;
// Shorter absences are paid out silently, as if the game had kept running.
const WELCOME_BACK_MIN_SECONDS = 60;
// The bottleneck tip appears this long into the first session.
const BOTTLENECK_HINT_DELAY_MS = 4000;
const BOTTLENECK_HINT = 'bottleneck';
// The hint card sits below the marker and its label.
const HINT_OFFSET_Y = 85;

export interface RestaurantSceneData {
  save: SaveData | null;
}

export class RestaurantScene extends Phaser.Scene {
  private economy!: EconomyState;
  private seenHints: string[] = [];
  private hint: HintBubble | null = null;
  private view!: RestaurantView;
  private panel!: UpgradePanel;
  private moneyText!: Phaser.GameObjects.Text;
  private incomeText!: Phaser.GameObjects.Text;
  private hudCoin!: Phaser.GameObjects.Image;
  private sincePanelRefresh = 0;

  constructor() {
    super('Restaurant');
  }

  create(data: RestaurantSceneData): void {
    this.economy = data.save?.economy ?? newEconomy();
    this.seenHints = data.save?.seenHints ?? [];
    this.hint = null;
    // Dev-only shortcut for testing: /?money=1e6
    if (import.meta.env.DEV) {
      const money = Number(new URLSearchParams(location.search).get('money'));
      if (money > 0) this.economy.money = money;
    }
    this.view = new RestaurantView(this);
    this.view.onPayment = (amount, at) => this.showPayment(amount, at);
    this.view.onMarkerTap = (section) => this.focusBottleneck(section);
    this.drawHud();
    this.createTapArea();
    this.panel = new UpgradePanel(
      this,
      (id) => this.buySection(id),
      (index) => this.buyDish(index),
    );
    this.panel.setDepth(UI_DEPTH);
    this.refreshUi();

    this.setUpSaving();
    if (data.save) this.payOffline(offlineReward(this.economy, data.save.savedAt, Date.now()));
    if (!this.seenHints.includes(BOTTLENECK_HINT)) this.time.delayedCall(BOTTLENECK_HINT_DELAY_MS, () => this.showBottleneckHint());
  }

  private saveGame(): Promise<void> {
    return saves.save(this.economy, this.seenHints);
  }

  // Tapping the "!" marker points at the section to upgrade.
  private focusBottleneck(section: SectionId): void {
    this.hint?.close();
    this.panel.focusSection(section);
  }

  // First-session tip that explains the bottleneck and teaches the marker tap.
  private showBottleneckHint(): void {
    const anchor = this.view.markerAnchor;
    if (!anchor || this.hint) return;
    this.hint = new HintBubble(this, { x: anchor.x, y: anchor.y + HINT_OFFSET_Y }, t('hint.bottleneck'), FX_DEPTH - 1, () => {
      this.hint = null;
      this.seenHints.push(BOTTLENECK_HINT);
      void this.saveGame();
    });
  }

  // Autosave, plus a save whenever the game goes to the background. When it comes back,
  // the time it spent paused is paid out like offline time.
  private setUpSaving(): void {
    const save = () => void this.saveGame();
    let hiddenAt = 0;
    const onHidden = () => {
      hiddenAt = Date.now();
      save();
    };
    const onVisible = () => {
      if (hiddenAt > 0) this.payOffline(offlineReward(this.economy, hiddenAt, Date.now()));
      hiddenAt = 0;
    };
    this.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: save });
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.game.events.on(Phaser.Core.Events.VISIBLE, onVisible);
    window.addEventListener('pagehide', save);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, onVisible);
      window.removeEventListener('pagehide', save);
    });
  }

  private payOffline(reward: OfflineReward): void {
    if (reward.amount <= 0) return;
    if (reward.secondsAway < WELCOME_BACK_MIN_SECONDS) {
      earn(this.economy, reward.amount);
      return;
    }
    new WelcomeBackModal(this, reward, UI_DEPTH + 100, () => {
      earn(this.economy, reward.amount);
      void this.saveGame();
      this.celebrateCollect();
      this.refreshUi();
    });
  }

  private celebrateCollect(): void {
    confetti(this, GAME_WIDTH / 2, BANNER_Y + 200);
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 60, () =>
        this.flyCoinToHud({ x: GAME_WIDTH / 2 + Phaser.Math.Between(-200, 200), y: Phaser.Math.Between(700, 900) }),
      );
    }
  }

  // Called every frame; delta is milliseconds since the previous frame.
  update(time: number, delta: number): void {
    advanceTime(this.economy, delta / 1000);
    const flow = throughput(this.economy);
    this.view.update(
      {
        rates: sectionRates(this.economy),
        levels: this.economy.sectionLevels,
        customersPerSecond: flow.customersPerSecond,
        incomePerSecond: incomePerSecond(this.economy),
        bottleneck: flow.bottleneck,
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
    void this.saveGame();
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
    void this.saveGame();
    this.panel.pulseDish(index);
    this.celebratePurchase();
    const name = t(`dish.${cityConfig(this.economy.city).dishes[index]}` as TranslationKey);
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
