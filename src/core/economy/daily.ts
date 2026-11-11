import { RESEARCH_IDS } from './config';
import { dailyMoneyMultiplier, researchMaxLevel, rushMaxSeconds } from './bonuses';
import { giveChefCards } from './chefs';
import { baseIncomePerSecond, earn, type EconomyState } from './state';

// Daily rewards, daily tasks and weekly tasks: reasons to open the game every day and to keep
// coming back through the week.
//
// Days are local calendar days (a new day starts at local midnight); weeks start on Monday. Money rewards are counted in
// seconds of the restaurant's income at the moment they are collected, so they stay worth the
// same at every stage of the game and in every city.

const MINUTE = 60;
const HOUR = 60 * MINUTE;

export interface DailyReward {
  // Seconds of income (without Rush).
  money?: number;
  // Seconds of Rush.
  rush?: number;
  // Chef cards (see giveChefCards).
  cards?: number;
}

// 'chests' (daily chests opened) only appears among the weekly tasks.
export const TASK_KINDS = ['upgrades', 'dishLevels', 'taps', 'playTime', 'research', 'vip', 'chests'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
type DailyKind = Exclude<TaskKind, 'chests'>;
const DAILY_KINDS = TASK_KINDS.filter((kind): kind is DailyKind => kind !== 'chests');

export const DAILY = {
  // The 7-day cycle of the streak; day 7 is the big one. Missing a day starts over at day 1.
  rewards: [
    { money: 10 * MINUTE },
    { money: 20 * MINUTE },
    { rush: 1 * HOUR },
    { money: 30 * MINUTE },
    { money: 45 * MINUTE },
    { rush: 2 * HOUR },
    { money: 1 * HOUR, rush: 2 * HOUR },
  ] as DailyReward[],
  // Three tasks a day: easy, medium, hard. Each pays this many seconds of income.
  taskRewards: [10 * MINUTE, 15 * MINUTE, 20 * MINUTE],
  // Targets per difficulty. playTime is in seconds of play with the game open.
  taskTargets: {
    upgrades: [10, 25, 50],
    dishLevels: [10, 25, 50],
    taps: [30, 60, 100],
    playTime: [5 * MINUTE, 10 * MINUTE, 20 * MINUTE],
    research: [1, 1, 1],
    vip: [1, 1, 2],
  } satisfies Record<DailyKind, number[]>,
  // Today's reward can be doubled with a rewarded ad.
  adMultiplier: 2,
  // Finishing all three tasks opens a chest.
  chest: { money: 30 * MINUTE, rush: 1 * HOUR, cards: 2 } as DailyReward,
  // A streak broken by one missed day can be saved once a week (with a rewarded ad), as long as
  // it was at least this long.
  saverMinStreak: 2,
};

// Weekly tasks: three bigger goals from Monday to Sunday, each with its own reward, and a big
// chest for finishing all three. About 15-20 minutes of play a day finishes them.
export const WEEKLY = {
  taskCount: 3,
  targets: {
    upgrades: 150,
    dishLevels: 150,
    taps: 300,
    playTime: 90 * MINUTE,
    research: 4,
    vip: 6,
    chests: 4,
  } satisfies Record<TaskKind, number>,
  taskReward: { money: 1 * HOUR, cards: 1 } as DailyReward,
  chest: { money: 3 * HOUR, rush: 4 * HOUR, cards: 3 } as DailyReward,
};

export interface DailyTask {
  kind: TaskKind;
  target: number;
  progress: number;
  claimed: boolean;
}

export interface DailyState {
  // Daily rewards collected in a row (0 before the first one).
  streak: number;
  // Day number of the last collected reward; -1 if none yet.
  lastClaimDay: number;
  // Day the tasks were rolled for; -1 if never.
  taskDay: number;
  tasks: DailyTask[];
  chestClaimed: boolean;
  // Week the weekly tasks were rolled for; -1 if never.
  week: number;
  weeklyTasks: DailyTask[];
  weeklyChestClaimed: boolean;
  // Week the streak saver was last used; -1 if never.
  saverWeek: number;
}

export function newDaily(): DailyState {
  return {
    streak: 0,
    lastClaimDay: -1,
    taskDay: -1,
    tasks: [],
    chestClaimed: false,
    week: -1,
    weeklyTasks: [],
    weeklyChestClaimed: false,
    saverWeek: -1,
  };
}

// Local calendar day as a whole number (days since 1970-01-01 in local time).
export function dayNumber(now: number): number {
  const date = new Date(now);
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * HOUR * 1000));
}

