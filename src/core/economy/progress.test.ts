import { describe, expect, it } from 'vitest';
import {
  ADS,
  LAB,
  OFFLINE,
  PERK,
  PERK_IDS,
  PRESTIGE,
  RESEARCH,
  SECTION_IDS,
  activateRush,
  advanceTime,
  baseIncomePerSecond,
  canStartResearch,
  collectResearch,
  finishedResearch,
  freeLabSlots,
  labNeedsAttention,
  managerBuy,
  newEconomy,
  nextVipGap,
  offlineCapSeconds,
  pendingStars,
  perkOffers,
  prestige,
  researchDuration,
  sectionUpgradeCost,
  startResearch,
  throughput,
  vipTip,
} from './index';
import { createSave, offlineReward, parseSave, serializeSave } from '../save';

describe('kitchen lab', () => {
  it('runs one project at a time on real time and waits to be collected', () => {
    const state = newEconomy();
    expect(labNeedsAttention(state)).toBe(true);
    expect(startResearch(state, 'spices')).toBe(true);
    expect(canStartResearch(state, 'suppliers')).toBe(false);
    expect(labNeedsAttention(state)).toBe(false);
    advanceTime(state, RESEARCH.spices.durations[0] - 1);
    expect(collectResearch(state, 'spices')).toBe(false);
    advanceTime(state, 1);
    expect(finishedResearch(state)).toEqual(['spices']);
    expect(labNeedsAttention(state)).toBe(true);
    const before = baseIncomePerSecond(state);
    expect(collectResearch(state, 'spices')).toBe(true);
    expect(state.lab.levels.spices).toBe(1);
    expect(freeLabSlots(state)).toBe(1);
    expect(baseIncomePerSecond(state)).toBeCloseTo(before * (1 + LAB.spicesIncome));
  });

  it('makes each next level take longer and stops at the max level', () => {
    const state = newEconomy();
    expect(researchDuration(state, 'eventPlanner')).toBe(RESEARCH.eventPlanner.durations[0]);
    state.lab.levels.eventPlanner = RESEARCH.eventPlanner.durations.length;
    expect(researchDuration(state, 'eventPlanner')).toBe(Infinity);
    expect(startResearch(state, 'eventPlanner')).toBe(false);
  });

  it('applies the research bonuses', () => {
    const state = newEconomy();
    const cost = sectionUpgradeCost(state, 'kitchen');
    const tip = vipTip(state);
    state.lab.levels.suppliers = 2;
    state.lab.levels.nightShift = 3;
    state.lab.levels.tourGuide = 1;
    state.lab.levels.eventPlanner = 1;
    expect(sectionUpgradeCost(state, 'kitchen')).toBeCloseTo(cost * (1 - LAB.suppliersDiscount) ** 2);
    expect(offlineCapSeconds(state)).toBe(OFFLINE.baseCapSeconds + 3 * LAB.nightShiftSeconds);
    expect(offlineReward(state, 0, 1e9).capSeconds).toBe(offlineCapSeconds(state));
    expect(vipTip(state)).toBeCloseTo(tip * (1 + LAB.tourGuideTip));
    expect(nextVipGap(0, state)).toBeCloseTo(ADS.vipMinGapSeconds * (1 - LAB.tourGuideSooner));
    activateRush(state);
    expect(state.rushSeconds).toBe(ADS.rushSeconds + LAB.eventPlannerSeconds);
  });

  it('keeps research and running projects across a franchise and a save', () => {
    const state = newEconomy();
    state.lab.levels.spices = 2;
    startResearch(state, 'suppliers');
    state.runReputation = PRESTIGE.starDivisor * 1000;
    const next = prestige(state);
    expect(next.lab.levels.spices).toBe(2);
    expect(next.lab.slots).toEqual(state.lab.slots);
    const loaded = parseSave(serializeSave(createSave(next, 0)))!.economy;
    expect(loaded.lab).toEqual(next.lab);
  });

  it('drops broken lab and perk data from a save', () => {
    const json = JSON.stringify({
      economy: {
        lab: {
          levels: { spices: 99, suppliers: -3 },
          slots: [
            { research: 'spices', remaining: 5 },
            { research: 'nope', remaining: 5 },
            { research: 'tourGuide', remaining: 'x' },
          ],
        },
        perks: { chain: 4, manager: 7, secondLab: 'yes' },
      },
    });
    const economy = parseSave(json)!.economy;
    expect(economy.lab.levels.spices).toBe(RESEARCH.spices.durations.length);
    expect(economy.lab.levels.suppliers).toBe(0);
    // Spices is maxed, the unknown id is dropped, and only one slot is allowed.
    expect(economy.lab.slots).toEqual([{ research: 'tourGuide', remaining: 0 }]);
    expect(economy.perks.chain).toBe(4);
    expect(economy.perks.manager).toBe(1);
    expect(economy.perks.secondLab).toBe(0);
  });
});

describe('franchise perks', () => {
  it('offers the manager first, then a stable mix of perks that are not maxed', () => {
    const state = newEconomy();
    expect(perkOffers(state)).toEqual(PERK.firstOffers);
    state.perks.manager = 1;
    state.city = 1;
    const offers = perkOffers(state);
    expect(offers).toHaveLength(PERK.offers);
    expect(offers).not.toContain('manager');
    expect(new Set(offers).size).toBe(offers.length);
    expect(perkOffers(state)).toEqual(offers);
    expect(offers.every((id) => PERK_IDS.includes(id))).toBe(true);
  });

  it('adds the picked perk at a franchise', () => {
    const state = newEconomy();
    state.runReputation = PRESTIGE.starDivisor * 1000;
    const next = prestige(state, 'headStart');
    expect(next.perks.headStart).toBe(1);
    for (const id of SECTION_IDS) expect(next.sectionLevels[id]).toBe(PERK.headStartLevels[0]);
    // Maxed perks do not grow further.
    next.perks.manager = 1;
    next.runReputation = PRESTIGE.starDivisor * 1000;
    expect(prestige(next, 'manager').perks.manager).toBe(1);
  });

  it('raises income, stars and research speed', () => {
    const state = newEconomy();
    const income = baseIncomePerSecond(state);
    state.runReputation = PRESTIGE.starDivisor * 1000;
    expect(pendingStars(state)).toBe(10);
    state.perks.chain = 2;
    state.perks.brand = 1;
    state.perks.grant = 2;
    state.perks.secondLab = 1;
    expect(baseIncomePerSecond(state)).toBeCloseTo(income * (1 + 2 * PERK.chainIncome));
    expect(pendingStars(state)).toBe(Math.floor(10 * (1 + PERK.brandStars)));
    expect(researchDuration(state, 'spices')).toBeCloseTo(RESEARCH.spices.durations[0] / (1 + 2 * PERK.grantSpeed));
    expect(startResearch(state, 'spices')).toBe(true);
    expect(startResearch(state, 'suppliers')).toBe(true);
    expect(freeLabSlots(state)).toBe(0);
  });

  it('lets the manager buy only cheap bottleneck levels', () => {
    const state = newEconomy();
    state.money = 1e6;
    expect(managerBuy(state)).toEqual([]);
    state.perks.manager = 1;
    const budget = baseIncomePerSecond(state) * PERK.managerSeconds;
    const bought = managerBuy(state);
    expect(bought.length).toBeGreaterThan(0);
    expect(bought[0]).toBe(throughput(newEconomy()).bottleneck);
    // Whatever is left costs more than the budget the manager had.
    expect(sectionUpgradeCost(state, throughput(state).bottleneck)).toBeGreaterThan(budget);
  });
});
