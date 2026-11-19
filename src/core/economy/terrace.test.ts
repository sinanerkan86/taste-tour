import { describe, expect, it } from 'vitest';
import {
  PERK,
  ROOF_BAR,
  SECTION_IDS,
  TERRACE,
  buyRoofBar,
  buyTerraceLevels,
  canBuyRoofBar,
  cityCostScale,
  incomeBreakdown,
  levelCost,
  newEconomy,
  prestige,
  roofBarCost,
  sectionRates,
  specialtyMultiplier,
  throughput,
  seatingSplit,
  terraceBuyPlan,
  terraceCost,
  terraceRate,
} from '.';
import { createSave, parseSave, serializeSave } from '../save';

describe('terrace', () => {
  it('starts closed and changes nothing', () => {
    const state = newEconomy();
    expect(state.terraceLevel).toBe(0);
    expect(state.roofBar).toBe(false);
    expect(terraceRate(state)).toBe(0);
    expect(seatingSplit(state)).toMatchObject({ terrace: 0, terraceShare: 0, billMultiplier: 1 });
  });

  it('opens with a one-time cost in the city scale', () => {
    const state = newEconomy(0, 0, 1);
    expect(terraceCost(state)).toBeCloseTo(TERRACE.unlockCost * cityCostScale(1));
    state.money = terraceCost(state) - 1;
    expect(buyTerraceLevels(state, 1)).toBe(0);
    state.money += 1;
    expect(buyTerraceLevels(state, 'max')).toBe(1);
    expect(state.terraceLevel).toBe(1);
    expect(state.money).toBeCloseTo(0);
  });

  it('levels cost like a section level, with the manager discount', () => {
    const state = newEconomy();
    state.terraceLevel = 5;
    expect(terraceCost(state)).toBeCloseTo(levelCost(TERRACE.baseCost, TERRACE.costGrowth, 5));
    state.perks.manager = 1;
    expect(terraceCost(state)).toBeCloseTo(levelCost(TERRACE.baseCost, TERRACE.costGrowth, 5) * (1 - PERK.managerDiscount));
    expect(terraceBuyPlan(state, 10).levels).toBe(10);
  });

  it('adds seats to the seating rate and raises the bill by the terrace share', () => {
    const state = newEconomy();
    for (const id of SECTION_IDS) state.sectionLevels[id] = 10;
    state.sectionLevels.seating = 30;
    const indoor = sectionRates(state).seating;
    const perCustomer = () => incomeBreakdown(state).dineIn / (throughput(state).customersPerSecond * specialtyMultiplier(state));
    const before = perCustomer();
    state.terraceLevel = 10;
    const split = seatingSplit(state);
    expect(split.indoor).toBeCloseTo(indoor);
    expect(sectionRates(state).seating).toBeCloseTo(indoor + split.terrace);
    expect(split.terraceShare).toBeCloseTo(split.terrace / (indoor + split.terrace));
    expect(split.billMultiplier).toBeCloseTo(1 + split.terraceShare * TERRACE.billBonus);
    // Every customer pays more by the terrace share.
    expect(perCustomer()).toBeCloseTo(before * split.billMultiplier);
  });

  it('offers the roof bar once the terrace is big enough', () => {
    const state = newEconomy();
    state.terraceLevel = ROOF_BAR.minTerraceLevel - 1;
    state.money = 1e30;
    expect(canBuyRoofBar(state)).toBe(false);
    expect(buyRoofBar(state)).toBe(false);
    state.terraceLevel = ROOF_BAR.minTerraceLevel;
    const rate = terraceRate(state);
    expect(buyRoofBar(state)).toBe(true);
    expect(state.roofBar).toBe(true);
    expect(terraceRate(state)).toBeCloseTo(rate * ROOF_BAR.rateMultiplier);
    expect(roofBarCost(state)).toBe(Infinity);
    expect(buyRoofBar(state)).toBe(false);
    const split = seatingSplit(state);
    expect(split.billMultiplier).toBeCloseTo(1 + split.terraceShare * (TERRACE.billBonus + ROOF_BAR.extraBillBonus));
  });

  it('starts over with a franchise', () => {
    const state = newEconomy();
    state.terraceLevel = 30;
    state.roofBar = true;
    const next = prestige(state);
    expect(next.terraceLevel).toBe(0);
    expect(next.roofBar).toBe(false);
  });

  it('is kept in the save and repaired', () => {
    const state = newEconomy();
    state.terraceLevel = 27;
    state.roofBar = true;
    const loaded = parseSave(serializeSave(createSave(state, 0)))?.economy;
    expect(loaded?.terraceLevel).toBe(27);
    expect(loaded?.roofBar).toBe(true);
    const old = JSON.parse(serializeSave(createSave(state, 0)));
    delete old.economy.terraceLevel;
    const repaired = parseSave(JSON.stringify(old))?.economy;
    expect(repaired?.terraceLevel).toBe(0);
    expect(repaired?.roofBar).toBe(false);
  });
});
