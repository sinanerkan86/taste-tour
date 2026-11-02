import { describe, expect, it } from 'vitest';
import { DISH_TIERS, OFFLINE, incomePerSecond, newEconomy } from './economy';
import { createSave, offlineReward, parseSave, serializeSave } from './save';

describe('save', () => {
  it('round-trips the economy', () => {
    const economy = newEconomy(3, 1e9);
    economy.money = 1234.5;
    economy.sectionLevels.kitchen = 42;
    economy.dishLevels[1] = 7;
    const parsed = parseSave(serializeSave(createSave(economy, 1000, ['bottleneck'])));
    expect(parsed).toEqual(createSave(economy, 1000, ['bottleneck']));
  });

  it('rejects unusable data', () => {
    expect(parseSave('not json')).toBeNull();
    expect(parseSave('42')).toBeNull();
    expect(parseSave('{"version":1}')).toBeNull();
  });

  it('repairs missing or broken fields', () => {
    const parsed = parseSave(
      JSON.stringify({ savedAt: 5, economy: { money: 'lots', sectionLevels: { kitchen: 9 }, dishLevels: [3] } }),
    );
    expect(parsed).not.toBeNull();
    const economy = parsed!.economy;
    expect(economy.money).toBe(0);
    expect(economy.sectionLevels.kitchen).toBe(9);
    expect(economy.sectionLevels.entrance).toBe(1);
    expect(economy.dishLevels).toHaveLength(DISH_TIERS.length);
    expect(economy.dishLevels[0]).toBe(3);
    expect(economy.dishLevels[1]).toBe(0);
    expect(parsed!.seenHints).toEqual([]);
    expect(economy.city).toBe(0);
    expect(economy.runReputation).toBe(0);
  });
});

describe('offlineReward', () => {
  it('pays income for the time away', () => {
    const economy = newEconomy();
    const reward = offlineReward(economy, 0, 60_000);
    expect(reward.seconds).toBe(60);
    expect(reward.amount).toBeCloseTo(incomePerSecond(economy) * 60);
  });

  it('is capped', () => {
    const economy = newEconomy();
    const day = 24 * 3600 * 1000;
    const reward = offlineReward(economy, 0, day);
    expect(reward.secondsAway).toBe(24 * 3600);
    expect(reward.seconds).toBe(OFFLINE.baseCapSeconds);
    expect(reward.amount).toBeCloseTo(incomePerSecond(economy) * OFFLINE.baseCapSeconds);
  });

  it('ignores a clock set backwards', () => {
    expect(offlineReward(newEconomy(), 10_000, 0).amount).toBe(0);
  });
});