// Seconds until local midnight, when the next reward and new tasks come.
export function secondsToNextDay(now: number): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, (next.getTime() - now) / 1000);
}

// Week number of a day number; weeks start on Monday (day 0, 1970-01-01, was a Thursday).
export function weekNumber(day: number): number {
  return Math.floor((day + 3) / 7);
}

// Seconds until the next Monday at local midnight, when new weekly tasks come.
export function secondsToNextWeek(now: number): number {
  const next = new Date(now);
  const sinceMonday = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() + 7 - sinceMonday);
  next.setHours(0, 0, 0, 0);
  return Math.max(0, (next.getTime() - now) / 1000);
}

// Small seeded random generator, so a day's tasks are the same however often they are rolled.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The task kinds the player can do right now (no research task once the lab is finished).
function availableKinds<K extends TaskKind>(state: EconomyState, kinds: readonly K[]): K[] {
  const labLeft = RESEARCH_IDS.some((id) => state.lab.levels[id] < researchMaxLevel(id));
  return kinds.filter((kind) => kind !== 'research' || labLeft);
}

export function rollTasks(state: EconomyState, day: number): DailyTask[] {
  const random = seeded(day * 2654435761);
  const kinds = availableKinds(state, DAILY_KINDS);
  const picked: DailyKind[] = [];
  while (picked.length < DAILY.taskRewards.length && kinds.length > 0) {
    picked.push(kinds.splice(Math.floor(random() * kinds.length), 1)[0]);
  }
  return picked.map((kind, difficulty) => ({
    kind,
    target: DAILY.taskTargets[kind][difficulty],
    progress: 0,
    claimed: false,
  }));
}

export function rollWeeklyTasks(state: EconomyState, week: number): DailyTask[] {
  const random = seeded(week * 40503 + 7919);
  const kinds = availableKinds(state, TASK_KINDS);
  const picked: TaskKind[] = [];
  while (picked.length < WEEKLY.taskCount && kinds.length > 0) {
    picked.push(kinds.splice(Math.floor(random() * kinds.length), 1)[0]);
  }
  return picked.map((kind) => ({ kind, target: WEEKLY.targets[kind], progress: 0, claimed: false }));
}

// New day: fresh daily tasks; new week: fresh weekly tasks. Call it often (it does nothing within
// the same day). Returns whether anything changed.
export function refreshDaily(state: EconomyState, day: number): boolean {
  const daily = state.daily;
  let changed = false;
  if (daily.taskDay !== day) {
    daily.taskDay = day;
    daily.tasks = rollTasks(state, day);
    daily.chestClaimed = false;
    changed = true;
  }
  const week = weekNumber(day);
  if (daily.week !== week) {
    daily.week = week;
    daily.weeklyTasks = rollWeeklyTasks(state, week);
    daily.weeklyChestClaimed = false;
    changed = true;
  }
  return changed;
}

export function dailyRewardReady(daily: DailyState, day: number): boolean {
  return day > daily.lastClaimDay;
}

// The streak the next collected reward would make: one more if yesterday's was collected.
function nextStreak(daily: DailyState, day: number): number {
  return daily.lastClaimDay === day - 1 ? daily.streak + 1 : 1;
}

// Where today is in the 7-day cycle (0-6) and whether today's reward is collected.
export function dailyCycle(daily: DailyState, day: number): { index: number; claimed: boolean } {
  const claimed = !dailyRewardReady(daily, day);
  const streak = claimed ? daily.streak : nextStreak(daily, day);
  return { index: (streak - 1) % DAILY.rewards.length, claimed };
}

export interface GrantedReward {
  money: number;
  rush: number;
  cards: number;
}

// Pays a reward (times `multiplier`, 2 after a rewarded ad): money from seconds of income, Rush
// up to the usual cap, chef cards.
export function grantReward(state: EconomyState, reward: DailyReward, multiplier = 1): GrantedReward {
  const money = (reward.money ?? 0) * baseIncomePerSecond(state) * dailyMoneyMultiplier(state) * multiplier;
  if (money > 0) earn(state, money);
  const before = state.rushSeconds;
  if (reward.rush) state.rushSeconds = Math.min(Math.max(before, rushMaxSeconds(state)), before + reward.rush * multiplier);
  const cards = giveChefCards(state, (reward.cards ?? 0) * multiplier);
  return { money, rush: state.rushSeconds - before, cards };
}

