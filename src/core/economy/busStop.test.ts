import { describe, expect, it } from 'vitest';
import {
  BUS_STOP,
  SECTION_IDS,
  activeIncomePerSecond,
  billPerCustomer,
  busFlow,
  busGroupSize,
  busIncomePerSecond,
  busPayout,
  busStopBuyPlan,
  busStopCost,
  buyBusStopLevels,
  cityCostScale,
  incomePerSecond,
  levelCost,
  newEconomy,
  prestige,
  sectionRates,
  throughput,
  type EconomyState,
} from '.';
import { createSave, parseSave, serializeSave } from '../save';

// A restaurant whose dining room has seats to spare.
function roomyDiningRoom(): EconomyState {
  const state = newEconomy();
  for (const id of SECTION_IDS) state.sectionLevels[id] = 10;
  state.sectionLevels.seating = 40;
  return state;
}

describe('bus stop', () => {
  it('starts without a stop', () => {
    const state = newEconomy();
    expect(state.busStopLevel).toBe(0);
    expect(busGroupSize(state)).toBe(0);
    expect(busPayout(state)).toBe(0);
    expect(activeIncomePerSecond(state)).toBeCloseTo(incomePerSecond(state));
  });

  it('opens with a one-time cost in the city scale, then levels like a section', () => {
    const state = newEconomy(0, 0, 1);
    expect(busStopCost(state)).toBeCloseTo(BUS_STOP.unlockCost * cityCostScale(1));
    state.money = busStopCost(state);
    expect(buyBusStopLevels(state, 'max')).toBe(1);
    expect(state.money).toBeCloseTo(0);
    const fresh = newEconomy();
    fresh.busStopLevel = 4;
    expect(busStopCost(fresh)).toBeCloseTo(levelCost(BUS_STOP.baseCost, BUS_STOP.costGrowth, 4));
    expect(busStopBuyPlan(fresh, 10).levels).toBe(10);
  });

  it('seats riders at the spare tables of the dining room', () => {
    const state = roomyDiningRoom();
    state.busStopLevel = 1;
    const flow = busFlow(state);
    expect(flow.spareSeats).toBeCloseTo(sectionRates(state).seating - throughput(state).customersPerSecond);
    expect(flow).toMatchObject({ ridersPerSecond: BUS_STOP.baseRate, limitedBy: 'buses' });
    expect(busGroupSize(state)).toBeCloseTo(BUS_STOP.baseRate * BUS_STOP.intervalSeconds);
    expect(busPayout(state)).toBeCloseTo(busGroupSize(state) * billPerCustomer(state) * BUS_STOP.billFraction);
    expect(busIncomePerSecond(state) * BUS_STOP.intervalSeconds).toBeCloseTo(busPayout(state));
    state.busStopLevel = 300;
    expect(busFlow(state)).toMatchObject({ ridersPerSecond: flow.spareSeats, limitedBy: 'seats' });
  });

  it('has no seats for riders when the dining room is the bottleneck', () => {
    const state = roomyDiningRoom();
    state.sectionLevels.seating = 5;
    state.busStopLevel = 20;
    expect(busFlow(state)).toMatchObject({ ridersPerSecond: 0, limitedBy: 'seats' });
  });

  it('counts boosts on the payout', () => {
    const state = roomyDiningRoom();
    state.busStopLevel = 3;
    const plain = busPayout(state);
    state.rushSeconds = 100;
    expect(busPayout(state)).toBeCloseTo(plain * 2);
  });

  it('starts over with a franchise and is kept in the save', () => {
    const state = newEconomy();
    state.busStopLevel = 9;
    expect(prestige(state).busStopLevel).toBe(0);
    expect(parseSave(serializeSave(createSave(state, 0)))?.economy.busStopLevel).toBe(9);
    const old = JSON.parse(serializeSave(createSave(state, 0)));
    delete old.economy.busStopLevel;
    expect(parseSave(JSON.stringify(old))?.economy.busStopLevel).toBe(0);
  });
});
