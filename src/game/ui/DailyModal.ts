import Phaser from 'phaser';
import {
  ADS,
  DAILY,
  chestReady,
  dailyCycle,
  dailyRewardReady,
  dayNumber,
  rewardValue,
  secondsToNextDay,
  taskDone,
  taskReward,
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
import { ART_RES } from '../view/paint';
import { BUTTON_STYLES, Button } from './Button';
import { createModalCard, modalText } from './modalCard';
import { giftIcon } from './icons';
import { card, outlined, plain, wrapStyle } from './style';

const CARD_WIDTH = 960;
const CARD_HEIGHT = 1500;
const TILE = { width: 118, height: 176, gap: 8 };
const ROW = { width: 880, height: 138, gap: 14 };
const ROW_BUTTON = { width: 230, height: 92 };
const BAR = { width: 470, height: 18 };
const REFRESH_MS = 500;

export interface DailyActions {
  // multiplier is DAILY.adMultiplier after a watched ad.
  claimReward(multiplier: number): GrantedReward | null;
  // Plays the rewarded ad for a double reward; resolves whether it was watched.
  watchAd(): Promise<boolean>;
  claimTask(index: number): GrantedReward | null;
  claimChest(): GrantedReward | null;
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

export function dailyTaskLabel(task: DailyTask): string {
  const target = task.kind === 'playTime' ? tDurationShort(task.target) : formatNumber(task.target, 0);
  return t(`daily.task.${task.kind}` as TranslationKey, { count: target });
}

// Daily rewards (a 7-day streak) on top and today's three tasks plus a chest below.
export class DailyModal extends Phaser.GameObjects.Container {
  private readonly tiles: DayTile[] = [];
  private readonly rows: TaskRow[] = [];
  private readonly claimButton: Button;
  private readonly adButton: Button;
  private busy = false;
  private readonly chestButton: Button;
  private readonly chestText: Phaser.GameObjects.Text;
  private readonly tasksTimer: Phaser.GameObjects.Text;
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
    const { cx, top } = modal;
    const children: Phaser.GameObjects.GameObject[] = [...modal.objects];

    children.push(modalText(scene, modal, CARD_WIDTH, top + 180, t('daily.streakInfo'), 30, PALETTE.muted));

    // Seven day tiles.
    const rowWidth = DAILY.rewards.length * TILE.width + (DAILY.rewards.length - 1) * TILE.gap;
    DAILY.rewards.forEach((reward, i) => {
      const x = cx - rowWidth / 2 + TILE.width / 2 + i * (TILE.width + TILE.gap);
      const tile = this.createTile(scene, x, top + 345, i, reward);
      this.tiles.push(tile);
      children.push(tile.container);
    });
    this.claimButton = new Button(scene, cx, top + 525, 380, 110, () => this.claimReward(1));
    this.adButton = new Button(scene, cx + 205, top + 525, 380, 110, () => void this.claimWithAd(), 'ad');
    this.adButton.setLabel(t('daily.collectMore', { multiplier: DAILY.adMultiplier })).setButtonStyle(BUTTON_STYLES.buy);
    children.push(this.claimButton, this.adButton);

    // Today's tasks.
    const tasksTitle = scene.add.text(cx, top + 650, t('daily.tasksTitle'), outlined(46, { color: PALETTE.cream })).setOrigin(0.5);
    this.tasksTimer = modalText(scene, modal, CARD_WIDTH, top + 705, '', 28, PALETTE.muted);
    children.push(tasksTitle, this.tasksTimer);
    for (let i = 0; i < DAILY.taskRewards.length; i++) {
      const y = top + 820 + i * (ROW.height + ROW.gap);
      const { row, objects } = this.createTaskRow(scene, cx, y, i);
      this.rows.push(row);
      children.push(...objects);
    }

    // The chest for finishing all three.
    const chestY = top + 820 + DAILY.taskRewards.length * (ROW.height + ROW.gap);
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
    children.push(chestBg, gift, this.chestText, this.chestButton);

    const close = new Button(scene, cx, top + CARD_HEIGHT - 80, 320, 90, () => this.destroy());
    close.setLabel(t('settings.close')).setButtonStyle(BUTTON_STYLES.primary);
    children.push(close);

    this.add(children);
    this.setDepth(depth);
    scene.add.existing(this);
    this.render();
    const timer = scene.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.render() });
    this.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
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

  private createTaskRow(scene: Phaser.Scene, cx: number, y: number, index: number) {
    const left = cx - ROW.width / 2;
    const bg = scene.add
      .image(cx, y, card(scene, 'daily-task', ROW.width, ROW.height, { top: 0xfffdf6, bottom: 0xfbe8c8, border: 0xe0c49a }))
      .setScale(1 / ART_RES);
    const label = scene.add
      .text(left + 32, y - 28, '', { ...plain(30, PALETTE.ink, true), wordWrap: wrapStyle(ROW.width - ROW_BUTTON.width - 80) })
      .setOrigin(0, 0.5);
    const track = scene.add.graphics();
    const barY = y + 32;
    track.fillStyle(0x5a3a20, 0.3).fillRoundedRect(left + 30, barY - BAR.height / 2 - 2, BAR.width + 4, BAR.height + 4, 10);
    track.fillStyle(0xe8d8bc, 1).fillRoundedRect(left + 32, barY - BAR.height / 2, BAR.width, BAR.height, 8);
    const fill = scene.add.graphics();
    fill.setPosition(left + 32, barY - BAR.height / 2);
    const count = scene.add.text(left + 32 + BAR.width + 16, barY, '', plain(24, PALETTE.muted, true)).setOrigin(0, 0.5);
    const button = new Button(
      scene,
      cx + ROW.width / 2 - ROW_BUTTON.width / 2 - 20,
      y,
      ROW_BUTTON.width,
      ROW_BUTTON.height,
      () => this.claimTask(index),
      'coin',
    );
    return { row: { label, count, fill, button }, objects: [bg, track, fill, label, count, button] };
  }

  // Redraws everything from the economy (also every half second: tasks progress underneath).
  render(): void {
    if (!this.active) return;
    const state = this.economy();
    const now = Date.now();
    const day = dayNumber(now);
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
      const row = this.rows[i];
      if (!row) return;
      const label = dailyTaskLabel(task);
      if (row.label.text !== label) row.label.setText(label);
      const progress = task.progress / task.target;
      row.fill.clear();
      if (progress > 0) {
        const w = Math.max(BAR.height, BAR.width * progress);
        row.fill.fillStyle(taskDone(task) ? 0x4fb030 : 0xf0a020, 1).fillRoundedRect(0, 0, w, BAR.height, 8);
        row.fill.fillStyle(0xffffff, 0.45).fillRoundedRect(3, 2, Math.max(0, w - 6), BAR.height * 0.35, 3);
      }
      const shown = task.kind === 'playTime' ? `${Math.floor(task.progress / 60)}/${task.target / 60}` : `${Math.floor(task.progress)}/${task.target}`;
      row.count.setText(shown);
      const amount = `+${formatNumber(rewardValue(state, taskReward(i)).money)}`;
      if (task.claimed) row.button.setLabel('✓', false).setButtonStyle(BUTTON_STYLES.disabled, false);
      else if (taskDone(task)) row.button.setLabel(amount).setButtonStyle(BUTTON_STYLES.go);
      else row.button.setLabel(amount).setButtonStyle(BUTTON_STYLES.disabled, false);
    });

    const chest = rewardValue(state, DAILY.chest);
    this.chestText.setText(
      t('daily.chest', {
        amount: formatNumber(chest.money),
        rush: `${ADS.rushMultiplier}x ${tDurationShort(chest.rush)}`,
      }),
    );
    if (state.daily.chestClaimed) this.chestButton.setLabel('✓').setButtonStyle(BUTTON_STYLES.disabled, false);
    else this.chestButton.setLabel(t('daily.open')).setButtonStyle(chestReady(state.daily) ? BUTTON_STYLES.go : BUTTON_STYLES.disabled, chestReady(state.daily));
  }

  // A skipped ad leaves the reward waiting, so the player can still take the normal one.
  private async claimWithAd(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const watched = await this.actions.watchAd();
    this.busy = false;
    if (watched && this.active) this.claimReward(DAILY.adMultiplier);
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

  private celebrate(granted: GrantedReward, x: number, y: number, big: boolean): void {
    audio.play(big ? 'celebrate' : 'coin');
    sparkle(this.scene, x, y, PALETTE.saffron, this.fxDepth);
    if (big) confetti(this.scene, x, y, this.fxDepth);
    const parts = [granted.money > 0 ? `+${formatNumber(granted.money)}` : '', granted.rush > 0 ? `${ADS.rushMultiplier}x ${tDurationShort(granted.rush)}` : ''];
    floatingText(this.scene, x, y - 40, parts.filter(Boolean).join('  '), PALETTE.saffron, 48, this.fxDepth);
    this.render();
  }
}
