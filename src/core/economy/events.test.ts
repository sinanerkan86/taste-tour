import { describe, expect, it } from 'vitest';
import {
  ADS,
  DAILY,
  EVENTS,
  baseIncomePerSecond,
  busCombo,
  busTip,
  buySectionLevels,
  claimDailyReward,
  criticProgress,
  criticTarget,
  earningsOver,
  festivalBonusPerSecond,
  grantReview,
  incomePerSecond,
  newEconomy,
  nextEventGap,
  passTime,
  pickEvent,
  pickFestivalDish,
  throughput,
} from './index';
import { createSave, parseSave, serializeSave } from '../save';

// A restaurant whose next upgrades cost far more than it has or earns soon.
function broke() {
  const state = newEconomy();
  for (const id of Object.keys(state.sectionLevels) as (keyof typeof state.sectionLevels)[]) state.sectionLevels[id] = 300;
  return state;
}

describe('food critic', () => {
  it('asks for a reachable step up, and none without money', () => {
    expect(criticTarget(broke())).toBeNull();
    const state = newEconomy();
    state.money = 500;
    const start = throughput(state).customersPerSecond;
    const target = criticTarget(state)!;
    expect(target).toBeGreaterThanOrEqual(start * EVENTS.critic.minGain);
    expect(target).toBeLessThanOrEqual(start * EVENTS.critic.maxGain + 1e-9);
    // Spending on the bottleneck reaches it.
    for (let i = 0; i < 100 && throughput(state).customersPerSecond < target; i++) {
      buySectionLevels(state, throughput(state).bottleneck, 1);
    }
    expect(throughput(state).customersPerSecond).toBeGreaterThanOrEqual(target);
    expect(criticProgress(state, start, target)).toBe(1);
  });

  it('a good review boosts income and keeps counting offline only for its own length', () => {
    const state = newEconomy();
    const base = baseIncomePerSecond(state);
    grantReview(state);
    expect(incomePerSecond(state)).toBeCloseTo(base * EVENTS.critic.reviewMultiplier);
    const review = EVENTS.critic.reviewSeconds;
    expect(earningsOver(state, 2 * review)).toBeCloseTo(base * (2 * review + review * (EVENTS.critic.reviewMultiplier - 1)));
    passTime(state, review);
    expect(incomePerSecond(state)).toBeCloseTo(base);
  });

  it('stacks with Rush where both run', () => {
    const state = newEconomy();
    const base = baseIncomePerSecond(state);
    state.rushSeconds = 100;
    state.reviewSeconds = 50;
    const r = ADS.rushMultiplier;
    const v = EVENTS.critic.reviewMultiplier;
    expect(earningsOver(state, 200)).toBeCloseTo(base * (50 * r * v + 50 * r + 100));
  });

  it('keeps the review in the save', () => {
    const state = newEconomy();
    grantReview(state);
    expect(parseSave(serializeSave(createSave(state, 0)))!.economy.reviewSeconds).toBe(EVENTS.critic.reviewSeconds);
  });
});

describe('tour bus', () => {
  it('builds a combo with taps, up to the max', () => {
    expect(busCombo(1)).toBe(1);
    expect(busCombo(EVENTS.tourBus.comboTaps)).toBe(1);
    expect(busCombo(EVENTS.tourBus.comboTaps + 1)).toBe(2);
    expect(busCombo(1000)).toBe(EVENTS.tourBus.maxCombo);
    const state = newEconomy();
    expect(busTip(state, 3)).toBeCloseTo(baseIncomePerSecond(state) * EVENTS.tourBus.tipSeconds * 3);
  });
});

describe('festival', () => {
  it('celebrates a dish on the menu and adds its extra price per customer', () => {
    const state = newEconomy();
    const dish = pickFestivalDish(state, 0.99);
    expect(state.dishLevels[dish]).toBeGreaterThan(0);
    const extra = festivalBonusPerSecond(state, dish);
    expect(extra).toBeGreaterThan(0);
    expect(festivalBonusPerSecond(state, state.dishLevels.length - 1)).toBe(0);
  });
});

describe('event schedule', () => {
  it('spaces events and never repeats one, skipping the critic when nothing is reachable', () => {
    expect(nextEventGap(0)).toBe(EVENTS.minGapSeconds);
    expect(nextEventGap(0.999)).toBeLessThan(EVENTS.maxGapSeconds);
    const poor = broke();
    for (let i = 0; i < 10; i++) {
      const kind = pickEvent(poor, i / 10, 'festival');
      expect(kind).toBe('tourBus');
    }
    const rich = newEconomy();
    rich.money = 1000;
    const kinds = new Set(Array.from({ length: 10 }, (_, i) => pickEvent(rich, i / 10, null)));
    expect(kinds).toEqual(new Set(['critic', 'tourBus', 'festival']));
  });
});

describe('daily reward with an ad', () => {
  it('pays double', () => {
    const state = newEconomy();
    const granted = claimDailyReward(state, 100, DAILY.adMultiplier);
    expect(granted?.money).toBeCloseTo(DAILY.rewards[0].money! * baseIncomePerSecond(state) * DAILY.adMultiplier);
  });
});
