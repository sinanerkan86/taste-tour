import Phaser from 'phaser';
import {
  ADS,
  CHEF,
  DISH_MAX_LEVEL,
  EVENTS,
  MILESTONE_BONUS,
  activateRush,
  advanceTime,
  baseIncomePerSecond,
  boostMultiplier,
  busCombo,
  buyDishLevels,
  buySectionLevels,
  canActivateRush,
  canFranchise,
  claimChest,
  claimDailyReward,
  claimTask,
  collectResearch,
  criticProgress,
  criticTarget,
  festivalBonusPerSecond,
  grantReview,
  nextEventGap,
  payBusTip,
  pickEvent,
  pickFestivalDish,
  dailyNeedsAttention,
  dailyRewardReady,
  dayNumber,
  recordTask,
  refreshDaily,
  currentGoal,
  finishedResearch,
  perkOffers,
  researchSlot,
  startResearch,
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
  adsRemoved,
  cardTarget,
  chefsNeedAttention,
  grantPurchase,
  levelUpChef,
  reviewDuration,
  type ChefId,
  type EconomyState,
  type EventKind,
  type ProductId,
  type GrantedReward,
  type PerkId,
  type TaskKind,
  type ResearchId,
  type SectionId,
} from '../../core/economy';
import { ART_RES } from '../view/paint';
import { formatNumber } from '../../core/format';
import { createSave, offlineReward, type OfflineReward, type SaveData } from '../../core/save';
import { t, tDuration, tDurationShort, type TranslationKey } from '../../i18n';
import { adPolicy, showRewardedAd, type AdPlacement } from '../ads/AdService';
import { store } from '../store/StoreService';
import { ChefsModal } from '../ui/ChefsModal';
import { ShopModal } from '../ui/ShopModal';
import { FONT, GAME_WIDTH, PALETTE, panelTop, toCss } from '../config';
import { FX_DEPTH, ROOM_FX_DEPTH, UI_LAYER_DEPTH, banner, confetti, fireworksShow, floatingText, sparkle } from '../fx';
import { notifications } from '../notifications';
import { saves } from '../persistence';
import { AdOfferModal } from '../ui/AdOfferModal';
import { BUTTON_STYLES, Button } from '../ui/Button';
import { DailyModal, dailyTaskLabel } from '../ui/DailyModal';
import { EventBar, type EventView } from '../ui/EventBar';
import { FranchiseModal } from '../ui/FranchiseModal';
import { PerkModal, PerksModal } from '../ui/PerkModal';
import { chefName, researchName } from '../ui/progressText';
import { DISH_COLORS } from '../colors';
import { GoalBar } from '../ui/GoalBar';
import { HintBubble } from '../ui/HintBubble';
import { UpgradePanel } from '../ui/UpgradePanel';
import { WelcomeBackModal } from '../ui/WelcomeBackModal';
import { ROOM, SECTION_ANCHORS, type Point } from '../view/layout';
import { RestaurantView } from '../view/RestaurantView';
import { Decor } from '../view/decor';
import { audio } from '../audio';
import type { WorldMapData } from './WorldMapScene';
import { SettingsModal } from '../ui/SettingsModal';
import { chefHatIcon, dishIcon, gearIcon, giftIcon, globeIcon, shopIcon } from '../ui/icons';
import { counterPill, glossyButton, outlined, paintHudAwning } from '../ui/style';
import { ROOM_MARGIN, RoomCamera } from '../view/RoomCamera';
import { cityTheme } from '../view/themes';

const PANEL_REFRESH_MS = 100;
// HUD and panel draw above everything in the restaurant scene.
const UI_DEPTH = 10000;
const MONEY_PILL = { width: 380, height: 84 };
const HUD_COIN: Point = { x: GAME_WIDTH / 2 + 20 - MONEY_PILL.width / 2, y: 70 };
const CITY_PILL = { width: 270, height: 60 };
const STARS_PILL = { width: 160, height: 56 };
const GEAR_SIZE = 96;
const HUD_MARGIN = 30;
// Rewarded ad buttons sit in the bottom right corner of the room, this far above the panel.
const AD_BUTTON = { width: 130, height: 68, abovePanel: 80, gap: 14 };
// The green "+" at the right end of the money pill: a time skip (money now) for a rewarded ad.
const PLUS_SIZE = 66;
// The daily rewards button sits in the bottom left corner of the room, level with Rush.
const DAILY_BUTTON = 92;
// The chefs button sits above the daily button, the shop button above Rush.
const CORNER_STACK_GAP = 150;
// Shown at the edge of the room view when the bottleneck marker is scrolled out of sight.
const MARKER_ARROW = { inset: 62, radius: 34 };
// World pixels the marker must be inside the view to count as visible.
const MARKER_VISIBLE_MARGIN = 50;
const PAN_MS = 450;
// The goal card sits this far below the top of the restaurant view.
const GOAL_BAR_Y = 50;
const BANNER_Y = 330;
const AUTOSAVE_MS = 10_000;
// The daily rewards open this long after the welcome-back dialog is collected.
const DAILY_AFTER_WELCOME_MS = 900;
// Shorter absences are paid out silently, as if the game had kept running.
const WELCOME_BACK_MIN_SECONDS = 60;
// The bottleneck tip appears this long into the first session.
const BOTTLENECK_HINT_DELAY_MS = 4000;
const BOTTLENECK_HINT = 'bottleneck';
// The hint card sits below the marker and its label.
const HINT_OFFSET_Y = 85;
const FRANCHISE_FADE_MS = 600;
const LAB_HINT = 'lab';
// The lab tip appears once this many dishes are on the menu.
const LAB_HINT_MENU_SIZE = 2;

