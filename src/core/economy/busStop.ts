import { BUS_STOP, MILESTONE_BONUS } from './config';
import { levelCost, scaledValue } from './formulas';
import { incomeMultiplier } from './bonuses';
import { billPerCustomer, boostMultiplier, incomePerSecond, sectionRates, throughput, type EconomyState } from './state';
import { MAX_LEVELS_PER_BUY, costScale, planLevels, sectionCostScale, spend, type BuyAmount, type BuyPlan } from './actions';

// Riders per second the buses could bring on average (0 without a stop).
export function busRate(state: EconomyState): number {
  return scaledValue(BUS_STOP.baseRate, state.busStopLevel, MILESTONE_BONUS.section);
}

export interface BusFlow {
  // Riders per second who get a table, what the buses bring, and the dining room's spare seats.
  ridersPerSecond: number;
  busRate: number;
  spareSeats: number;
  limitedBy: 'buses' | 'seats';
}

// Groups sit at the tables the steady flow leaves free.
export function busFlow(state: EconomyState): BusFlow {
  const rate = busRate(state);
  const spareSeats = Math.max(0, sectionRates(state).seating - throughput(state).customersPerSecond);
  return { ridersPerSecond: Math.min(rate, spareSeats), busRate: rate, spareSeats, limitedBy: rate <= spareSeats ? 'buses' : 'seats' };
}

// Riders on the next bus who get a table.
export function busGroupSize(state: EconomyState): number {
  return busFlow(state).ridersPerSecond * BUS_STOP.intervalSeconds;
}

// What one bus pays, boosts included (Rush and a good review count when it arrives).
export function busPayout(state: EconomyState): number {
  return busGroupSize(state) * billPerCustomer(state) * incomeMultiplier(state) * BUS_STOP.billFraction * boostMultiplier(state);
}

// The buses' income per second on average, without boosts.
export function busIncomePerSecond(state: EconomyState): number {
  return busFlow(state).ridersPerSecond * billPerCustomer(state) * incomeMultiplier(state) * BUS_STOP.billFraction;
}

// Income per second while the game is open: the steady income plus the buses on average.
export function activeIncomePerSecond(state: EconomyState): number {
  return incomePerSecond(state) + busIncomePerSecond(state) * boostMultiplier(state);
}

// Opening the stop is its first level; after that each level costs like a section level.
export function busStopBuyPlan(state: EconomyState, amount: BuyAmount): BuyPlan {
  const level = state.busStopLevel;
  if (level === 0) return { levels: 1, cost: BUS_STOP.unlockCost * costScale(state) };
  const scale = sectionCostScale(state);
  return planLevels((k) => levelCost(BUS_STOP.baseCost, BUS_STOP.costGrowth, level + k) * scale, amount, MAX_LEVELS_PER_BUY, state.money);
}

export function busStopCost(state: EconomyState): number {
  return busStopBuyPlan(state, 1).cost;
}

export function buyBusStopLevels(state: EconomyState, amount: BuyAmount): number {
  const plan = busStopBuyPlan(state, amount);
  if (plan.levels === 0 || !spend(state, plan.cost)) return 0;
  state.busStopLevel += plan.levels;
  return plan.levels;
}
