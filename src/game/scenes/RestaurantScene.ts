import Phaser from 'phaser';
import {
  ADS,
  DISH_MAX_LEVEL,
  MILESTONE_BONUS,
  activateRush,
  advanceTime,
  buyDishLevels,
  buySectionLevels,
  canActivateRush,
  canFranchise,
  currentGoal,
  cityConfig,
  earn,
  incomePerSecond,
  menuSize,
  milestonesReached,
  styleTier,
  nextVipGap,
  passTime,
  newEconomy,
  pendingStars,
  prestige,
  sectionRates,
  tap,
  throughput,
  timeSkipAmount,
  useTimeSkip,
  vipTip,
  type EconomyState,
  type SectionId,
} from '../../core/economy';
import { formatNumber } from '../../core/format';
import { createSave, offlineReward, type OfflineReward, type SaveData } from '../../core/save';
import { t, tDuration, type TranslationKey } from '../../i18n';
import { ads, type AdPlacement } from '../ads/AdService';
import { FONT, GAME_WIDTH, LAYOUT, PALETTE, panelTop, toCss } from '../config';
import { FX_DEPTH, ROOM_FX_DEPTH, UI_LAYER_DEPTH, banner, confetti, floatingText, sparkle } from '../fx';
import { saves } from '../persistence';
import { AdOfferModal } from '../ui/AdOfferModal';
import { BUTTON_STYLES, Button } from '../ui/Button';
import { FranchiseModal } from '../ui/FranchiseModal';
import { DISH_COLORS } from '../colors';
import { GoalBar } from '../ui/GoalBar';
import { HintBubble } from '../ui/HintBubble';
import { UpgradePanel } from '../ui/UpgradePanel';
import { WelcomeBackModal } from '../ui/WelcomeBackModal';
import { ROOM, SECTION_ANCHORS, type Point } from '../view/layout';
import { RestaurantView } from '../view/RestaurantView';
import { Decor } from '../view/decor';
import { audio } from '../audio';
import { SettingsModal } from '../ui/SettingsModal';
import { gearIcon } from '../ui/icons';
import { ROOM_MARGIN, RoomCamera } from '../view/RoomCamera';
import { cityTheme } from '../view/themes';

const PANEL_REFRESH_MS = 100;
// HUD and panel draw above everything in the restaurant scene.
const UI_DEPTH = 10000;
const HUD_COIN: Point = { x: GAME_WIDTH / 2 - 150, y: 78 };
const HUD_MARGIN = 30;
// Rewarded ad buttons sit in the bottom right corner of the room, this far above the panel.
const AD_BUTTON = { width: 130, height: 68, abovePanel: 80, gap: 14 };
// Shown at the edge of the room view when the bottleneck marker is scrolled out of sight.
const MARKER_ARROW = { inset: 62, radius: 34 };
// World pixels the marker must be inside the view to count as visible.
const MARKER_VISIBLE_MARGIN = 50;
const PAN_MS = 450;
// The goal card sits this far below the top of the restaurant view.
const GOAL_BAR_Y = 50;
const GEAR_RADIUS = 40;
const BANNER_Y = 330;
const AUTOSAVE_MS = 10_000;
// Shorter absences are paid out silently, as if the game had kept running.
const WELCOME_BACK_MIN_SECONDS = 60;
// The bottleneck tip appears this long into the first session.
const BOTTLENECK_HINT_DELAY_MS = 4000;
const BOTTLENECK_HINT = 'bottleneck';
// The hint card sits below the marker and its label.
const HINT_OFFSET_Y = 85;
const FRANCHISE_FADE_MS = 600;

export interface RestaurantSceneData {
  save: SaveData | null;
  // Set when the scene restarts right after a franchise.
  arrived?: boolean;
}

export class RestaurantScene extends Phaser.Scene {
  private economy!: EconomyState;
  private seenHints: string[] = [];
  private hint: HintBubble | null = null;
  private view!: RestaurantView;
  private decor!: Decor;
  private decorShown = false;
  private panel!: UpgradePanel;
  private moneyText!: Phaser.GameObjects.Text;
  private incomeText!: Phaser.GameObjects.Text;
  private starsText!: Phaser.GameObjects.Text;
  private franchiseButton!: Button;
  private franchiseCaption!: Phaser.GameObjects.Text;
  private rushButton!: Button;
  private rushCaption!: Phaser.GameObjects.Text;
  private timeSkipButton!: Button;
  private timeSkipCaption!: Phaser.GameObjects.Text;
  // Seconds of play until the next VIP guest walks in.
  private vipCountdown = 0;
  // Null until the first UI refresh, so a loaded game does not announce the franchise again.
  private franchiseReady: boolean | null = null;
  private hudCoin!: Phaser.GameObjects.Image;
  private sincePanelRefresh = 0;
  // The restaurant world is drawn by the zoomable, scrollable room camera; HUD, panel and
  // dialogs by a second camera that covers the whole screen. Depth decides which is which.
  private room!: RoomCamera;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private goalBar!: GoalBar;
  private markerArrow!: Phaser.GameObjects.Container;
  private markerArrowTip!: Phaser.GameObjects.Triangle;

