import { describe, expect, it } from 'vitest';
import {
  PARKING,
  PERK,
  SECTION_IDS,
  VALET,
  arrivals,
  buyParkingLevels,
  buyValet,
  canBuyValet,
  cityCostScale,
  incomeBreakdown,
  levelCost,
  newEconomy,
  parkingBuyPlan,
  parkingCost,
  parkingRate,
  prestige,
  sectionRates,
  valetCost,
} from '.';
import { createSave, parseSave, serializeSave } from '../save';

describe('parking', () => {
  it('starts without a lot', () => {
    const state = newEconomy();
    expect(state.parkingLevel).toBe(0);
    expect(parkingRate(state)).toBe(0);
    expect(arrivals(state)).toMatchObject({ parking: 0, carShare: 0, billMultiplier: 1 });
  });

  it('opens with a one-time cost in the city scale', () => {
    const state = newEconomy(0, 0, 1);
    expect(parkingCost(state)).toBeCloseTo(PARKING.unlockCost * cityCostScale(1));
    state.money = parkingCost(state) - 1;
    expect(buyParkingLevels(state, 1)).toBe(0);
    state.money += 1;
    expect(buyParkingLevels(state, 'max')).toBe(1);
    expect(state.parkingLevel).toBe(1);
    expect(state.money).toBeCloseTo(0);
  });

  it('levels cost like a section level, with the manager discount', () => {
    const state = newEconomy();
    state.parkingLevel = 5;
    expect(parkingCost(state)).toBeCloseTo(levelCost(PARKING.baseCost, PARKING.costGrowth, 5));
    state.perks.manager = 1;
    expect(parkingCost(state)).toBeCloseTo(levelCost(PARKING.baseCost, PARKING.costGrowth, 5) * (1 - PERK.managerDiscount));
    expect(parkingBuyPlan(state, 10).levels).toBe(10);
  });

  it('adds drivers to the entrance and raises the bill by the share of cars', () => {
    const state = newEconomy();
    for (const id of SECTION_IDS) state.sectionLevels[id] = 10;
    state.sectionLevels.entrance = 20;
    const walkIn = sectionRates(state).entrance;
    const before = incomeBreakdown(state).dineIn;
    state.parkingLevel = 10;
    const a = arrivals(state);
    expect(a.walkIn).toBeCloseTo(walkIn);
    expect(sectionRates(state).entrance).toBeCloseTo(walkIn + a.parking);
    expect(a.carShare).toBeCloseTo(a.parking / (walkIn + a.parking));
    expect(a.billMultiplier).toBeCloseTo(1 + a.carShare * PARKING.carBillBonus);
    // The entrance was not the bottleneck, so only the bill grows.
    expect(incomeBreakdown(state).dineIn).toBeCloseTo(before * a.billMultiplier);
  });

  it('offers valet service once the lot is big enough', () => {
    const state = newEconomy();
    state.parkingLevel = VALET.minParkingLevel - 1;
    state.money = 1e30;
    expect(canBuyValet(state)).toBe(false);
    expect(buyValet(state)).toBe(false);
    state.parkingLevel = VALET.minParkingLevel;
    const rate = parkingRate(state);
    expect(buyValet(state)).toBe(true);
    expect(state.valet).toBe(true);
    expect(parkingRate(state)).toBeCloseTo(rate * VALET.rateMultiplier);
    expect(valetCost(state)).toBe(Infinity);
    expect(buyValet(state)).toBe(false);
    const a = arrivals(state);
    expect(a.billMultiplier).toBeCloseTo(1 + a.carShare * (PARKING.carBillBonus + VALET.extraBillBonus));
  });

  it('starts over with a franchise', () => {
    const state = newEconomy();
    state.parkingLevel = 30;
    state.valet = true;
    const next = prestige(state);
    expect(next.parkingLevel).toBe(0);
    expect(next.valet).toBe(false);
  });

  it('is kept in the save and repaired', () => {
    const state = newEconomy();
    state.parkingLevel = 27;
    state.valet = true;
    const loaded = parseSave(serializeSave(createSave(state, 0)))?.economy;
    expect(loaded?.parkingLevel).toBe(27);
    expect(loaded?.valet).toBe(true);
    const old = JSON.parse(serializeSave(createSave(state, 0)));
    delete old.economy.parkingLevel;
    const repaired = parseSave(JSON.stringify(old))?.economy;
    expect(repaired?.parkingLevel).toBe(0);
    expect(repaired?.valet).toBe(false);
  });
});