// The event card sits under the goal card.
const EVENT_BAR_Y = GOAL_BAR_Y + 105;
// Tour bus tips below this many seconds of income are not worth an ad offer.
const BUS_OFFER_MIN_SECONDS = 20;

// A scene event in progress (see core/economy/events.ts). Events live only while the game runs.
type ActiveEvent =
  | { kind: 'critic'; left: number; start: number; target: number }
  | { kind: 'tourBus'; left: number; taps: number; sinceTap: number; tips: number }
  | { kind: 'festival'; left: number; dish: number };

export interface RestaurantSceneData {
  save: SaveData | null;
  // Set when the scene restarts right after a franchise.
  arrived?: boolean;
  // Set when the scene restarts after a language change: the settings dialog opens again.
  reopenSettings?: boolean;
}

export class RestaurantScene extends Phaser.Scene {
  private economy!: EconomyState;
  private seenHints: string[] = [];
  private hint: HintBubble | null = null;
  private hintId: string | null = null;
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
  private plusButton!: Phaser.GameObjects.Container;
  private plusReady: boolean | null = null;
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
  // Lab projects already announced as done, so each one is announced once.
  private announcedResearch = new Set<ResearchId>();
  private dailyButton!: Phaser.GameObjects.Container;
  private dailyBadge!: Phaser.GameObjects.Container;
  private dailyCaption!: Phaser.GameObjects.Text;
  private chefsButton!: Phaser.GameObjects.Container;
  private chefsBadge!: Phaser.GameObjects.Container;
  private chefsCaption!: Phaser.GameObjects.Text;
  private chefsAttention: boolean | null = null;
  private chefsModal: ChefsModal | null = null;
  private shopButton!: Phaser.GameObjects.Container;
  private shopCaption!: Phaser.GameObjects.Text;
  private shopModal: ShopModal | null = null;
  private dailyModal: DailyModal | null = null;
  private dailyAttention: boolean | null = null;
  private event: ActiveEvent | null = null;
  private eventCountdown = 0;
  private lastEvent: EventKind | null = null;
  private forcedEvent: EventKind | null = null;
  private eventBar!: EventBar;

  constructor() {
    super('Restaurant');
  }