  constructor() {
    super('Restaurant');
  }

  create(data: RestaurantSceneData): void {
    this.economy = data.save?.economy ?? newEconomy();
    this.seenHints = data.save?.seenHints ?? [];
    this.hint = null;
    this.franchiseReady = null;
    this.vipCountdown = ADS.vipFirstGapSeconds;
    // Dev-only shortcuts for testing: /?money=1e6, /?city=2 (look and prices of another city), /?vip=1 (VIP right away)
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(location.search);
      const money = Number(params.get('money'));
      if (money > 0) this.economy.money = money;
      const city = Number(params.get('city'));
      if (Number.isInteger(city) && city > 0 && !data.arrived) this.economy.city = city;
      if (params.has('vip')) this.vipCountdown = 1;
    }
    this.setUpCameras();
    this.input.on('pointerdown', () => audio.unlock());
    const theme = cityTheme(cityConfig(this.economy.city).id);
    this.view = new RestaurantView(this, theme);
    this.decor = new Decor(this, theme);
    this.view.onPayment = (amount, at) => this.showPayment(amount, at);
    this.view.onMarkerTap = (section) => this.focusBottleneck(section);
    this.view.onVipTap = (at) => this.offerVip(at);
    this.drawHud();
    this.createTapArea();
    this.createAdButtons();
    this.panel = new UpgradePanel(
      this,
      (id) => this.buySection(id),
      (index) => this.buyDish(index),
    );
    this.panel.setDepth(UI_DEPTH);
    this.createMarkerArrow();
    this.goalBar = new GoalBar(this, GAME_WIDTH / 2, ROOM.top + GOAL_BAR_Y, () => this.followGoal()).setDepth(FX_DEPTH - 3);
    this.layout();
    this.refreshUi();

