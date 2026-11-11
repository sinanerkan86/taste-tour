import { describe, expect, it } from 'vitest';
import {
  DAILY,
  baseIncomePerSecond,
  chestReady,
  claimChest,
  claimDailyReward,
  claimTask,
  dailyCycle,
  dailyNeedsAttention,
  dailyRewardReady,
  dayNumber,
  newEconomy,
  prestige,
  recordTask,
  refreshDaily,
  rollTasks,
  WEEKLY,
  claimWeeklyChest,
  claimWeeklyTask,
  saveStreak,
  secondsToNextDay,
  secondsToNextWeek,
  streakSaveable,
  weekNumber,
  weeklyChestReady,
  type EconomyState,
} from './index';
import { createSave, parseSave, serializeSave } from '../save';

const DAY = 20_400;

function economy(): EconomyState {
  const state = newEconomy();
  state.money = 0;
  return state;
}

describe('day numbers', () => {
  it('counts local calendar days', () => {
    const evening = new Date(2026, 10, 7, 23, 59).getTime();
    const morning = new Date(2026, 10, 8, 0, 1).getTime();
    expect(dayNumber(morning) - dayNumber(evening)).toBe(1);
    expect(dayNumber(new Date(2026, 10, 7, 0, 0).getTime())).toBe(dayNumber(evening));
    expect(secondsToNextDay(new Date(2026, 10, 7, 23, 0).getTime())).toBe(3600);
  });
});

describe('daily reward', () => {
  it('pays once a day and grows the streak on consecutive days', () => {
    const state = economy();
    const income = baseIncomePerSecond(state);
    expect(dailyCycle(state.daily, DAY)).toEqual({ index: 0, claimed: false });
    const first = claimDailyReward(state, DAY);
    expect(first?.money).toBeCloseTo(DAILY.rewards[0].money! * income);
    expect(claimDailyReward(state, DAY)).toBeNull();
    expect(dailyCycle(state.daily, DAY)).toEqual({ index: 0, claimed: true });
    expect(dailyRewardReady(state.daily, DAY + 1)).toBe(true);
    claimDailyReward(state, DAY + 1);
    expect(state.daily.streak).toBe(2);
  });

  it('starts over at day 1 after a missed day, and loops after day 7', () => {
    const state = economy();
    claimDailyReward(state, DAY);
    claimDailyReward(state, DAY + 2);
    expect(state.daily.streak).toBe(1);
    for (let d = 3; d < 9; d++) claimDailyReward(state, DAY + d);
    expect(state.daily.streak).toBe(7);
    expect(dailyCycle(state.daily, DAY + 9).index).toBe(0);
  });

  it('gives Rush time up to the cap', () => {
    const state = economy();
    const reward = DAILY.rewards.findIndex((r) => r.rush && !r.money);
    state.daily.streak = reward;
    state.daily.lastClaimDay = DAY - 1;
    const granted = claimDailyReward(state, DAY);
    expect(granted?.rush).toBe(DAILY.rewards[reward].rush);
    expect(state.rushSeconds).toBe(DAILY.rewards[reward].rush);
  });
});

describe('daily tasks', () => {
  it('rolls three different tasks, the same ones for the same day', () => {
    const state = economy();
    const tasks = rollTasks(state, DAY);
    expect(tasks).toHaveLength(3);
    expect(new Set(tasks.map((t) => t.kind)).size).toBe(3);
    expect(rollTasks(state, DAY)).toEqual(tasks);
    const days = Array.from({ length: 10 }, (_, i) => rollTasks(state, DAY + i).map((t) => t.kind).join());
    expect(new Set(days).size).toBeGreaterThan(3);
  });

  it('leaves out research once the lab is finished', () => {
    const state = economy();
    for (const id of Object.keys(state.lab.levels) as (keyof typeof state.lab.levels)[]) state.lab.levels[id] = 99;
    for (let d = 0; d < 30; d++) expect(rollTasks(state, DAY + d).some((t) => t.kind === 'research')).toBe(false);
  });

  it('counts progress, pays each task once and then opens the chest', () => {
    const state = economy();
    refreshDaily(state, DAY);
    // Weekly tasks of the same kinds would fill up too; they have their own tests.
    state.daily.weeklyTasks = [];
    expect(dailyNeedsAttention(state.daily, DAY)).toBe(true);
    claimDailyReward(state, DAY);
    expect(dailyNeedsAttention(state.daily, DAY)).toBe(false);
    state.daily.tasks.forEach((task, i) => {
      expect(claimTask(state, i)).toBeNull();
      const finished = recordTask(state, task.kind, task.target + 5);
      expect(finished).toContain(task);
      expect(task.progress).toBe(task.target);
      expect(dailyNeedsAttention(state.daily, DAY)).toBe(true);
      expect(claimTask(state, i)?.money).toBeGreaterThan(0);
      expect(claimTask(state, i)).toBeNull();
    });
    expect(chestReady(state.daily)).toBe(true);
    expect(claimChest(state)?.rush).toBe(DAILY.chest.rush);
    expect(claimChest(state)).toBeNull();
    expect(dailyNeedsAttention(state.daily, DAY)).toBe(false);
  });

  it('rolls new tasks on a new day only', () => {
    const state = economy();
    expect(refreshDaily(state, DAY)).toBe(true);
    recordTask(state, state.daily.tasks[0].kind, 1);
    expect(refreshDaily(state, DAY)).toBe(false);
    expect(state.daily.tasks[0].progress).toBe(1);
    expect(refreshDaily(state, DAY + 1)).toBe(true);
    expect(state.daily.tasks.every((t) => t.progress === 0)).toBe(true);
  });
});

