import { describe, expect, it } from 'vitest';
import { newEconomy, sectionUpgradeCost, upgradeHints } from '.';

describe('upgrade hints', () => {
  it('shows nothing without money', () => {
    const state = newEconomy();
    state.money = 0;
    expect(upgradeHints(state).size).toBe(0);
  });

  it('gives no hint for a plain next level', () => {
    const state = newEconomy();
    state.money = sectionUpgradeCost(state, 'seating') * 1.5;
    expect(upgradeHints(state).has('seating')).toBe(false);
  });

  it('hints a section when the money reaches its next milestone', () => {
    const state = newEconomy();
    state.sectionLevels.kitchen = 9;
    state.money = sectionUpgradeCost(state, 'kitchen') * 1.2;
    expect(upgradeHints(state).has('kitchen')).toBe(true);
  });

  it('hints one-time buys and stays quiet when out of money', () => {
    const state = newEconomy();
    state.money = 1e30;
    const rich = upgradeHints(state);
    for (const id of ['parking', 'busStop', 'terrace', 'delivery', 'safe'] as const) expect(rich.has(id)).toBe(true);
    state.money = 1;
    expect(upgradeHints(state).has('parking')).toBe(false);
  });
});