    this.setUpSaving();
    if (data.save) this.payOffline(offlineReward(this.economy, data.save.savedAt, Date.now()));
    if (!this.seenHints.includes(BOTTLENECK_HINT)) this.time.delayedCall(BOTTLENECK_HINT_DELAY_MS, () => this.showBottleneckHint());
    if (data.arrived) this.welcomeToCity();
  }

  private cityName(city: number): string {
    return t(`city.${cityConfig(city).id}` as TranslationKey);
  }

  private openFranchise(): void {
    if (!canFranchise(this.economy)) return;
    const offer = {
      city: this.cityName(this.economy.city + 1),
      starsNow: this.economy.stars,
      starsGained: pendingStars(this.economy),
    };
    new FranchiseModal(this, offer, UI_DEPTH + 100, () => this.franchise());
  }

  // Sell the restaurant: save the fresh one in the next city and restart the scene with it.
  private franchise(): void {
    if (!canFranchise(this.economy)) return;
    this.economy = prestige(this.economy);
    const save = createSave(this.economy, Date.now(), this.seenHints);
    void this.saveGame();
    this.input.enabled = false;
    this.cameras.cameras.forEach((camera) => camera.fadeOut(FRANCHISE_FADE_MS, 0, 0, 0));
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.input.enabled = true;
      this.scene.restart({ save, arrived: true } satisfies RestaurantSceneData);
    });
  }

  private welcomeToCity(): void {
    this.cameras.cameras.forEach((camera) => camera.fadeIn(FRANCHISE_FADE_MS, 0, 0, 0));
    this.time.delayedCall(FRANCHISE_FADE_MS, () =>
      this.celebrate(t('banner.newCity', { city: this.cityName(this.economy.city) }), PALETTE.tileBlue),
    );
  }

  private saveGame(): Promise<void> {
    return saves.save(this.economy, this.seenHints);
  }

  // Tapping the "!" marker points at the section to upgrade.
  private focusBottleneck(section: SectionId): void {
    this.hint?.close();
    this.panel.focusSection(section);
  }

  // First-session tip that explains the bottleneck and teaches the marker tap. The room first
  // scrolls so the marker is in view; the card itself is screen UI so it is not zoomed.
  private showBottleneckHint(): void {
    const anchor = this.view.markerAnchor;
    if (!anchor || this.hint) return;
    this.room.panTo(anchor);
    this.time.delayedCall(PAN_MS + 50, () => {
      if (this.hint) return;
      const marker = this.room.toScreen(anchor);
      const at = { x: marker.x, y: marker.y + HINT_OFFSET_Y * this.room.zoom };
      this.hint = new HintBubble(this, at, t('hint.bottleneck'), FX_DEPTH - 1, () => {
        this.hint = null;
        this.seenHints.push(BOTTLENECK_HINT);
        void this.saveGame();
      });
    });
  }

  private setUpCameras(): void {
    this.room = new RoomCamera(this, this.cameras.main);
    this.room.onTap = (at, screen) => this.tapRoom(at, screen);
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, this.scale.height);
    // Every frame, before drawing, each top-level object is hidden from the camera it does not
    // belong to. Doing it here also covers objects created later (customers, effects, dialogs).
    const assign = () => {
      const skipRoom = this.cameras.main.id;
      const skipUi = this.uiCamera.id;
      for (const object of this.children.list) {
        const depth = (object as Phaser.GameObjects.GameObject & { depth: number }).depth;
        object.cameraFilter = depth >= UI_LAYER_DEPTH ? skipRoom : skipUi;
      }
    };
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, assign);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.PRE_RENDER, assign);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  // Places the panel at the bottom of the screen and gives the room all the height in between.
  private layout(): void {
    const height = this.scale.height;
    const top = panelTop(height);
    this.room.layout(ROOM.top, top - ROOM.top);
    this.uiCamera.setSize(GAME_WIDTH, height);
    this.panel.setY(top);
    const adY = top - AD_BUTTON.abovePanel;
    this.rushButton.setY(adY);
    this.timeSkipButton.setY(adY);
    this.rushCaption.setY(adY + AD_BUTTON.height / 2 + 18);
    this.timeSkipCaption.setY(adY + AD_BUTTON.height / 2 + 18);
  }

  // A pulsing "!" with an arrow at the side of the room view, pointing to an off-screen
  // bottleneck marker. Tapping it scrolls the room there.
  private createMarkerArrow(): void {
    const { radius } = MARKER_ARROW;
    this.markerArrowTip = this.add.triangle(0, 0, 0, -16, 0, 16, 22, 0, PALETTE.pomegranate).setOrigin(0, 0.5);
    const circle = this.add.circle(0, 0, radius, PALETTE.pomegranate).setStrokeStyle(5, 0xffffff);
    const mark = this.add
      .text(0, 0, '!', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    this.markerArrow = this.add.container(0, 0, [this.markerArrowTip, circle, mark]).setDepth(FX_DEPTH - 2).setVisible(false);
    this.markerArrow.setSize(radius * 3, radius * 3).setInteractive({ useHandCursor: true });
    this.markerArrow.on('pointerdown', () => {
      const anchor = this.view.markerAnchor;
      if (anchor) this.room.panTo(anchor);
    });
    this.tweens.add({ targets: circle, scale: 1.12, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // The arrow sits at the edge of the room band nearest to the hidden marker, its tip turned
  // toward it.
  private updateMarkerArrow(): void {
    const anchor = this.view.markerAnchor;
    const hidden = anchor !== null && !this.room.shows(anchor, MARKER_VISIBLE_MARGIN);
    this.markerArrow.setVisible(hidden);
    if (!anchor || !hidden) return;
    const { inset, radius } = MARKER_ARROW;
    const band = this.room.screenRect;
    const target = this.room.toScreen(anchor);
    const x = Phaser.Math.Clamp(target.x, band.x + inset, band.right - inset);
    // Keep clear of the ad buttons at the bottom of the band.
    const y = Phaser.Math.Clamp(target.y, band.y + inset, band.bottom - inset * 2.5);
    this.markerArrow.setPosition(x, y);
    const angle = Math.atan2(target.y - y, target.x - x);
    this.markerArrowTip.setPosition(Math.cos(angle) * (radius + 2), Math.sin(angle) * (radius + 2)).setRotation(angle);
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
    // The clock kept running for Rush and cooldowns, whether or not anything was earned.
    passTime(this.economy, reward.secondsAway);
    if (reward.amount <= 0) return;
    if (reward.secondsAway < WELCOME_BACK_MIN_SECONDS) {
      earn(this.economy, reward.amount);
      return;
    }
    new WelcomeBackModal(
      this,
      reward,
      UI_DEPTH + 100,
      (multiplier) => {
        earn(this.economy, reward.amount * multiplier);
        void this.saveGame();
        this.celebrateCollect();
        this.refreshUi();
      },
      () => ads.showRewarded('offlineDouble'),
    );
  }

  private createAdButtons(): void {
    const caption = (x: number) =>
      this.add
        .text(x, 0, '', {
          fontFamily: FONT,
          fontSize: '26px',
          fontStyle: 'bold',
          color: toCss(PALETTE.cream),
          stroke: toCss(PALETTE.ink),
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setDepth(UI_DEPTH);
    // Vertical positions are set in layout().
    const skipX = GAME_WIDTH - HUD_MARGIN - AD_BUTTON.width / 2;
    const rushX = skipX - AD_BUTTON.width - AD_BUTTON.gap;
    this.rushButton = new Button(this, rushX, 0, AD_BUTTON.width, AD_BUTTON.height, () => this.offerRush(), 'ad');
    this.rushButton.setLabel(`${ADS.rushMultiplier}x`).setDepth(UI_DEPTH);
    this.rushCaption = caption(rushX);
    this.timeSkipButton = new Button(this, skipX, 0, AD_BUTTON.width, AD_BUTTON.height, () => this.offerTimeSkip(), 'ad');
    this.timeSkipButton.setLabel(t('ads.timeSkipLabel', { hours: ADS.timeSkipSeconds / 3600 })).setDepth(UI_DEPTH);
    this.timeSkipCaption = caption(skipX);
  }

  private refreshAdButtons(): void {
    const rush = this.economy.rushSeconds;
    this.rushButton.setButtonStyle(canActivateRush(this.economy) ? BUTTON_STYLES.buy : BUTTON_STYLES.disabled, canActivateRush(this.economy));
    this.rushCaption.setText(rush > 0 ? tDuration(rush) : t('ads.rushCaption'));
    this.rushCaption.setColor(toCss(rush > 0 ? PALETTE.saffron : PALETTE.cream));
    const cooldown = this.economy.timeSkipCooldown;
    this.timeSkipButton.setButtonStyle(cooldown > 0 ? BUTTON_STYLES.disabled : BUTTON_STYLES.buy, cooldown <= 0);
    this.timeSkipCaption.setText(cooldown > 0 ? tDuration(cooldown) : t('ads.timeSkipCaption'));
  }

  private offerRush(): void {
    if (!canActivateRush(this.economy)) return;
    const offer = {
      title: t('ads.rushTitle'),
      body: t('ads.rushBody', { hours: ADS.rushSeconds / 3600, max: ADS.rushMaxSeconds / 3600 }),
      reward: `${ADS.rushMultiplier}x`,
    };
    new AdOfferModal(this, offer, UI_DEPTH + 100, () =>
      this.watchAd('rush', () => {
        activateRush(this.economy);
        this.celebrate(t('banner.rush', { multiplier: ADS.rushMultiplier }), PALETTE.success);
      }),
    );
  }

  private offerTimeSkip(): void {
    if (this.economy.timeSkipCooldown > 0) return;
    const offer = {
      title: t('ads.timeSkipTitle'),
      body: t('ads.timeSkipBody', { hours: ADS.timeSkipSeconds / 3600 }),
      reward: `+${formatNumber(timeSkipAmount(this.economy))}`,
      rewardIcon: 'coin',
    };
    new AdOfferModal(this, offer, UI_DEPTH + 100, () =>
      this.watchAd('timeSkip', () => {
        const amount = useTimeSkip(this.economy);
        if (amount <= 0) return;
        floatingText(this, GAME_WIDTH / 2, BANNER_Y + 120, `+${formatNumber(amount)}`, PALETTE.saffron, 64);
        this.celebrateCollect();
      }),
    );
  }

  // Plays a rewarded ad and grants the reward only if it was watched to the end.
  // Resolves whether the reward was granted.
  private async watchAd(placement: AdPlacement, grant: () => void): Promise<boolean> {
    const watched = await ads.showRewarded(placement);
    if (!watched || !this.sys.isActive()) return false;
    grant();
    void this.saveGame();
    this.refreshUi();
    return true;
  }

  // Counts down play time to the next VIP guest while none is in the room.
  private updateVip(seconds: number): void {
    if (this.view.hasVip) return;
    this.vipCountdown -= seconds;
    if (this.vipCountdown > 0) return;
    this.vipCountdown = nextVipGap(Math.random());
    void this.view.spawnVip(ADS.vipStaySeconds);
    audio.play('vip');
  }

  private offerVip(at: Point): void {
    const tip = vipTip(this.economy);
    const offer = {
      title: t('ads.vipTitle'),
      body: t('ads.vipBody'),
      reward: `+${formatNumber(tip)}`,
      rewardIcon: 'coin',
    };
    new AdOfferModal(
      this,
      offer,
      UI_DEPTH + 100,
      async () => {
        const granted = await this.watchAd('vip', () => {
          earn(this.economy, tip);
          floatingText(this, at.x, at.y - 80, `+${formatNumber(tip)}`, PALETTE.saffron, 56, ROOM_FX_DEPTH);
          this.celebrateCollect();
        });
        void this.view.dismissVip(granted);
      },
      () => void this.view.dismissVip(false),
    );
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
    this.room.update(delta);
    this.updateVip(delta / 1000);
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
    this.updateMarkerArrow();

    this.sincePanelRefresh += delta;
    if (this.sincePanelRefresh >= PANEL_REFRESH_MS) {
      this.sincePanelRefresh = 0;
      this.refreshUi();
    } else {
      this.moneyText.setText(formatNumber(this.economy.money, 0));
    }
  }

  // Pressing the restaurant either drags the view sideways or, if the finger did not move,
  // earns a tip; tips matter most before the restaurant runs itself.
  private createTapArea(): void {
    const area = this.add
      .zone(0, ROOM.top - ROOM_MARGIN, GAME_WIDTH, ROOM.bottom - ROOM.top + ROOM_MARGIN * 2)
      .setOrigin(0)
      .setInteractive();
    area.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.room.startPress(pointer));
  }

  private tapRoom(at: Point, screen: Point): void {
    const amount = tap(this.economy);
    audio.play('tap');
    sparkle(this, at.x, at.y, PALETTE.saffron, ROOM_FX_DEPTH);
    floatingText(this, at.x, at.y - 40, `+${formatNumber(amount)}`, PALETTE.saffron, 38, ROOM_FX_DEPTH);
    this.flyCoinToHud(screen);
  }

  private buySection(id: SectionId): void {
    const before = milestonesReached(this.economy.sectionLevels[id]);
    const lookBefore = styleTier(this.economy.sectionLevels[id]);
    if (buySectionLevels(this.economy, id, this.panel.buyAmount) === 0) return;
    void this.saveGame();
    this.panel.pulseSection(id);
    this.celebratePurchase();
    if (styleTier(this.economy.sectionLevels[id]) > lookBefore) {
      // The section gets a new look: make sure the player sees it.
      this.note(t(`look.${id}` as TranslationKey));
      audio.play('look');
      const anchor = SECTION_ANCHORS[id];
      if (!this.room.shows(anchor, 0)) this.room.panTo(anchor);
    } else if (milestonesReached(this.economy.sectionLevels[id]) > before) {
      const name = t(`section.${id}` as TranslationKey);
      this.note(t('banner.milestone', { name, bonus: MILESTONE_BONUS.section }));
    }
    this.refreshUi();
  }

  private buyDish(index: number): void {
    const level = this.economy.dishLevels[index];
    if (buyDishLevels(this.economy, index, this.panel.buyAmount) === 0) return;
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
      this.note(t('banner.milestone', { name, bonus: MILESTONE_BONUS.dish }));
    }
    this.refreshUi();
  }

  // Small sparkle where the player pressed the buy button.
  private celebratePurchase(): void {
    const pointer = this.input.activePointer;
    sparkle(this, pointer.x, pointer.y, 0xffffff);
  }

  // Big moments (new dish, new city, Rush...): a banner with confetti.
  private celebrate(message: string, color: number = PALETTE.pomegranate): void {
    audio.play('celebrate');
    banner(this, BANNER_Y, message, color);
    confetti(this, GAME_WIDTH / 2, BANNER_Y + 40);
  }

  // Small moments (level milestones), which happen often: a short note above the panel.
  private note(message: string): void {
    floatingText(this, GAME_WIDTH / 2, panelTop(this.scale.height) - 150, message, PALETTE.cream, 34);
  }

  // `from` is a screen position.
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
    const income = formatNumber(incomePerSecond(this.economy));
    this.incomeText.setText(
      this.economy.rushSeconds > 0
        ? t('hud.perSecondRush', { amount: income, multiplier: ADS.rushMultiplier })
        : t('hud.perSecond', { amount: income }),
    );
    this.starsText.setText(formatNumber(this.economy.stars, 0));
    this.panel.refresh(this.economy);
    this.refreshFranchise();
    this.refreshAdButtons();
    this.refreshGoal();
    // New decor pops in when a dish unlocks; a loaded game shows its decor right away.
    this.decor.setStage(menuSize(this.economy), this.decorShown);
    this.decorShown = true;
  }

  private refreshGoal(): void {
    const goal = currentGoal(this.economy);
    if (goal.kind === 'unlockDish') {
      const dish = t(`dish.${cityConfig(this.economy.city).dishes[goal.dish]}` as TranslationKey);
      this.goalBar.render({ label: t('goal.unlockDish', { dish }), progress: goal.progress, iconColor: DISH_COLORS[goal.dish] });
    } else if (goal.kind === 'franchise') {
      this.goalBar.render({ label: t('goal.franchise', { city: this.cityName(this.economy.city + 1) }), progress: 1, iconColor: null });
    } else {
      this.goalBar.render({ label: t('goal.firstStar'), progress: goal.progress, iconColor: null });
    }
  }

  // Tapping the goal card goes to where the goal is done.
  private followGoal(): void {
    const goal = currentGoal(this.economy);
    if (goal.kind === 'unlockDish') this.panel.focusDish(goal.dish);
    else if (goal.kind === 'franchise') this.openFranchise();
    else this.focusBottleneck(throughput(this.economy).bottleneck);
  }

  // The franchise button appears once the whole menu is unlocked and shows the stars on offer.
  private refreshFranchise(): void {
    const ready = canFranchise(this.economy);
    this.franchiseButton.setVisible(ready);
    this.franchiseCaption.setVisible(ready);
    if (ready) this.franchiseButton.setLabel(`+${formatNumber(pendingStars(this.economy), 0)}`);
    if (ready && this.franchiseReady === false) {
      this.celebrate(t('banner.franchiseReady'), PALETTE.success);
      this.tweens.add({ targets: this.franchiseButton, scale: 1.15, duration: 300, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    }
    this.franchiseReady = ready;
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

    // Left: city and Chef Stars.
    this.add
      .text(HUD_MARGIN, 52, this.cityName(this.economy.city), {
        fontFamily: FONT,
        fontSize: '32px',
        fontStyle: 'bold',
        color: toCss(PALETTE.cream),
      })
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH);
    this.add.image(HUD_MARGIN + 26, 122, 'star').setScale(0.8).setDepth(UI_DEPTH);
    this.starsText = this.add
      .text(HUD_MARGIN + 62, 122, '0', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: toCss(PALETTE.cream) })
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH);

    // Far right: settings gear.
    const gearX = GAME_WIDTH - HUD_MARGIN - GEAR_RADIUS;
    const gearBg = this.add.circle(gearX, 80, GEAR_RADIUS, PALETTE.pomegranateDark).setDepth(UI_DEPTH);
    const gear = this.add.image(gearX, 80, gearIcon(this)).setScale(1 / 2).setDepth(UI_DEPTH);
    gearBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      audio.unlock();
      audio.play('click');
      this.tweens.add({ targets: gear, angle: gear.angle + 90, duration: 250, ease: 'Quad.easeOut' });
      new SettingsModal(this, UI_DEPTH + 100);
    });

    // Right: franchise button, hidden until the menu is complete.
    this.franchiseButton = new Button(this, gearX - GEAR_RADIUS - 20 - 105, 80, 210, 100, () => this.openFranchise(), 'star');
    this.franchiseButton.setButtonStyle(BUTTON_STYLES.buy).setDepth(UI_DEPTH).setVisible(false);
    this.franchiseCaption = this.add
      .text(this.franchiseButton.x, 155, t('franchise.button'), {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: toCss(PALETTE.cream),
      })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH)
      .setVisible(false);
  }

  private showPayment(amount: number, at: Point): void {
    if (amount <= 0) return;
    if (this.room.shows(at, 0)) audio.play('coin', 0.35);
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
    // A gentle rise and fade; coins only fly to the HUD for the player's own taps.
    const popup = this.add.container(at.x, at.y, [coin, text]).setDepth(ROOM_FX_DEPTH).setScale(0.85);
    this.tweens.add({
      targets: popup,
      y: at.y - 80,
      alpha: 0,
      duration: 1800,
      ease: 'Sine.easeOut',
      onComplete: () => popup.destroy(),
    });
  }
}
