import { DISHES, MILESTONE_BONUS, SECTION_IDS, SECTIONS, TAP, type SectionId } from './config';
import { scaledValue, starMultiplier } from './formulas';

export interface EconomyState {
  money: number;
  // Earnings across all runs; drives Chef Stars.
  lifetimeEarnings: number;
  // Earnings in the current run only.
  runEarnings: number;
  stars: number;
  sectionLevels: Record<SectionId, number>;
  // Level per dish in DISHES order; 0 means not on the menu yet.
  dishLevels: number[];
}

export function newEconomy(stars = 0, lifetimeEarnings = 0): EconomyState {
  const sectionLevels = Object.fromEntries(SECTION_IDS.map((id) => [id, 1])) as Record<SectionId, number>;
  return {
    money: 0,
    lifetimeEarnings,
    runEarnings: 0,
    stars,
    sectionLevels,
    dishLevels: DISHES.map((d) => (d.unlockCost === 0 ? 1 : 0)),
  };
}

// Every customer takes the "taste tour": one serving of each dish on the menu.
export function billPerCustomer(state: EconomyState): number {
  let bill = 0;
  DISHES.forEach((dish, i) => {
    bill += scaledValue(dish.basePrice, state.dishLevels[i], MILESTONE_BONUS.dish);
  });
  return bill;
}

// Customers per second each section can handle.
export function sectionRates(state: EconomyState): Record<SectionId, number> {
  const rates = {} as Record<SectionId, number>;
  for (const id of SECTION_IDS) {
    rates[id] = scaledValue(SECTIONS[id].baseRate, state.sectionLevels[id], MILESTONE_BONUS.section);
  }
  return rates;
}

export interface Throughput {
  customersPerSecond: number;
  bottleneck: SectionId;
}

// The slowest section limits the whole restaurant.
export function throughput(state: EconomyState): Throughput {
  const rates = sectionRates(state);
  let bottleneck: SectionId = SECTION_IDS[0];
  for (const id of SECTION_IDS) {
    if (rates[id] < rates[bottleneck]) bottleneck = id;
  }
  return { customersPerSecond: rates[bottleneck], bottleneck };
}

export function incomePerSecond(state: EconomyState): number {
  return throughput(state).customersPerSecond * billPerCustomer(state) * starMultiplier(state.stars);
}

export function earn(state: EconomyState, amount: number): void {
  state.money += amount;
  state.runEarnings += amount;
  state.lifetimeEarnings += amount;
}

// Tip earned by one tap on the restaurant. Returns the amount earned.
export function tap(state: EconomyState): number {
  const amount = billPerCustomer(state) * starMultiplier(state.stars) * TAP.billFraction;
  earn(state, amount);
  return amount;
}

// Earn the income of `seconds` of play. Returns the amount earned.
export function advanceTime(state: EconomyState, seconds: number): number {
  const amount = incomePerSecond(state) * seconds;
  earn(state, amount);
  return amount;
}
