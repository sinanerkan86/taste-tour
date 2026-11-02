import { describe, expect, it } from 'vitest';
import {
  DISH_MAX_LEVEL,
  DISHES,
  SECTION_IDS,
  buyDish,
  buySectionLevel,
  dishCost,
  incomePerSecond,
  levelCost,
  milestonesReached,
  newEconomy,
  offlineEarnings,
  pendingStars,
  prestige,
  scaledValue,
  sectionRates,
  sectionUpgradeCost,
  tap,
  throughput,
  totalStarsFor,
  PRESTIGE,
} from '.';

describe('formulas', () => {
  it('counts milestones reached', () => {
    expect(milestonesReached(9)).toBe(0);
    expect(milestonesReached(10)).toBe(1);
    expect(milestonesReached(49)).toBe(2);
    expect(milestonesReached(50)).toBe(3);
  });

  it('scales linearly with level and jumps at milestones', () => {
    expect(scaledValue(2, 0, 2)).toBe(0);
    expect(scaledValue(2, 9, 2)).toBe(18);
    expect(scaledValue(2, 10, 2)).toBe(40);
  });

  it('grows cost geometrically', () => {
    expect(levelCost(10, 1.5, 1)).toBe(10);
    expect(levelCost(10, 1.5, 3)).toBeCloseTo(22.5);
  });

  it('awards stars on the square root of lifetime earnings', () => {
    expect(totalStarsFor(PRESTIGE.starDivisor * 99)).toBe(9);
    expect(totalStarsFor(PRESTIGE.starDivisor * 100)).toBe(10);
  });

  it('caps offline earnings', () => {
    expect(offlineEarnings(5, 100, 60)).toBe(300);
    expect(offlineEarnings(5, -10, 60)).toBe(0);
  });
});

describe('economy state', () => {
  it('starts with every section at level 1 and only the first dish', () => {
    const state = newEconomy();
    expect(SECTION_IDS.every((id) => state.sectionLevels[id] === 1)).toBe(true);
    expect(state.dishLevels).toEqual(DISHES.map((_, i) => (i === 0 ? 1 : 0)));
    expect(incomePerSecond(state)).toBeGreaterThan(0);
  });

  it('is limited by the slowest section', () => {
    const state = newEconomy();
    const rates = sectionRates(state);
    const slowest = Math.min(...SECTION_IDS.map((id) => rates[id]));
    expect(throughput(state).customersPerSecond).toBe(slowest);
    expect(rates[throughput(state).bottleneck]).toBe(slowest);
  });

  it('only raises income when the bottleneck is upgraded', () => {
    const state = newEconomy();
    state.money = 1e9;
    const before = incomePerSecond(state);
    const notBottleneck = SECTION_IDS.find((id) => id !== throughput(state).bottleneck)!;
    buySectionLevel(state, notBottleneck);
    expect(incomePerSecond(state)).toBe(before);
    buySectionLevel(state, throughput(state).bottleneck);
    expect(incomePerSecond(state)).toBeGreaterThan(before);
  });
});

describe('tap', () => {
  it('tips a fraction of one bill, so it matters less as customers speed up', () => {
    const state = newEconomy();
    const tip = tap(state);
    expect(state.money).toBe(tip);
    // At the start a tap is worth about a second of income...
    const early = tip / incomePerSecond(state);
    expect(early).toBeGreaterThanOrEqual(1);
    // ...and much less once customers flow in faster.
    SECTION_IDS.forEach((id) => (state.sectionLevels[id] = 50));
    expect(tap(state) / incomePerSecond(state)).toBeLessThan(early / 50);
  });
});

describe('actions', () => {
  it('refuses purchases the player cannot afford', () => {
    const state = newEconomy();
    expect(buySectionLevel(state, 'entrance')).toBe(false);
    state.money = sectionUpgradeCost(state, 'entrance');
    expect(buySectionLevel(state, 'entrance')).toBe(true);
    expect(state.money).toBe(0);
    expect(state.sectionLevels.entrance).toBe(2);
  });

  it('unlocks dishes strictly in order', () => {
    const state = newEconomy();
    state.money = 1e30;
    expect(buyDish(state, 2)).toBe(false);
    expect(buyDish(state, 1)).toBe(true);
    expect(state.dishLevels[1]).toBe(1);
  });

  it('stops leveling a mastered dish', () => {
    const state = newEconomy();
    state.money = 1e300;
    state.dishLevels[0] = DISH_MAX_LEVEL;
    expect(dishCost(state, 0)).toBe(Infinity);
    expect(buyDish(state, 0)).toBe(false);
  });

  it('keeps stars and lifetime earnings across a franchise', () => {
    const state = newEconomy();
    state.lifetimeEarnings = PRESTIGE.starDivisor * 400;
    expect(pendingStars(state)).toBe(20);
    const next = prestige(state);
    expect(next.stars).toBe(20);
    expect(next.money).toBe(0);
    expect(next.lifetimeEarnings).toBe(state.lifetimeEarnings);
    expect(pendingStars(next)).toBe(0);
    expect(incomePerSecond(next)).toBeCloseTo(incomePerSecond(newEconomy()) * 3);
  });
});