  create(data: RestaurantSceneData): void {
    this.economy = data.save?.economy ?? newEconomy();
    adPolicy.removed = adsRemoved(this.economy);
    this.chefsAttention = null;
    this.chefsModal = null;
    this.shopModal = null;
    refreshDaily(this.economy, dayNumber(Date.now()));
    this.dailyModal = null;
    this.dailyAttention = null;
    this.seenHints = data.save?.seenHints ?? [];
    this.hint = null;
    this.franchiseReady = null;
    this.vipCountdown = ADS.vipFirstGapSeconds;
    this.event = null;
    this.eventCountdown = EVENTS.firstGapSeconds;
    this.lastEvent = null;
    this.forcedEvent = null;
    // Dev-only shortcuts for testing: /?money=1e6, /?city=2 (look and prices of another city), /?vip=1 (VIP right away),
    // /?event=critic|tourBus|festival (that event in a few seconds)
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(location.search);
      const money = Number(params.get('money'));
      if (money > 0) this.economy.money = money;
      const city = Number(params.get('city'));
      if (Number.isInteger(city) && city > 0 && !data.arrived) this.economy.city = city;
      if (params.has('vip')) this.vipCountdown = 1;
      const event = params.get('event') as EventKind | null;
      if (event === 'critic' || event === 'tourBus' || event === 'festival') {
        this.forcedEvent = event;
        this.eventCountdown = 3;
      }
    }
    this.setUpCameras();
    this.input.on('pointerdown', () => audio.unlock());
    const theme = cityTheme(cityConfig(this.economy.city).id);
    this.view = new RestaurantView(this, theme, cityConfig(this.economy.city).dishes);
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
      (id) => this.pressResearch(id),
    );
    this.panel.onTabChange = (tab) => {
      if (tab === 'lab' && this.hint && this.hintId === LAB_HINT) this.hint.close();
    };
    this.panel.setDepth(UI_DEPTH);
    this.createMarkerArrow();
    this.goalBar = new GoalBar(this, GAME_WIDTH / 2, ROOM.top + GOAL_BAR_Y, () => this.followGoal()).setDepth(FX_DEPTH - 3);
    this.eventBar = new EventBar(this, GAME_WIDTH / 2, ROOM.top + EVENT_BAR_Y).setDepth(FX_DEPTH - 3);
    this.layout();
    this.refreshUi();

    this.setUpSaving();
    void this.syncPurchases();
    if (data.save && !this.payOffline(offlineReward(this.economy, data.save.savedAt, Date.now()))) this.maybeOpenDaily();
    this.announcedResearch = new Set(finishedResearch(this.economy));
    if (!this.seenHints.includes(BOTTLENECK_HINT)) this.time.delayedCall(BOTTLENECK_HINT_DELAY_MS, () => this.showBottleneckHint());
    if (data.arrived) this.welcomeToCity();
    if (data.reopenSettings) this.openSettings();
  }

  private cityName(city: number): string {
    return t(`city.${cityConfig(city).id}` as TranslationKey);
  }

  // The world tour opens on top of the restaurant, which keeps running underneath.
  private openWorldMap(): void {
    if (this.scene.isActive('WorldMap')) return;
    this.scene.launch('WorldMap', { economy: this.economy } satisfies WorldMapData);
  }

  private openFranchise(): void {
    if (!canFranchise(this.economy)) return;
    const offer = {
      city: this.cityName(this.economy.city + 1),
      starsNow: this.economy.stars,
      starsGained: pendingStars(this.economy),
    };
    new FranchiseModal(this, offer, UI_DEPTH + 100, () => this.choosePerk());
  }

  // After confirming a franchise the player picks a perk, then moves on.
  private choosePerk(): void {
    const offers = perkOffers(this.economy);
    if (offers.length === 0) {
      this.franchise(null);
      return;
    }
    audio.play('celebrate');
    new PerkModal(this, offers, this.economy.perks, UI_DEPTH + 100, (perk) => this.franchise(perk));
  }

  // Sell the restaurant: save the fresh one in the next city and restart the scene with it.
  private franchise(perk: PerkId | null): void {
    if (!canFranchise(this.economy)) return;
    this.economy = prestige(this.economy, perk);
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

  private openSettings(): void {
    new SettingsModal(this, UI_DEPTH + 100, () => this.restartInNewLanguage());
  }

  // Every text is created in create(), so a new language simply restarts the scene with the game as it is.
  private restartInNewLanguage(): void {
    const save = createSave(this.economy, Date.now(), this.seenHints);
    void this.saveGame();
    this.scene.restart({ save, reopenSettings: true } satisfies RestaurantSceneData);
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
      this.hintId = BOTTLENECK_HINT;
      this.hint = new HintBubble(this, at, t('hint.bottleneck'), FX_DEPTH - 1, () => {
        this.hint = null;
        this.hintId = null;
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
    this.rushCaption.setY(adY + AD_BUTTON.height / 2 + 18);
    this.dailyButton.setY(adY - (DAILY_BUTTON - AD_BUTTON.height) / 2);
    this.dailyCaption.setY(adY + AD_BUTTON.height / 2 + 18);
    this.chefsButton.setY(this.dailyButton.y - CORNER_STACK_GAP);
    this.chefsCaption.setY(this.dailyCaption.y - CORNER_STACK_GAP);
    this.shopButton.setY(this.dailyButton.y - CORNER_STACK_GAP);
    this.shopCaption.setY(this.dailyCaption.y - CORNER_STACK_GAP);
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
      void notifications.schedule(this.economy);
    };
    const onVisible = () => {
      void notifications.cancel();
      if (hiddenAt > 0 && !this.payOffline(offlineReward(this.economy, hiddenAt, Date.now()))) this.maybeOpenDaily();
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

  // Returns whether the welcome-back dialog opened (the daily rewards then wait for it to close).
  private payOffline(reward: OfflineReward): boolean {
    // The clock kept running for Rush, cooldowns and the lab, whether or not anything was earned.
    const doneBefore = finishedResearch(this.economy);
    passTime(this.economy, reward.secondsAway);
    if (reward.amount <= 0) return false;
    if (reward.secondsAway < WELCOME_BACK_MIN_SECONDS) {
      earn(this.economy, reward.amount);
      return false;
    }
    const doneAway = finishedResearch(this.economy).filter((id) => !doneBefore.includes(id));
    doneAway.forEach((id) => this.announcedResearch.add(id));
    new WelcomeBackModal(
      this,
      reward,
      UI_DEPTH + 100,
      (multiplier) => {
        earn(this.economy, reward.amount * multiplier);
        void this.saveGame();
        this.celebrateCollect();
        this.refreshUi();
        this.time.delayedCall(DAILY_AFTER_WELCOME_MS, () => this.maybeOpenDaily());
      },
      () => showRewardedAd('offlineDouble'),
      doneAway.map((id) => researchName(id)),
    );
    return true;
  }

  // A returning player sees the daily rewards once a day, on their own, when a new reward is
  // ready. Not before the first tip is seen, so the very first minutes stay about the restaurant.
  private maybeOpenDaily(): void {
    if (!this.seenHints.includes(BOTTLENECK_HINT)) return;
    if (!dailyRewardReady(this.economy.daily, dayNumber(Date.now()))) return;
    this.openDaily();
  }

  private openDaily(): void {
    if (this.dailyModal?.active) return;
    refreshDaily(this.economy, dayNumber(Date.now()));
    const grant = (granted: GrantedReward | null) => {
      if (granted) {
        void this.saveGame();
        this.refreshUi();
      }
      return granted;
    };
    this.dailyModal = new DailyModal(
      this,
      () => this.economy,
      {
        claimReward: (multiplier) => grant(claimDailyReward(this.economy, dayNumber(Date.now()), multiplier)),
        watchAd: () => showRewardedAd('dailyDouble'),
        claimTask: (index) => grant(claimTask(this.economy, index)),
        claimChest: () => {
          const granted = grant(claimChest(this.economy));
          if (granted) this.noteCards(granted.chef, granted.cards);
          return granted;
        },
      },
      UI_DEPTH + 100,
    );
  }

  // Counts progress on today's tasks and announces the ones it finishes.
  private track(kind: TaskKind, amount = 1): void {
    for (const task of recordTask(this.economy, kind, amount)) {
      audio.play('unlock', 0.7);
      this.note(t('banner.taskDone', { task: dailyTaskLabel(task) }));
    }
  }

  // A Lab row's button: collect a finished project, or start a new one.
  private pressResearch(id: ResearchId): void {
    const slot = researchSlot(this.economy, id);
    if (slot && slot.remaining <= 0) {
      if (!collectResearch(this.economy, id)) return;
      this.announcedResearch.delete(id);
      this.celebrate(t('banner.researched', { name: researchName(id), level: this.economy.lab.levels[id] }), PALETTE.success);
    } else {
      if (!startResearch(this.economy, id)) return;
      this.celebratePurchase();
      this.track('research');
      // The first project is the moment a reminder makes sense, so the permission is asked then.
      void notifications.askOnce();
    }
    this.panel.pulseResearch(id);
    void this.saveGame();
    this.refreshUi();
  }

  // Projects that finish while the player is in the game get a short announcement.
  private announceResearch(): void {
    for (const id of finishedResearch(this.economy)) {
      if (this.announcedResearch.has(id)) continue;
      this.announcedResearch.add(id);
      audio.play('look');
      this.note(t('banner.researchDone', { name: researchName(id) }));
    }
  }

  // First-session tip about the Kitchen Lab, once the second dish is on the menu.
  private maybeShowLabHint(): void {
    if (this.hint || this.seenHints.includes(LAB_HINT) || menuSize(this.economy) < LAB_HINT_MENU_SIZE) return;
    if (!this.seenHints.includes(BOTTLENECK_HINT)) return;
    // A player who already found the lab needs no tip.
    const lab = this.economy.lab;
    if (lab.slots.length > 0 || Object.values(lab.levels).some((level) => level > 0)) {
      this.seenHints.push(LAB_HINT);
      return;
    }
    const at = this.panel.labTabPosition;
    this.hintId = LAB_HINT;
    this.hint = new HintBubble(this, at, t('hint.lab'), UI_DEPTH + 50, () => {
      this.hint = null;
      this.hintId = null;
      this.seenHints.push(LAB_HINT);
      this.panel.showTab('lab');
      void this.saveGame();
    });
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
    const rushX = GAME_WIDTH - HUD_MARGIN - AD_BUTTON.width / 2;
    this.rushButton = new Button(this, rushX, 0, AD_BUTTON.width, AD_BUTTON.height, () => this.offerRush(), 'ad');
    this.rushButton.setLabel(`${ADS.rushMultiplier}x`).setDepth(UI_DEPTH);
    this.rushCaption = caption(rushX);

    // Daily rewards: a gift on a glossy square with a red "!" when something waits to be collected.
    const leftX = HUD_MARGIN + DAILY_BUTTON / 2;
    [this.dailyButton, this.dailyBadge] = this.cornerButton(leftX, giftIcon(this), BUTTON_STYLES.toggle.face, () => this.openDaily());
    this.dailyCaption = caption(leftX).setText(t('daily.button'));
    // The chef collection above it, and the shop above Rush.
    [this.chefsButton, this.chefsBadge] = this.cornerButton(leftX, chefHatIcon(this), 0xec7a3c, () => this.openChefs());
    this.chefsCaption = caption(leftX).setText(t('chefs.button'));
    [this.shopButton] = this.cornerButton(rushX, shopIcon(this), 0xb05fd0, () => this.openShop());
    this.shopCaption = caption(rushX).setText(t('shop.button'));
  }

  // A glossy square with an icon and a red "!" badge (hidden), in a room corner.
  private cornerButton(
    x: number,
    icon: string,
    color: number,
    onPress: () => void,
  ): [Phaser.GameObjects.Container, Phaser.GameObjects.Container] {
    const face = this.add.image(0, 0, glossyButton(this, DAILY_BUTTON, DAILY_BUTTON, { face: color })).setScale(1 / ART_RES);
    const image = this.add.image(0, -5, icon).setScale(1 / ART_RES);
    const dot = this.add.circle(0, 0, 20, PALETTE.pomegranate).setStrokeStyle(4, 0xffffff);
    const mark = this.add.text(0, -2, '!', outlined(28)).setOrigin(0.5);
    const badge = this.add.container(DAILY_BUTTON / 2 - 8, -DAILY_BUTTON / 2 + 8, [dot, mark]).setVisible(false);
    this.tweens.add({ targets: badge, scale: 1.18, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const button = this.add.container(x, 0, [face, image, badge]).setDepth(UI_DEPTH);
    button.setSize(DAILY_BUTTON, DAILY_BUTTON).setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => {
      audio.unlock();
      audio.play('click');
      this.tweens.add({ targets: button, scale: 0.92, duration: 60, yoyo: true });
      onPress();
    });
    return [button, badge];
  }

  private openChefs(): void {
    if (this.chefsModal?.active) return;
    this.chefsModal = new ChefsModal(this, () => this.economy, (id) => this.levelUpChef(id), UI_DEPTH + 100);
  }

  private levelUpChef(id: ChefId): boolean {
    if (!levelUpChef(this.economy, id)) return false;
    const level = this.economy.chefs.levels[id];
    const name = chefName(id);
    banner(this, BANNER_Y, level === 1 ? t('chefs.joined', { name }) : t('chefs.leveled', { name, level }), PALETTE.success, UI_DEPTH + 151);
    void this.saveGame();
    this.refreshUi();
    return true;
  }

  // The red "!" on the chefs button; the button hops when a chef can be recruited or leveled up.
  private refreshChefs(): void {
    const attention = chefsNeedAttention(this.economy);
    this.chefsBadge.setVisible(attention);
    if (attention && this.chefsAttention === false) {
      this.tweens.add({ targets: this.chefsButton, scale: 1.2, duration: 160, yoyo: true, repeat: 2, ease: 'Quad.easeOut' });
    }
    this.chefsAttention = attention;
    this.chefsModal?.render();
  }

  // Tells the player who got chef cards.
  private noteCards(chef: ChefId | null, count: number): void {
    if (!chef || count <= 0) return;
    this.note(t('chefs.cardNote', { count, name: chefName(chef) }));
  }

  private openShop(): void {
    if (this.shopModal?.active) return;
    this.shopModal = new ShopModal(
      this,
      () => this.economy,
      store.prices(),
      { buy: (id) => this.buyProduct(id), restore: () => this.restorePurchases() },
      UI_DEPTH + 100,
    );
  }

  private async buyProduct(id: ProductId): Promise<void> {
    const result = await store.purchase(id);
    if (!this.sys.isActive()) return;
    if (result === 'purchased') this.applyPurchase(id);
    else if (result === 'failed') this.note(t('shop.failed'));
  }

  // Gives what a purchase contains (once) and thanks the player.
  private applyPurchase(id: ProductId): boolean {
    const granted = grantPurchase(this.economy, id);
    if (!granted) return false;
    adPolicy.removed = adsRemoved(this.economy);
    const key = id === 'no_ads' ? 'shop.noAds.name' : id === 'golden_kitchen' ? 'shop.golden.name' : 'shop.starter.name';
    audio.play('celebrate');
    banner(this, BANNER_Y, t('shop.thanks', { name: t(key) }), PALETTE.success, UI_DEPTH + 151);
    confetti(this, GAME_WIDTH / 2, BANNER_Y + 40, UI_DEPTH + 151);
    if (granted.money > 0) floatingText(this, GAME_WIDTH / 2, BANNER_Y + 160, `+${formatNumber(granted.money)}`, PALETTE.saffron, 64, UI_DEPTH + 151);
    this.noteCards(granted.chef, granted.cards);
    void this.saveGame();
    this.refreshUi();
    this.shopModal?.render();
    return true;
  }

  // Products the store says the player owns but the save does not have (bought before a
  // reinstall, or a purchase that completed later) are granted now.
  private async syncPurchases(): Promise<void> {
    const owned = await store.owned();
    if (!owned || !this.sys.isActive()) return;
    owned.forEach((id) => this.applyPurchase(id));
  }

  private async restorePurchases(): Promise<void> {
    const owned = await store.owned();
    if (!this.sys.isActive()) return;
    if (owned === null) {
      this.note(t('shop.failed'));
      return;
    }
    owned.forEach((id) => this.applyPurchase(id));
    this.note(t(owned.length > 0 ? 'shop.restored' : 'shop.nothingToRestore'));
  }

  // The red "!" on the daily button; the button hops when something new is ready.
  private refreshDaily(): void {
    const day = dayNumber(Date.now());
    if (refreshDaily(this.economy, day)) this.dailyModal?.render();
    const attention = dailyNeedsAttention(this.economy.daily, day);
    this.dailyBadge.setVisible(attention);
    if (attention && this.dailyAttention === false) {
      this.tweens.add({ targets: this.dailyButton, scale: 1.2, duration: 160, yoyo: true, repeat: 2, ease: 'Quad.easeOut' });
    }
    this.dailyAttention = attention;
  }

  private refreshAdButtons(): void {
    const rush = this.economy.rushSeconds;
    this.rushButton.setButtonStyle(canActivateRush(this.economy) ? BUTTON_STYLES.buy : BUTTON_STYLES.disabled, canActivateRush(this.economy));
    this.rushCaption.setText(rush > 0 ? tDuration(rush) : t('ads.rushCaption'));
    this.rushButton.setLabel(`${ADS.rushMultiplier}x`, !adPolicy.removed);
    this.rushCaption.setColor(toCss(rush > 0 ? PALETTE.saffron : PALETTE.cream));
    // The "+" turns grey while the time skip cools down and bounces once when it is ready again.
    const ready = this.economy.timeSkipCooldown <= 0;
    if (ready !== this.plusReady) {
      const [face] = this.plusButton.list as Phaser.GameObjects.Image[];
      face.setTexture(glossyButton(this, PLUS_SIZE, PLUS_SIZE, { face: ready ? BUTTON_STYLES.go.face : BUTTON_STYLES.disabled.face }));
      if (ready && this.plusReady === false) {
        this.tweens.add({ targets: this.plusButton, scale: 1.25, duration: 180, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      }
      this.plusReady = ready;
    }
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
    const cooldown = this.economy.timeSkipCooldown;
    if (cooldown > 0) {
      floatingText(this, this.plusButton.x - 60, this.plusButton.y + 70, t('ads.timeSkipWait', { time: tDuration(cooldown) }), PALETTE.cream, 34);
      return;
    }
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
    const watched = await showRewardedAd(placement);
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
    this.vipCountdown = nextVipGap(Math.random(), this.economy);
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
          this.track('vip');
          floatingText(this, at.x, at.y - 80, `+${formatNumber(tip)}`, PALETTE.saffron, 56, ROOM_FX_DEPTH);
          this.celebrateCollect();
        });
        void this.view.dismissVip(granted);
      },
      () => void this.view.dismissVip(false),
    );
  }

  // --- Scene events -----------------------------------------------------------------------

  // Counts down play time to the next event, then runs it. Events wait while the player is
  // still in the first tips, or busy with the daily rewards or the world map.
  private updateEvent(seconds: number): void {
    const event = this.event;
    if (!event) {
      if (!this.seenHints.includes(BOTTLENECK_HINT) && !this.forcedEvent) return;
      if (this.dailyModal?.active || this.scene.isActive('WorldMap')) return;
      this.eventCountdown -= seconds;
      if (this.eventCountdown <= 0) this.startEvent();
      this.renderEventBar();
      return;
    }
    event.left -= seconds;
    if (event.kind === 'critic') {
      if (criticProgress(this.economy, event.start, event.target) >= 1) this.finishCritic(true);
      else if (event.left <= 0) this.finishCritic(false);
    } else if (event.kind === 'tourBus') {
      event.sinceTap += seconds * 1000;
      if (event.sinceTap > EVENTS.tourBus.comboResetMs) event.taps = 0;
      if (event.left <= 0) this.finishBus();
    } else {
      earn(this.economy, festivalBonusPerSecond(this.economy, event.dish) * seconds);
      if (event.left <= 0) this.finishFestival();
    }
    this.renderEventBar();
  }

  private startEvent(): void {
    let kind = this.forcedEvent ?? pickEvent(this.economy, Math.random(), this.lastEvent);
    this.forcedEvent = null;
    const target = kind === 'critic' ? criticTarget(this.economy) : null;
    if (kind === 'critic' && target === null) kind = 'tourBus';
    this.lastEvent = kind;
    if (kind === 'critic' && target !== null) {
      this.event = { kind, left: EVENTS.critic.seconds, start: throughput(this.economy).customersPerSecond, target };
      void this.view.spawnCritic();
      this.celebrate(t('event.critic.banner'), PALETTE.tileBlue);
      // Point at what to do: the bottleneck's row in the panel.
      this.time.delayedCall(1200, () => this.panel.focusSection(throughput(this.economy).bottleneck));
    } else if (kind === 'tourBus') {
      this.event = { kind, left: EVENTS.tourBus.seconds, taps: 0, sinceTap: 0, tips: 0 };
      this.view.spawnTourists();
      audio.play('vip');
      this.celebrate(t('event.bus.banner'), PALETTE.saffronDark);
    } else {
      const dish = pickFestivalDish(this.economy, Math.random());
      this.event = { kind: 'festival', left: EVENTS.festival.seconds, dish };
      this.celebrate(
        t('event.festival.banner', { dish: this.dishName(dish), multiplier: EVENTS.festival.priceMultiplier }),
        PALETTE.success,
      );
    }
  }

  private endEvent(): void {
    this.event = null;
    this.eventCountdown = nextEventGap(Math.random());
    this.renderEventBar();
  }

  private finishCritic(success: boolean): void {
    void this.view.dismissCritic(success);
    this.endEvent();
    if (success) {
      const chef = grantReview(this.economy);
      void this.saveGame();
      this.celebrate(
        t('event.critic.success', {
          bonus: Math.round((EVENTS.critic.reviewMultiplier - 1) * 100),
          time: tDurationShort(reviewDuration(this.economy)),
        }),
        PALETTE.success,
      );
      this.noteCards(chef, CHEF.criticCards);
    } else {
      this.note(t('event.critic.fail'));
    }
    this.refreshUi();
  }

  // A tap while the tour bus is here: a tip that grows with the combo.
  private tapForBus(at: Point): void {
    const event = this.event;
    if (event?.kind !== 'tourBus') return;
    event.taps++;
    event.sinceTap = 0;
    const combo = busCombo(event.taps);
    const tip = payBusTip(this.economy, combo);
    event.tips += tip;
    this.view.cheerTourist();
    floatingText(this, at.x + 40, at.y - 90, `+${formatNumber(tip)}`, PALETTE.cream, 34 + combo * 4, ROOM_FX_DEPTH);
    if (combo > busCombo(event.taps - 1)) {
      audio.play('unlock', 0.8);
      floatingText(this, at.x, at.y - 160, t('event.bus.combo', { combo }), PALETTE.saffron, 64, ROOM_FX_DEPTH);
    }
  }

  private finishBus(): void {
    const event = this.event;
    if (event?.kind !== 'tourBus') return;
    this.view.dismissTourists();
    this.endEvent();
    const tips = event.tips;
    if (tips < baseIncomePerSecond(this.economy) * BUS_OFFER_MIN_SECONDS) {
      this.note(t('event.bus.over'));
      return;
    }
    void this.saveGame();
    const offer = {
      title: t('event.bus.doneTitle'),
      body: t('event.bus.doneBody', { amount: formatNumber(tips), multiplier: EVENTS.tourBus.adMultiplier }),
      reward: `+${formatNumber(tips * (EVENTS.tourBus.adMultiplier - 1))}`,
      rewardIcon: 'coin',
    };
    new AdOfferModal(this, offer, UI_DEPTH + 100, () =>
      this.watchAd('busDouble', () => {
        earn(this.economy, tips * (EVENTS.tourBus.adMultiplier - 1));
        this.celebrateCollect();
      }),
    );
  }

  private finishFestival(): void {
    this.endEvent();
    this.note(t('event.festival.over'));
  }

  // Extra income from a running festival.
  private festivalBonus(): number {
    return this.event?.kind === 'festival' ? festivalBonusPerSecond(this.economy, this.event.dish) : 0;
  }

  private dishName(index: number): string {
    return t(`dish.${cityConfig(this.economy.city).dishes[index]}` as TranslationKey);
  }

  // The event card: the running event, else a good review that is still boosting income.
  private renderEventBar(): void {
    const view = this.eventView();
    if (view) this.eventBar.show(view);
    else this.eventBar.hide();
  }

  private eventView(): EventView | null {
    const event = this.event;
    const timer = (left: number) => tDuration(Math.max(0, Math.ceil(left)));
    if (event?.kind === 'critic') {
      const progress = criticProgress(this.economy, event.start, event.target);
      return {
        icon: 'star',
        iconSize: 60,
        title: t('event.critic.title'),
        // Rounded up, so reaching the number shown always satisfies the critic.
        detail: t('event.critic.detail', { target: event.target >= 10 ? formatNumber(Math.ceil(event.target)) : (Math.ceil(event.target * 100) / 100).toFixed(2) }),
        progress,
        barColor: progress >= 1 ? 0x4fb030 : 0x2f88a8,
        timer: timer(event.left),
      };
    }
    if (event?.kind === 'tourBus') {
      return {
        icon: 'coin',
        iconSize: 60,
        title: t('event.bus.title'),
        detail: t('event.bus.detail', { combo: busCombo(Math.max(1, event.taps)), amount: formatNumber(event.tips) }),
        progress: event.left / EVENTS.tourBus.seconds,
        barColor: 0xf0a020,
        timer: timer(event.left),
      };
    }
    if (event?.kind === 'festival') {
      const dishId = cityConfig(this.economy.city).dishes[event.dish];
      return {
        icon: dishIcon(this, dishId, DISH_COLORS[event.dish]),
        iconSize: 70,
        title: t('event.festival.title', { city: this.cityName(this.economy.city) }),
        detail: t('event.festival.detail', { dish: this.dishName(event.dish), multiplier: EVENTS.festival.priceMultiplier }),
        progress: event.left / EVENTS.festival.seconds,
        barColor: 0x4fb030,
        timer: timer(event.left),
      };
    }
    if (this.economy.reviewSeconds > 0) {
      return {
        icon: 'star',
        iconSize: 60,
        title: t('event.review.title'),
        detail: t('event.review.detail', { multiplier: EVENTS.critic.reviewMultiplier }),
        progress: this.economy.reviewSeconds / EVENTS.critic.reviewSeconds,
        barColor: 0x4fb030,
        timer: timer(this.economy.reviewSeconds),
      };
    }
    return null;
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
    this.track('playTime', delta / 1000);
    this.room.update(delta);
    this.updateVip(delta / 1000);
    this.updateEvent(delta / 1000);
    const flow = throughput(this.economy);
    this.view.update(
      {
        rates: sectionRates(this.economy),
        levels: this.economy.sectionLevels,
        customersPerSecond: flow.customersPerSecond,
        incomePerSecond: incomePerSecond(this.economy) + this.festivalBonus(),
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
    this.track('taps');
    if (this.event?.kind === 'tourBus') this.tapForBus(at);
    audio.play('tap');
    sparkle(this, at.x, at.y, PALETTE.saffron, ROOM_FX_DEPTH);
    floatingText(this, at.x, at.y - 40, `+${formatNumber(amount)}`, PALETTE.saffron, 38, ROOM_FX_DEPTH);
    this.flyCoinToHud(screen);
  }

  private buySection(id: SectionId): void {
    const level = this.economy.sectionLevels[id];
    const bought = buySectionLevels(this.economy, id, this.panel.buyAmount);
    if (bought === 0) return;
    this.track('upgrades', bought);
    void this.saveGame();
    this.panel.pulseSection(id);
    this.celebratePurchase();
    this.announceSectionLevels(id, level);
    this.refreshUi();
  }

  // A new look or a milestone reached by going from level `from` to the current level.
  private announceSectionLevels(id: SectionId, from: number): void {
    const before = milestonesReached(from);
    const lookBefore = styleTier(from);
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
  }

  private buyDish(index: number): void {
    const level = this.economy.dishLevels[index];
    const cardsTo = level === 0 ? cardTarget(this.economy) : null;
    const bought = buyDishLevels(this.economy, index, this.panel.buyAmount);
    if (bought === 0) return;
    this.track('dishLevels', bought);
    void this.saveGame();
    this.panel.pulseDish(index);
    this.celebratePurchase();
    const name = t(`dish.${cityConfig(this.economy.city).dishes[index]}` as TranslationKey);
    const newLevel = this.economy.dishLevels[index];
    if (level === 0) {
      this.celebrateNewDish(t('banner.newDish', { name }));
      this.noteCards(cardsTo, CHEF.dishCards);
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

  // A new dish on the menu is the game's main reward: fireworks over the whole screen, under
  // any open dialog, with the banner on top so it stays readable.
  private celebrateNewDish(message: string): void {
    audio.play('celebrate');
    fireworksShow(this, UI_DEPTH + 50, () => audio.play('firework', 0.8));
    banner(this, BANNER_Y, message, PALETTE.success, UI_DEPTH + 51);
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
    const income = formatNumber(incomePerSecond(this.economy) + this.festivalBonus());
    const boost = boostMultiplier(this.economy);
    this.incomeText.setText(
      boost > 1
        ? t('hud.perSecondRush', { amount: income, multiplier: Number(boost.toFixed(2)) })
        : t('hud.perSecond', { amount: income }),
    );
    this.starsText.setText(formatNumber(this.economy.stars, 0));
    this.panel.refresh(this.economy);
    this.refreshFranchise();
    this.refreshAdButtons();
    this.refreshDaily();
    this.refreshChefs();
    this.refreshGoal();
    this.announceResearch();
    this.maybeShowLabHint();
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
    // A striped awning across the top, with a scalloped edge hanging over the room.
    this.add.image(0, 0, paintHudAwning(this)).setOrigin(0).setScale(1 / ART_RES).setDepth(UI_DEPTH);

    // Center: money in a dark pill with the coin overlapping its left end, income below.
    this.add.image(GAME_WIDTH / 2 + 20, HUD_COIN.y, counterPill(this, MONEY_PILL.width, MONEY_PILL.height)).setScale(1 / ART_RES).setDepth(UI_DEPTH);
    this.hudCoin = this.add.image(HUD_COIN.x, HUD_COIN.y, 'coin').setScale(1.1).setDepth(UI_DEPTH);
    this.moneyText = this.add
      .text(GAME_WIDTH / 2 + 10, HUD_COIN.y - 2, '0', outlined(58))
      .setOrigin(0.5)
      .setDepth(UI_DEPTH);
    this.incomeText = this.add
      .text(GAME_WIDTH / 2 + 20, 148, '', outlined(32, { color: 0xffe066, stroke: 0x6a1a10 }))
      .setOrigin(0.5)
      .setDepth(UI_DEPTH);

    const plusX = GAME_WIDTH / 2 + 20 + MONEY_PILL.width / 2 - 8;
    const plusFace = this.add.image(0, 0, glossyButton(this, PLUS_SIZE, PLUS_SIZE, { face: BUTTON_STYLES.go.face })).setScale(1 / ART_RES);
    const plusMark = this.add.text(0, -6, '+', outlined(56)).setOrigin(0.5);
    this.plusButton = this.add.container(plusX, HUD_COIN.y, [plusFace, plusMark]).setDepth(UI_DEPTH);
    this.plusButton.setSize(PLUS_SIZE + 20, PLUS_SIZE + 20).setInteractive({ useHandCursor: true });
    this.plusButton.on('pointerdown', () => {
      audio.play('click');
      this.tweens.add({ targets: this.plusButton, scale: 0.9, duration: 70, yoyo: true });
      this.offerTimeSkip();
    });

    // Left: city (opens the world map) and Chef Stars.
    const cityPill = this.add.image(HUD_MARGIN + CITY_PILL.width / 2, 58, counterPill(this, CITY_PILL.width, CITY_PILL.height)).setScale(1 / ART_RES).setDepth(UI_DEPTH);
    const globe = this.add.image(HUD_MARGIN + 18, 58, globeIcon(this)).setScale(1 / ART_RES).setDepth(UI_DEPTH);
    const cityText = this.add
      .text(HUD_MARGIN + 66, 56, this.cityName(this.economy.city), outlined(30))
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH);
    cityText.setScale(Math.min(1, (CITY_PILL.width - 76) / cityText.width));
    cityPill.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      audio.play('click');
      this.tweens.add({ targets: [cityPill, globe, cityText], scale: '*=0.94', duration: 70, yoyo: true });
      this.openWorldMap();
    });
    const starsPill = this.add
      .image(HUD_MARGIN + STARS_PILL.width / 2 + 10, 132, counterPill(this, STARS_PILL.width, STARS_PILL.height))
      .setScale(1 / ART_RES)
      .setDepth(UI_DEPTH);
    starsPill.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      audio.play('click');
      new PerksModal(this, this.economy.stars, this.economy.perks, UI_DEPTH + 100);
    });
    this.add.image(HUD_MARGIN + 18, 130, 'star').setScale(0.85).setDepth(UI_DEPTH);
    this.starsText = this.add
      .text(HUD_MARGIN + 62, 130, '0', outlined(36))
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH);

    // Far right: settings gear on a glossy square.
    const gearX = GAME_WIDTH - HUD_MARGIN - GEAR_SIZE / 2;
    const gearBg = this.add.image(gearX, 82, glossyButton(this, GEAR_SIZE, GEAR_SIZE, { face: 0x3d86d8 })).setScale(1 / ART_RES).setDepth(UI_DEPTH);
    const gear = this.add.image(gearX, 78, gearIcon(this)).setScale(0.62).setDepth(UI_DEPTH);
    gearBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      audio.unlock();
      audio.play('click');
      this.tweens.add({ targets: gear, angle: gear.angle + 90, duration: 250, ease: 'Quad.easeOut' });
      this.openSettings();
    });

    // Right: franchise button, hidden until the menu is complete.
    this.franchiseButton = new Button(this, gearX - GEAR_SIZE / 2 - 16 - 85, 74, 170, 92, () => this.openFranchise(), 'star');
    this.franchiseButton.setButtonStyle(BUTTON_STYLES.go).setDepth(UI_DEPTH).setVisible(false);
    this.franchiseCaption = this.add
      .text(this.franchiseButton.x, 148, t('franchise.button'), outlined(24))
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
