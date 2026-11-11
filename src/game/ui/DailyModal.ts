import Phaser from 'phaser';
import {
  ADS,
  DAILY,
  WEEKLY,
  chestReady,
  dailyCycle,
  dailyRewardReady,
  dayNumber,
  rewardValue,
  secondsToNextDay,
  secondsToNextWeek,
  streakSaveable,
  taskDone,
  taskReward,
  weeklyChestReady,
  weeklyNeedsAttention,
  type DailyReward,
  type DailyTask,
  type EconomyState,
  type GrantedReward,
} from '../../core/economy';
import { formatNumber } from '../../core/format';
import { t, tDuration, tDurationShort, type TranslationKey } from '../../i18n';
import { PALETTE } from '../config';
import { confetti, floatingText, sparkle } from '../fx';
import { audio } from '../audio';
import { adIcon, adText } from '../ads/AdService';
import { ART_RES } from '../view/paint';
import { BUTTON_STYLES, Button } from './Button';
import { createModalCard, modalText } from './modalCard';
import { chefCardIcon, giftIcon } from './icons';
import { card, outlined, plain, wrapStyle } from './style';

const CARD_WIDTH = 960;
const CARD_HEIGHT = 1600;
const TILE = { width: 118, height: 176, gap: 8 };
const ROW = { width: 880, height: 138, gap: 14 };
const ROW_BUTTON = { width: 230, height: 92 };
const BAR = { width: 470, height: 18 };
const TABS = { y: 172, width: 300, height: 80, gap: 20 };
// Everything below the tabs.
const PAGE_TOP = 96;
const WEEKLY_CHEST_HEIGHT = 200;
const REFRESH_MS = 500;

type Page = 'daily' | 'weekly';

export interface DailyActions {
  // multiplier is DAILY.adMultiplier after a watched ad.
  claimReward(multiplier: number): GrantedReward | null;
  // Plays the rewarded ad for a double reward; resolves whether it was watched.
  watchAd(): Promise<boolean>;
  claimTask(index: number): GrantedReward | null;
  claimChest(): GrantedReward | null;
  claimWeeklyTask(index: number): GrantedReward | null;
  claimWeeklyChest(): GrantedReward | null;
  // Plays the rewarded ad and saves a streak broken by one missed day; resolves whether it did.
  saveStreak(): Promise<boolean>;
}

interface DayTile {
  reward: DailyReward;
  value: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Image;
  check: Phaser.GameObjects.Text;
  container: Phaser.GameObjects.Container;
}

interface TaskRow {
  label: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
  fill: Phaser.GameObjects.Graphics;
  button: Button;
}

// A task's text; weekly tasks have their own wording (bigger counts).
export function taskLabel(task: DailyTask, weekly: boolean): string {
  const target = task.kind === 'playTime' ? tDurationShort(task.target) : formatNumber(task.target, 0);
  return t(`${weekly ? 'weekly' : 'daily'}.task.${task.kind}` as TranslationKey, { count: target });
}

export function dailyTaskLabel(task: DailyTask): string {
  return taskLabel(task, false);
}