// What a reward would pay right now (for display).
export function rewardValue(state: EconomyState, reward: DailyReward): GrantedReward {
  return {
    money: (reward.money ?? 0) * baseIncomePerSecond(state) * dailyMoneyMultiplier(state),
    rush: reward.rush ?? 0,
    cards: reward.cards ?? 0,
  };
}

// A streak broken by exactly one missed day, still worth saving, and the saver not used this week.
export function streakSaveable(daily: DailyState, day: number): boolean {
  return (
    daily.lastClaimDay === day - 2 && daily.streak >= DAILY.saverMinStreak && daily.saverWeek !== weekNumber(day)
  );
}

// Saves the streak (the ad reward): the missed day counts as collected, without its reward.
export function saveStreak(state: EconomyState, day: number): boolean {
  const daily = state.daily;
  if (!streakSaveable(daily, day)) return false;
  daily.lastClaimDay = day - 1;
  daily.saverWeek = weekNumber(day);
  return true;
}

export function claimDailyReward(state: EconomyState, day: number, multiplier = 1): GrantedReward | null {
  const daily = state.daily;
  if (!dailyRewardReady(daily, day)) return null;
  daily.streak = nextStreak(daily, day);
  daily.lastClaimDay = day;
  return grantReward(state, DAILY.rewards[(daily.streak - 1) % DAILY.rewards.length], multiplier);
}

export function taskDone(task: DailyTask): boolean {
  return task.progress >= task.target;
}

// Counts progress on today's and this week's tasks of a kind. Returns the tasks this finished.
export function recordTask(state: EconomyState, kind: TaskKind, amount = 1): DailyTask[] {
  const finished: DailyTask[] = [];
  for (const task of [...state.daily.tasks, ...state.daily.weeklyTasks]) {
    if (task.kind !== kind || taskDone(task)) continue;
    task.progress = Math.min(task.target, task.progress + amount);
    if (taskDone(task)) finished.push(task);
  }
  return finished;
}

export function taskReward(index: number): DailyReward {
  return { money: DAILY.taskRewards[index] };
}

export function claimTask(state: EconomyState, index: number): GrantedReward | null {
  const task = state.daily.tasks[index];
  if (!task || task.claimed || !taskDone(task)) return null;
  task.claimed = true;
  return grantReward(state, taskReward(index));
}

export function chestReady(daily: DailyState): boolean {
  return daily.tasks.length > 0 && !daily.chestClaimed && daily.tasks.every((task) => task.claimed);
}

// Opens today's chest; it also counts for a weekly 'chests' task (returned in `finished`).
export function claimChest(state: EconomyState): (GrantedReward & { finished: DailyTask[] }) | null {
  if (!chestReady(state.daily)) return null;
  state.daily.chestClaimed = true;
  const granted = grantReward(state, DAILY.chest);
  return { ...granted, finished: recordTask(state, 'chests') };
}

export function claimWeeklyTask(state: EconomyState, index: number): GrantedReward | null {
  const task = state.daily.weeklyTasks[index];
  if (!task || task.claimed || !taskDone(task)) return null;
  task.claimed = true;
  return grantReward(state, WEEKLY.taskReward);
}

export function weeklyChestReady(daily: DailyState): boolean {
  return daily.weeklyTasks.length > 0 && !daily.weeklyChestClaimed && daily.weeklyTasks.every((task) => task.claimed);
}

export function claimWeeklyChest(state: EconomyState): GrantedReward | null {
  if (!weeklyChestReady(state.daily)) return null;
  state.daily.weeklyChestClaimed = true;
  return grantReward(state, WEEKLY.chest);
}

// True when a weekly task or the weekly chest waits to be collected.
export function weeklyNeedsAttention(daily: DailyState): boolean {
  return daily.weeklyTasks.some((task) => !task.claimed && taskDone(task)) || weeklyChestReady(daily);
}

// True when something is waiting to be collected (the red "!" on the daily button).
export function dailyNeedsAttention(daily: DailyState, day: number): boolean {
  return (
    dailyRewardReady(daily, day) ||
    daily.tasks.some((task) => !task.claimed && taskDone(task)) ||
    chestReady(daily) ||
    weeklyNeedsAttention(daily)
  );
}
