import { describe, expect, it } from 'vitest';
import {
  DELIVERY,
  PERK,
  SECTION_IDS,
  baseIncomePerSecond,
  billPerCustomer,
  buyDeliveryLevels,
  cityCostScale,
  deliveryBuyPlan,
  deliveryCost,
  deliveryFlow,
  incomeBreakdown,
  levelCost,
  newEconomy,
  prestige,
  sectionRates,
  throughput,
  type EconomyState,
} from '.';
import { createSave, parseSave, serializeSave } from '../save';

// A restaurant whose kitchen has room to spare: every other section at level 10, the kitchen at 40.
function roomyKitchen(): EconomyState {
  const state = newEconomy();
  for (const id of SECTION_IDS) state.sectionLevels[id] = 10;
  state.sectionLevels.kitchen = 40;
  return state;
}

describe('delivery', () => {
  it('is closed at the start and earns nothing', () => {
    const state = roomyKitchen();
    expect(state.deliveryLevel).toBe(0);
    expect(deliveryFlow(state).ordersPerSecond).toBe(0);
    expect(incomeBreakdown(state).delivery).toBe(0);
  });

  it('opens with a one-time purchase in the city cost scale', () => {
    const state = newEconomy(0, 0, 1);
    expect(deliveryCost(state)).toBeCloseTo(DELIVERY.unlockCost * cityCostScale(1));
    state.money = deliveryCost(state) - 1;
    expect(buyDeliveryLevels(state, 1)).toBe(0);
    state.money += 1;
    expect(buyDeliveryLevels(state, 'max')).toBe(1);
    expect(state.deliveryLevel).toBe(1);
    expect(state.money).toBeCloseTo(0);
  });

  it('prices courier levels like a section, with the manager discount', () => {
    const state = newEconomy();
    state.deliveryLevel = 5;
    expect(deliveryCost(state)).toBeCloseTo(levelCost(DELIVERY.baseCost, DELIVERY.costGrowth, 5));
    state.perks.manager = 1;
    expect(deliveryCost(state)).toBeCloseTo(levelCost(DELIVERY.baseCost, DELIVERY.costGrowth, 5) * (1 - PERK.managerDiscount));
    expect(deliveryBuyPlan(state, 10).levels).toBe(10);
  });

  it('takes the kitchen spare capacity, limited by the couriers', () => {
    const state = roomyKitchen();
    state.deliveryLevel = 1;
    const spare = sectionRates(state).kitchen - throughput(state).customersPerSecond;
    expect(spare).toBeGreaterThan(DELIVERY.baseRate);
    const flow = deliveryFlow(state);
    expect(flow.limitedBy).toBe('couriers');
    expect(flow.ordersPerSecond).toBeCloseTo(DELIVERY.baseRate);

    state.deliveryLevel = 500;
    const full = deliveryFlow(state);
    expect(full.limitedBy).toBe('kitchen');
    expect(full.ordersPerSecond).toBeCloseTo(spare);
  });

  it('gets nothing while the kitchen is the bottleneck', () => {
    const state = newEconomy();
    for (const id of SECTION_IDS) state.sectionLevels[id] = 30;
    state.sectionLevels.kitchen = 5;
    state.deliveryLevel = 20;
    expect(throughput(state).bottleneck).toBe('kitchen');
    expect(deliveryFlow(state)).toMatchObject({ ordersPerSecond: 0, limitedBy: 'kitchen' });
  });

  it('pays a share of the bill per order on top of the dining room', () => {
    const state = roomyKitchen();
    const dineIn = baseIncomePerSecond(state);
    state.deliveryLevel = 3;
    const orders = deliveryFlow(state).ordersPerSecond;
    expect(baseIncomePerSecond(state)).toBeCloseTo(dineIn + orders * DELIVERY.billFraction * billPerCustomer(state));
    expect(incomeBreakdown(state).dineIn).toBeCloseTo(dineIn);
  });

  it('starts over with a franchise', () => {
    const state = roomyKitchen();
    state.deliveryLevel = 30;
    expect(prestige(state).deliveryLevel).toBe(0);
  });

  it('is kept by saves, and old saves start with it closed', () => {
    const state = newEconomy();
    state.deliveryLevel = 12;
    expect(parseSave(serializeSave(createSave(state, 0)))?.economy.deliveryLevel).toBe(12);
    const old = JSON.parse(serializeSave(createSave(newEconomy(), 0)));
    delete old.economy.deliveryLevel;
    expect(parseSave(JSON.stringify(old))?.economy.deliveryLevel).toBe(0);
  });
});