describe('weekly tasks', () => {
  it('start on Monday', () => {
    const sunday = dayNumber(new Date(2026, 10, 8, 12).getTime());
    const monday = dayNumber(new Date(2026, 10, 9, 12).getTime());
    expect(weekNumber(monday) - weekNumber(sunday)).toBe(1);
    expect(weekNumber(monday + 6)).toBe(weekNumber(monday));
    expect(secondsToNextWeek(new Date(2026, 10, 15, 23, 0).getTime())).toBe(3600);
    expect(secondsToNextWeek(new Date(2026, 10, 9, 0, 0).getTime())).toBe(7 * 24 * 3600);
  });

  it('roll once a week, count with daily progress and open a chest', () => {
    const state = economy();
    refreshDaily(state, DAY);
    const tasks = state.daily.weeklyTasks;
    expect(tasks).toHaveLength(WEEKLY.taskCount);
    expect(new Set(tasks.map((task) => task.kind)).size).toBe(WEEKLY.taskCount);
    recordTask(state, tasks[0].kind, 1);
    // A new day keeps the week.
    refreshDaily(state, DAY + 1);
    expect(state.daily.weeklyTasks[0].progress).toBe(1);
    for (const [i, task] of state.daily.weeklyTasks.entries()) {
      expect(claimWeeklyTask(state, i)).toBeNull();
      recordTask(state, task.kind, task.target);
      expect(dailyNeedsAttention(state.daily, DAY + 1)).toBe(true);
      expect(claimWeeklyTask(state, i)?.cards).toBe(WEEKLY.taskReward.cards);
    }
    expect(weeklyChestReady(state.daily)).toBe(true);
    expect(claimWeeklyChest(state)?.cards).toBe(WEEKLY.chest.cards);
    expect(claimWeeklyChest(state)).toBeNull();
    // Next week brings new ones.
    expect(refreshDaily(state, DAY + 8)).toBe(true);
    expect(state.daily.weeklyChestClaimed).toBe(false);
    expect(state.daily.weeklyTasks.every((task) => task.progress === 0)).toBe(true);
  });

  it('count opened daily chests', () => {
    const state = economy();
    refreshDaily(state, DAY);
    state.daily.weeklyTasks = [{ kind: 'chests', target: 2, progress: 1, claimed: false }];
    state.daily.tasks.forEach((task) => {
      task.progress = task.target;
      task.claimed = true;
    });
    expect(claimChest(state)?.finished).toEqual(state.daily.weeklyTasks);
    expect(state.daily.weeklyTasks[0].progress).toBe(2);
  });
});

describe('streak saver', () => {
  it('saves a streak broken by one missed day, once a week', () => {
    const state = economy();
    claimDailyReward(state, DAY);
    claimDailyReward(state, DAY + 1);
    expect(state.daily.streak).toBe(2);
    // Missed DAY + 2.
    expect(streakSaveable(state.daily, DAY + 3)).toBe(true);
    expect(saveStreak(state, DAY + 3)).toBe(true);
    expect(dailyRewardReady(state.daily, DAY + 3)).toBe(true);
    claimDailyReward(state, DAY + 3);
    expect(state.daily.streak).toBe(3);
    // Another miss in the same week cannot be saved.
    const sameWeek = weekNumber(DAY + 5) === weekNumber(DAY + 3);
    expect(streakSaveable(state.daily, DAY + 5)).toBe(!sameWeek);
  });

  it('does not save short streaks or longer breaks', () => {
    const state = economy();
    claimDailyReward(state, DAY);
    expect(streakSaveable(state.daily, DAY + 2)).toBe(false);
    claimDailyReward(state, DAY + 1);
    expect(streakSaveable(state.daily, DAY + 4)).toBe(false);
    expect(saveStreak(state, DAY + 4)).toBe(false);
  });
});

describe('daily state keeps', () => {
  it('through a franchise and a save', () => {
    const state = economy();
    refreshDaily(state, DAY);
    claimDailyReward(state, DAY);
    recordTask(state, state.daily.tasks[1].kind, 3);
    state.dishLevels = state.dishLevels.map(() => 1);
    state.runReputation = 1e12;
    const next = prestige(state);
    expect(next.daily).toEqual(state.daily);
    const loaded = parseSave(serializeSave(createSave(next, 0)))!;
    expect(loaded.economy.daily).toEqual(state.daily);
  });

  it('repairs a broken daily section', () => {
    const raw = JSON.parse(serializeSave(createSave(newEconomy(), 0)));
    raw.economy.daily = { tasks: [{ kind: 'nope', target: 5 }], streak: -3, taskDay: DAY };
    const daily = parseSave(JSON.stringify(raw))!.economy.daily;
    expect(daily.streak).toBe(0);
    expect(daily.taskDay).toBe(-1);
  });
});
