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
  secondsToNextDay,
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
