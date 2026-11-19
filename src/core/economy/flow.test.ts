import { describe, expect, it } from 'vitest';
import {
  FLOW,
  SECTION_IDS,
  SPECIALTIES,
  advanceTime,
  baseIncomePerSecond,
  buzzGapFactor,
  criticTarget,
  incomeBreakdown,
  incomePerSecond,
  newEconomy,
  nextVipGap,
  reviewDuration,
  reviewLengthFactor,
  sectionLoad,
  sectionRates,
  softFlow,
  specialties,
  specialtyMultiplier,
  throughput,
  type EconomyState,
  type SectionId,
} from '.';
import { createSave, parseSave, serializeSave } from '../save';

function withLevels(levels: Partial<Record<SectionId, number>>): EconomyState {
  const state = newEconomy();
  for (const id of SECTION_IDS) state.sectionLevels[id] = 20;
  Object.assign(state.sectionLevels, levels);
  return state;
}

describe('soft flow', () => {
  it('equals the rate when all sections are equal', () => {
    const rates = Object.fromEntries(SECTION_IDS.map((id) => [id, 0.7])) as Record<SectionId, number>;
    expect(softFlow(rates)).toBeCloseTo(0.7);
  });

  it('is zero when a section has no capacity', () => {
    const rates = Object.fromEntries(SECTION_IDS.map((id) => [id, 1])) as Record<SectionId, number>;
    rates.cashier = 0;
    expect(softFlow(rates)).toBe(0);
  });

  it('is pulled down hardest by the weakest section', () => {
    const state = withLevels({ kitchen: 1 });
    const rates = sectionRates(state);
    const flow = throughput(state).customersPerSecond;
    const weakest = Math.min(...SECTION_IDS.map((id) => rates[id]));
    expect(throughput(state).bottleneck).toBe('kitchen');
    expect(flow).toBeGreaterThanOrEqual(weakest);
    // However strong the others are, the flow stays within n^(1/p) of the weakest rate.
    expect(flow).toBeLessThanOrEqual(weakest * SECTION_IDS.length ** (1 / FLOW.softness));
  });

  it('raises income with every section upgrade, not only the weakest', () => {
    const base = withLevels({ kitchen: 5 });
    const before = incomePerSecond(base);
    for (const id of SECTION_IDS) {
      const state = withLevels({ kitchen: 5 });
      state.sectionLevels[id]++;
      expect(incomePerSecond(state)).toBeGreaterThan(before);
    }
  });

  it('reports the load of each section, highest for the weakest', () => {
    const state = withLevels({ waiters: 3 });
    const load = sectionLoad(state);
    expect(load.waiters).toBeGreaterThan(1);
    expect(load.kitchen).toBeLessThan(1);
    const busiest = SECTION_IDS.reduce((a, b) => (load[b] > load[a] ? b : a));
    expect(busiest).toBe(throughput(state).bottleneck);
    expect(busiest).toBe('waiters');
  });
});

describe('specialties', () => {
  it('are zero for sections without a surplus', () => {
    const state = withLevels({ waiters: 3 });
    expect(specialties(state).waiters.bonus).toBe(0);
    const equalish = newEconomy();
    for (const id of SECTION_IDS) expect(specialties(equalish)[id].bonus).toBeGreaterThanOrEqual(0);
    expect(Math.min(...SECTION_IDS.map((id) => specialties(equalish)[id].bonus))).toBe(0);
  });

  it('grow with the surplus and stop at the cap', () => {
    const small = withLevels({ kitchen: 30 });
    const big = withLevels({ kitchen: 60 });
    const huge = withLevels({ kitchen: 400 });
    expect(specialties(small).kitchen.bonus).toBeGreaterThan(0);
    expect(specialties(big).kitchen.bonus).toBeGreaterThan(specialties(small).kitchen.bonus);
    expect(specialties(huge).kitchen.bonus).toBe(SPECIALTIES.kitchen.cap);
    expect(specialties(huge).kitchen.cap).toBe(SPECIALTIES.kitchen.cap);
  });

  it('raise dine-in income, and the kitchen also raises the delivery bill', () => {
    const plain = withLevels({});
    const strong = withLevels({ seating: 80 });
    expect(specialtyMultiplier(strong)).toBeGreaterThan(specialtyMultiplier(plain));
    expect(incomeBreakdown(strong).dineIn).toBeGreaterThan(incomeBreakdown(plain).dineIn);

    const delivery = withLevels({ kitchen: 80 });
    delivery.deliveryLevel = 10;
    const noQuality = { ...delivery, sectionLevels: { ...delivery.sectionLevels } };
    const orders = incomeBreakdown(delivery).delivery;
    const quality = 1 + specialties(delivery).kitchen.bonus;
    expect(quality).toBeGreaterThan(1);
    expect(orders / quality).toBeGreaterThan(0);
    expect(incomeBreakdown(noQuality).delivery).toBeCloseTo(orders);
  });

  it('shorten VIP gaps (Buzz) and lengthen a good review (Spotless)', () => {
    const plain = withLevels({ entrance: 20, dishwashing: 20 });
    const buzzing = withLevels({ entrance: 80, dishwashing: 80 });
    expect(buzzGapFactor(buzzing)).toBeGreaterThan(buzzGapFactor(plain));
    expect(nextVipGap(0.5, buzzing)).toBeLessThan(nextVipGap(0.5, plain));
    expect(reviewLengthFactor(buzzing)).toBeGreaterThan(reviewLengthFactor(plain));
    expect(reviewDuration(buzzing)).toBeGreaterThan(reviewDuration(plain));
  });
});

describe('flow with the rest of the economy', () => {
  it('keeps the save shape and offline earnings', () => {
    const state = withLevels({ kitchen: 40 });
    state.money = 123;
    const parsed = parseSave(serializeSave(createSave(state, 0)))!.economy;
    expect(parsed.sectionLevels).toEqual(state.sectionLevels);
    expect(baseIncomePerSecond(parsed)).toBeCloseTo(baseIncomePerSecond(state));
    const before = state.money;
    const earned = advanceTime(state, 100);
    expect(earned).toBeCloseTo(baseIncomePerSecond(withLevels({ kitchen: 40 })) * 100);
    expect(state.money).toBeCloseTo(before + earned);
  });

  it('asks the critic for a target above the current flow', () => {
    const state = withLevels({});
    state.money = 1e12;
    const target = criticTarget(state);
    expect(target).not.toBeNull();
    expect(target!).toBeGreaterThan(throughput(state).customersPerSecond);
  });
});