// A small red "!" that pulses on a tab with something to collect.
function badge(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const dot = scene.add.circle(0, 0, 20, PALETTE.pomegranate).setStrokeStyle(4, 0xffffff);
  const mark = scene.add.text(0, -2, '!', outlined(28)).setOrigin(0.5);
  const container = scene.add.container(x, y, [dot, mark]);
  scene.tweens.add({ targets: container, scale: 1.18, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return container;
}

// Two pages: daily rewards (a 7-day streak, with a saver for one missed day) with today's three
// tasks and a chest; and this week's three bigger tasks with a big chest.
export class DailyModal extends Phaser.GameObjects.Container {
  private page: Page = 'daily';
  private readonly pages: Record<Page, Phaser.GameObjects.GameObject[]> = { daily: [], weekly: [] };
  private readonly tabs: Record<Page, Button>;
  private readonly badges: Record<Page, Phaser.GameObjects.Container>;
  private readonly tiles: DayTile[] = [];
  private readonly rows: TaskRow[] = [];
  private readonly weeklyRows: TaskRow[] = [];
  private readonly claimButton: Button;
  private readonly adButton: Button;
  private busy = false;
  private readonly streakInfo: Phaser.GameObjects.Text;
  private readonly saverText: Phaser.GameObjects.Text;
  private readonly saverButton: Button;
  private readonly chestButton: Button;
  private readonly chestText: Phaser.GameObjects.Text;
  private readonly tasksTimer: Phaser.GameObjects.Text;
  private readonly weeklyTimer: Phaser.GameObjects.Text;
  private readonly weeklyChestButton: Button;
  private readonly weeklyChestText: Phaser.GameObjects.Text;
  private readonly fxDepth: number;

  constructor(
    scene: Phaser.Scene,
    private readonly economy: () => EconomyState,
    private readonly actions: DailyActions,
    depth: number,
  ) {
    super(scene, 0, 0);
    this.fxDepth = depth + 10;
    const modal = createModalCard(scene, CARD_WIDTH, CARD_HEIGHT, t('daily.title'));
    const { cx } = modal;
    const top = modal.top;
    const children: Phaser.GameObjects.GameObject[] = [...modal.objects];

    // Page tabs.
    const tabX = (i: number) => cx + (i - 0.5) * (TABS.width + TABS.gap);
    this.tabs = {
      daily: new Button(scene, tabX(0), top + TABS.y, TABS.width, TABS.height, () => this.showPage('daily')),
      weekly: new Button(scene, tabX(1), top + TABS.y, TABS.width, TABS.height, () => this.showPage('weekly')),
    };
    this.tabs.daily.setLabel(t('daily.tabDaily'));
    this.tabs.weekly.setLabel(t('daily.tabWeekly'));
    const badgeY = top + TABS.y - TABS.height / 2 + 6;
    this.badges = {
      daily: badge(scene, tabX(0) + TABS.width / 2 - 12, badgeY),
      weekly: badge(scene, tabX(1) + TABS.width / 2 - 12, badgeY),
    };
    children.push(this.tabs.daily, this.tabs.weekly, this.badges.daily, this.badges.weekly);

    const daily = this.pages.daily;
    const pageTop = top + PAGE_TOP;

    // The streak line, or the streak saver when one day was missed.
    this.streakInfo = modalText(scene, modal, CARD_WIDTH, pageTop + 180, t('daily.streakInfo'), 30, PALETTE.muted);
    this.saverText = scene.add
      .text(cx - ROW.width / 2 + 10, pageTop + 180, '', { ...plain(30, PALETTE.pomegranate, true), wordWrap: wrapStyle(ROW.width - 330) })
      .setOrigin(0, 0.5);
    this.saverButton = new Button(scene, cx + ROW.width / 2 - 150, pageTop + 180, 300, 92, () => void this.saveStreak(), adIcon());
    this.saverButton.setLabel(t('daily.saveStreak')).setButtonStyle(BUTTON_STYLES.toggle);
    daily.push(this.streakInfo, this.saverText, this.saverButton);

    // Seven day tiles.
    const rowWidth = DAILY.rewards.length * TILE.width + (DAILY.rewards.length - 1) * TILE.gap;
    DAILY.rewards.forEach((reward, i) => {
      const x = cx - rowWidth / 2 + TILE.width / 2 + i * (TILE.width + TILE.gap);
      const tile = this.createTile(scene, x, pageTop + 345, i, reward);
      this.tiles.push(tile);
      daily.push(tile.container);
    });
    this.claimButton = new Button(scene, cx, pageTop + 525, 380, 110, () => this.claimReward(1));
    this.adButton = new Button(scene, cx + 205, pageTop + 525, 380, 110, () => void this.claimWithAd(), adIcon());
    this.adButton.setLabel(t('daily.collectMore', { multiplier: DAILY.adMultiplier })).setButtonStyle(BUTTON_STYLES.buy);
    daily.push(this.claimButton, this.adButton);

    // Today's tasks.
    const tasksTitle = scene.add.text(cx, pageTop + 650, t('daily.tasksTitle'), outlined(46, { color: PALETTE.cream })).setOrigin(0.5);
    this.tasksTimer = modalText(scene, modal, CARD_WIDTH, pageTop + 705, '', 28, PALETTE.muted);
    daily.push(tasksTitle, this.tasksTimer);
    for (let i = 0; i < DAILY.taskRewards.length; i++) {
      const y = pageTop + 820 + i * (ROW.height + ROW.gap);
      const { row, objects } = this.createTaskRow(scene, cx, y, () => this.claimTask(i), false);
      this.rows.push(row);
      daily.push(...objects);
    }

    // The chest for finishing all three.
    const chestY = pageTop + 820 + DAILY.taskRewards.length * (ROW.height + ROW.gap);
    const chestBg = scene.add
      .image(cx, chestY, card(scene, 'daily-chest', ROW.width, ROW.height, { top: 0xfff6d8, bottom: 0xffe08a, border: 0xf0a020 }))
      .setScale(1 / ART_RES);
    const gift = scene.add.image(cx - ROW.width / 2 + 62, chestY - 4, giftIcon(scene)).setScale(1.3 / ART_RES);
    this.chestText = scene.add
      .text(cx - ROW.width / 2 + 120, chestY - 2, '', { ...plain(30, PALETTE.ink, true), wordWrap: wrapStyle(ROW.width - 400) })
      .setOrigin(0, 0.5);
    this.chestButton = new Button(scene, cx + ROW.width / 2 - ROW_BUTTON.width / 2 - 20, chestY, ROW_BUTTON.width, ROW_BUTTON.height, () =>
      this.claimChest(),
    );
    daily.push(chestBg, gift, this.chestText, this.chestButton);

    // This week's tasks and the big chest.
    const weekly = this.pages.weekly;
    const weeklyInfo = modalText(scene, modal, CARD_WIDTH, pageTop + 190, t('weekly.info'), 30, PALETTE.muted);
    const weeklyTitle = scene.add.text(cx, pageTop + 300, t('weekly.title'), outlined(46, { color: PALETTE.cream })).setOrigin(0.5);
    this.weeklyTimer = modalText(scene, modal, CARD_WIDTH, pageTop + 355, '', 28, PALETTE.muted);
    weekly.push(weeklyInfo, weeklyTitle, this.weeklyTimer);
    for (let i = 0; i < WEEKLY.taskCount; i++) {
      const y = pageTop + 470 + i * (ROW.height + ROW.gap);
      const { row, objects } = this.createTaskRow(scene, cx, y, () => this.claimWeeklyTask(i), true);
      this.weeklyRows.push(row);
      weekly.push(...objects);
    }
    const weeklyChestY = pageTop + 470 + WEEKLY.taskCount * (ROW.height + ROW.gap) + (WEEKLY_CHEST_HEIGHT - ROW.height) / 2 + 20;
    const weeklyChestBg = scene.add
      .image(
        cx,
        weeklyChestY,
        card(scene, 'weekly-chest', ROW.width, WEEKLY_CHEST_HEIGHT, { top: 0xfff6d8, bottom: 0xffc94a, border: 0xe08a10, borderWidth: 6 }),
      )
      .setScale(1 / ART_RES);
    const bigGift = scene.add.image(cx - ROW.width / 2 + 84, weeklyChestY - 6, giftIcon(scene)).setScale(1.9 / ART_RES);
    this.weeklyChestText = scene.add
      .text(cx - ROW.width / 2 + 170, weeklyChestY - 2, '', { ...plain(32, PALETTE.ink, true), wordWrap: wrapStyle(ROW.width - 450) })
      .setOrigin(0, 0.5);
    this.weeklyChestButton = new Button(
      scene,
      cx + ROW.width / 2 - ROW_BUTTON.width / 2 - 20,
      weeklyChestY,
      ROW_BUTTON.width,
      ROW_BUTTON.height + 10,
      () => this.claimWeeklyChest(),
    );
    weekly.push(weeklyChestBg, bigGift, this.weeklyChestText, this.weeklyChestButton);

    const close = new Button(scene, cx, top + CARD_HEIGHT - 80, 320, 90, () => this.destroy());
    close.setLabel(t('settings.close')).setButtonStyle(BUTTON_STYLES.primary);

    this.add([...children, ...daily, ...weekly, close]);
    this.setDepth(depth);
    scene.add.existing(this);
    this.showPage('daily');
    const timer = scene.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.render() });
    this.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
  }

  private showPage(page: Page): void {
    this.page = page;
    for (const id of ['daily', 'weekly'] as Page[]) {
      this.tabs[id].setButtonStyle(id === page ? BUTTON_STYLES.primary : BUTTON_STYLES.disabled);
      for (const object of this.pages[id]) (object as unknown as Phaser.GameObjects.Components.Visible).setVisible(id === page);
    }
    this.render();
  }

  private createTile(scene: Phaser.Scene, x: number, y: number, index: number, reward: DailyReward): DayTile {
    const big = index === DAILY.rewards.length - 1;
    const bg = scene.add.image(0, 0, '__DEFAULT').setScale(1 / ART_RES);
    const day = scene.add.text(0, -62, t('daily.day', { day: index + 1 }), plain(24, PALETTE.ink, true)).setOrigin(0.5);
    const objects: Phaser.GameObjects.GameObject[] = [bg, day];
    if (reward.money) {
      objects.push(scene.add.image(0, -6, 'coin').setScale(big ? 0.85 : 0.75));
    } else {
      objects.push(scene.add.text(0, -6, `${ADS.rushMultiplier}x`, outlined(40, { color: 0xffe066, stroke: 0x6a1a10 })).setOrigin(0.5));
    }
    // Filled in by render(): money follows the current income.
    const value = scene.add
      .text(0, 52, '', { ...plain(reward.money && reward.rush ? 21 : 24, PALETTE.saffronDark, true), align: 'center' })
      .setOrigin(0.5);
    const check = scene.add.text(0, 0, '✓', outlined(72, { color: 0x6fd04a, stroke: 0x245a10 })).setOrigin(0.5);
    objects.push(value, check);
    const container = scene.add.container(x, y, objects);
    return { reward, value, bg, check, container };
  }

  // A task row: text, progress bar and a collect button. Weekly rows also show their chef card.
  private createTaskRow(scene: Phaser.Scene, cx: number, y: number, onClaim: () => void, weekly: boolean) {
    const left = cx - ROW.width / 2;
    const bg = scene.add
      .image(cx, y, card(scene, 'daily-task', ROW.width, ROW.height, { top: 0xfffdf6, bottom: 0xfbe8c8, border: 0xe0c49a }))
      .setScale(1 / ART_RES);
    const barWidth = weekly ? BAR.width - 90 : BAR.width;
    const label = scene.add
      .text(left + 32, y - 28, '', { ...plain(30, PALETTE.ink, true), wordWrap: wrapStyle(ROW.width - ROW_BUTTON.width - 80) })
      .setOrigin(0, 0.5);
    const track = scene.add.graphics();
    const barY = y + 32;
    track.fillStyle(0x5a3a20, 0.3).fillRoundedRect(left + 30, barY - BAR.height / 2 - 2, barWidth + 4, BAR.height + 4, 10);
    track.fillStyle(0xe8d8bc, 1).fillRoundedRect(left + 32, barY - BAR.height / 2, barWidth, BAR.height, 8);
    const fill = scene.add.graphics();
    fill.setPosition(left + 32, barY - BAR.height / 2);
    fill.setData('width', barWidth);
    const count = scene.add.text(left + 32 + barWidth + 16, barY, '', plain(24, PALETTE.muted, true)).setOrigin(0, 0.5);
    const buttonX = cx + ROW.width / 2 - ROW_BUTTON.width / 2 - 20;
    const button = new Button(scene, buttonX, y, ROW_BUTTON.width, ROW_BUTTON.height, onClaim, 'coin');
    const objects: Phaser.GameObjects.GameObject[] = [bg, track, fill, label, count, button];
    if (weekly) {
      // The chef card each weekly task pays on top of the money.
      const cardX = buttonX - ROW_BUTTON.width / 2 - 52;
      const icon = scene.add.image(cardX - 12, y + 6, chefCardIcon(scene)).setScale(0.8 / ART_RES);
      const cards = scene.add.text(cardX + 16, y + 30, `+${WEEKLY.taskReward.cards}`, outlined(28)).setOrigin(0.5);
      objects.push(icon, cards);
    }
    return { row: { label, count, fill, button }, objects };
  }

  // Redraws everything from the economy (also every half second: tasks progress underneath).
  render(): void {
    if (!this.active) return;
    const state = this.economy();
    const now = Date.now();
    const day = dayNumber(now);
    const dailyWaiting =
      dailyRewardReady(state.daily, day) || state.daily.tasks.some((task) => !task.claimed && taskDone(task)) || chestReady(state.daily);
    this.badges.daily.setVisible(dailyWaiting && this.page !== 'daily');
    this.badges.weekly.setVisible(weeklyNeedsAttention(state.daily) && this.page !== 'weekly');
    if (this.page === 'daily') this.renderDaily(state, now, day);
    else this.renderWeekly(state, now);
  }

  private renderDaily(state: EconomyState, now: number, day: number): void {
    const cycle = dailyCycle(state.daily, day);
    this.tiles.forEach((tile, i) => {
      const today = i === cycle.index;
      const done = i < cycle.index || (today && cycle.claimed);
      const key = today && !cycle.claimed ? 'daily-tile-today' : done ? 'daily-tile-done' : 'daily-tile';
      const look = {
        'daily-tile-today': { top: 0xfff6d8, bottom: 0xffd96a, border: 0xf0a020 },
        'daily-tile-done': { top: 0xeaf6e2, bottom: 0xcfe8c0, border: 0x8cc46e },
        'daily-tile': { top: 0xfffdf6, bottom: 0xf3e2c4, border: 0xe0c49a },
      }[key];
      tile.bg.setTexture(card(this.scene, key, TILE.width, TILE.height, { ...look, radius: 20 }));
      tile.check.setVisible(done);
      const worth = rewardValue(state, tile.reward);
      const rush = worth.rush > 0 ? `${worth.money > 0 ? `${ADS.rushMultiplier}x ` : ''}${tDurationShort(worth.rush)}` : '';
      const lines = [worth.money > 0 ? formatNumber(worth.money) : '', rush].filter(Boolean).join('\n');
      if (tile.value.text !== lines) tile.value.setText(lines);
      tile.container.setAlpha(done ? 0.85 : 1);
      tile.container.setScale(today && !cycle.claimed ? 1.08 : 1);
    });

    // One missed day: offer to save the streak instead of the usual line.
    const saveable = streakSaveable(state.daily, day);
    this.streakInfo.setVisible(!saveable);
    this.saverText.setVisible(saveable);
    this.saverButton.setVisible(saveable);
    if (saveable) this.saverText.setText(adText('daily.saverText', { streak: state.daily.streak }));

    const ready = dailyRewardReady(state.daily, day);
    if (ready) {
      this.claimButton.setLabel(t('daily.collect')).setButtonStyle(BUTTON_STYLES.go);
      this.claimButton.setX(this.adButton.x - 410);
      this.adButton.setVisible(true);
    } else {
      this.claimButton.setX(this.adButton.x - 205);
      this.adButton.setVisible(false);
      this.claimButton.setLabel(t('daily.nextIn', { time: tDuration(secondsToNextDay(now)) })).setButtonStyle(BUTTON_STYLES.disabled, false);
    }
    this.tasksTimer.setText(t('daily.newTasksIn', { time: tDuration(secondsToNextDay(now)) }));

    state.daily.tasks.forEach((task, i) => {
      const amount = `+${formatNumber(rewardValue(state, taskReward(i)).money)}`;
      this.renderTaskRow(this.rows[i], task, amount, false);
    });

    const chest = rewardValue(state, DAILY.chest);
    this.chestText.setText(
      t('daily.chest', {
        amount: formatNumber(chest.money),
        rush: `${ADS.rushMultiplier}x ${tDurationShort(chest.rush)}`,
        cards: chest.cards,
      }),
    );
    if (state.daily.chestClaimed) this.chestButton.setLabel('✓').setButtonStyle(BUTTON_STYLES.disabled, false);
    else this.chestButton.setLabel(t('daily.open')).setButtonStyle(chestReady(state.daily) ? BUTTON_STYLES.go : BUTTON_STYLES.disabled, chestReady(state.daily));
  }

  private renderWeekly(state: EconomyState, now: number): void {
    this.weeklyTimer.setText(t('weekly.newIn', { time: tDuration(secondsToNextWeek(now)) }));
    const amount = `+${formatNumber(rewardValue(state, WEEKLY.taskReward).money)}`;
    state.daily.weeklyTasks.forEach((task, i) => this.renderTaskRow(this.weeklyRows[i], task, amount, true));

    const chest = rewardValue(state, WEEKLY.chest);
    this.weeklyChestText.setText(
      t('weekly.chest', {
        amount: formatNumber(chest.money),
        rush: `${ADS.rushMultiplier}x ${tDurationShort(chest.rush)}`,
        cards: chest.cards,
      }),
    );
    const ready = weeklyChestReady(state.daily);
    if (state.daily.weeklyChestClaimed) this.weeklyChestButton.setLabel('✓').setButtonStyle(BUTTON_STYLES.disabled, false);
    else this.weeklyChestButton.setLabel(t('daily.open')).setButtonStyle(ready ? BUTTON_STYLES.go : BUTTON_STYLES.disabled, ready);
  }

  private renderTaskRow(row: TaskRow | undefined, task: DailyTask, amount: string, weekly: boolean): void {
    if (!row) return;
    const label = taskLabel(task, weekly);
    if (row.label.text !== label) row.label.setText(label);
    const width = row.fill.getData('width') as number;
    const progress = task.progress / task.target;
    row.fill.clear();
    if (progress > 0) {
      const w = Math.max(BAR.height, width * progress);
      row.fill.fillStyle(taskDone(task) ? 0x4fb030 : 0xf0a020, 1).fillRoundedRect(0, 0, w, BAR.height, 8);
      row.fill.fillStyle(0xffffff, 0.45).fillRoundedRect(3, 2, Math.max(0, w - 6), BAR.height * 0.35, 3);
    }
    const shown =
      task.kind === 'playTime'
        ? `${Math.floor(task.progress / 60)}/${task.target / 60}`
        : `${Math.floor(task.progress)}/${task.target}`;
    row.count.setText(shown);
    if (task.claimed) row.button.setLabel('✓', false).setButtonStyle(BUTTON_STYLES.disabled, false);
    else if (taskDone(task)) row.button.setLabel(amount).setButtonStyle(BUTTON_STYLES.go);
    else row.button.setLabel(amount).setButtonStyle(BUTTON_STYLES.disabled, false);
  }

  // A skipped ad leaves the reward waiting, so the player can still take the normal one.
  private async claimWithAd(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const watched = await this.actions.watchAd();
    this.busy = false;
    if (watched && this.active) this.claimReward(DAILY.adMultiplier);
  }

  private async saveStreak(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const saved = await this.actions.saveStreak();
    this.busy = false;
    if (!saved || !this.active) return;
    const tile = this.tiles[dailyCycle(this.economy().daily, dayNumber(Date.now())).index];
    audio.play('celebrate');
    sparkle(this.scene, tile.container.x, tile.container.y, PALETTE.saffron, this.fxDepth);
    floatingText(this.scene, this.saverButton.x, this.saverButton.y - 40, t('daily.streakSaved'), PALETTE.success, 44, this.fxDepth);
    this.render();
  }

  private claimReward(multiplier: number): void {
    if (this.busy) return;
    const granted = this.actions.claimReward(multiplier);
    if (!granted) return;
    const tile = this.tiles[dailyCycle(this.economy().daily, dayNumber(Date.now())).index];
    this.celebrate(granted, tile.container.x, tile.container.y, true);
  }

  private claimTask(index: number): void {
    const granted = this.actions.claimTask(index);
    if (!granted) return;
    const button = this.rows[index].button;
    this.celebrate(granted, button.x, button.y, false);
  }

  private claimChest(): void {
    const granted = this.actions.claimChest();
    if (!granted) return;
    this.celebrate(granted, this.chestButton.x, this.chestButton.y, true);
  }

  private claimWeeklyTask(index: number): void {
    const granted = this.actions.claimWeeklyTask(index);
    if (!granted) return;
    const button = this.weeklyRows[index].button;
    this.celebrate(granted, button.x, button.y, false);
  }

  private claimWeeklyChest(): void {
    const granted = this.actions.claimWeeklyChest();
    if (!granted) return;
    this.celebrate(granted, this.weeklyChestButton.x, this.weeklyChestButton.y, true);
  }

  private celebrate(granted: GrantedReward, x: number, y: number, big: boolean): void {
    audio.play(big ? 'celebrate' : 'coin');
    sparkle(this.scene, x, y, PALETTE.saffron, this.fxDepth);
    if (big) confetti(this.scene, x, y, this.fxDepth);
    const parts = [granted.money > 0 ? `+${formatNumber(granted.money)}` : '', granted.rush > 0 ? `${ADS.rushMultiplier}x ${tDurationShort(granted.rush)}` : ''];
    floatingText(this.scene, x, y - 40, parts.filter(Boolean).join('  '), PALETTE.saffron, 48, this.fxDepth);
    this.render();
  }
}
