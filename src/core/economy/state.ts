import { ADS, DISH_TIERS, EVENTS, MILESTONE_BONUS, SECTION_IDS, SECTIONS, TAP, type SectionId } from './config';
import { cityCostScale, cityPriceScale, scaledValue } from './formulas';
import { incomeMultiplier, newLab, newPerks, sectionRateMultiplier, type LabState, type PerkLevels } from './bonuses';
import { newChefs, type ChefState } from './chefs';
import { newPurchases, type Purchases } from './shop';
import { newDaily, type DailyState } from './daily';

export interface EconomyState {
  money: number;
  // Earnings across all runs; drives Chef Stars.
  lifetimeEarnings: number;
  // Earnings in the current run only.
  runEarnings: number;
  // Run earnings divided by the city's cost scale; sets the stars a franchise awards.
  runReputation: number;
  stars: number;
  // Index of the current restaurant in the chain: 0 is the first one (see cityConfig).
  city: number;
  // Stars each finished city awarded, in order (shown on the world map).
  cityStars: number[];
  sectionLevels: Record<SectionId, number>;
  // Level per dish in menu order (DISH_TIERS); 0 means not on the menu yet.
  dishLevels: number[];
  // Seconds of Rush (ad boost) left, and seconds until the next time skip. Both survive a franchise.
  rushSeconds: number;
  timeSkipCooldown: number;
  // Seconds left of a food critic's good review (income boost). It belongs to this restaurant.
  reviewSeconds: number;
  // Kitchen Lab research and franchise perks: permanent, they survive franchises.
  lab: LabState;
  perks: PerkLevels;
  // Daily reward streak and today's tasks: they belong to the player, so they survive franchises.
  daily: DailyState;
  // Chef collection: cards and levels, permanent like the lab.
  chefs: ChefState;
  // In-app purchases the player owns (every product is bought once and kept).
  purchases: Purchases;
}

export function newEconomy(stars = 0, lifetimeEarnings = 0, city = 0): EconomyState {
  const sectionLevels = Object.fromEntries(SECTION_IDS.map((id) => [id, 1])) as Record<SectionId, number>;
  return {
    money: 0,
    lifetimeEarnings,
    runEarnings: 0,
    runReputation: 0,
    stars,
    city,
    cityStars: [],
    sectionLevels,
    dishLevels: DISH_TIERS.map((d) => (d.unlockCost === 0 ? 1 : 0)),
    rushSeconds: 0,
    timeSkipCooldown: 0,
    reviewSeconds: 0,
    lab: newLab(),
    perks: newPerks(),
    daily: newDaily(),
    chefs: newChefs(),
    purchases: newPurchases(),
  };
}

// Every customer takes the "taste tour": one serving of each dish on the menu.
export function billPerCustomer(state: EconomyState): number {
  let bill = 0;
  DISH_TIERS.forEach((_, i) => (bill += dishPrice(state, i)));
  return bill;
}

// Price of one serving of a dish at its current level.
export function dishPrice(state: EconomyState, index: number): number {
  const tier = DISH_TIERS[index];
  return scaledValue(tier.basePrice * cityPriceScale(state.city), state.dishLevels[index], MILESTONE_BONUS.dish);
}

// Customers per second each section can handle.
export function sectionRates(state: EconomyState): Record<SectionId, number> {
  const rates = {} as Record<SectionId, number>;
  for (const id of SECTION_IDS) {
    rates[id] = scaledValue(SECTIONS[id].baseRate, state.sectionLevels[id], MILESTONE_BONUS.section) * sectionRateMultiplier(state, id);
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

// Income without the Rush boost.
export function baseIncomePerSecond(state: EconomyState): number {
  return throughput(state).customersPerSecond * billPerCustomer(state) * incomeMultiplier(state);
}

// The timed boosts on income right now (Rush and a good review multiply).
export function boostMultiplier(state: EconomyState): number {
  return (state.rushSeconds > 0 ? ADS.rushMultiplier : 1) * (state.reviewSeconds > 0 ? EVENTS.critic.reviewMultiplier : 1);
}

export function incomePerSecond(state: EconomyState): number {
  return baseIncomePerSecond(state) * boostMultiplier(state);
}

// Income over the next `seconds`, counting each boost only for the part of it that the boost
// still covers: the integral of (1 + rush bonus while Rush lasts) * (1 + review bonus while it lasts).
export function earningsOver(state: EconomyState, seconds: number): number {
  const s = Math.max(seconds, 0);
  const rush = Math.min(s, state.rushSeconds);
  const review = Math.min(s, state.reviewSeconds);
  const both = Math.min(rush, review);
  const r = ADS.rushMultiplier - 1;
  const v = EVENTS.critic.reviewMultiplier - 1;
  return baseIncomePerSecond(state) * (s + rush * r + review * v + both * r * v);
}

// Runs down timed effects (Rush, review, time skip cooldown, lab research).
export function passTime(state: EconomyState, seconds: number): void {
  state.rushSeconds = Math.max(0, state.rushSeconds - seconds);
  state.reviewSeconds = Math.max(0, state.reviewSeconds - seconds);
  state.timeSkipCooldown = Math.max(0, state.timeSkipCooldown - seconds);
  for (const slot of state.lab.slots) slot.remaining = Math.max(0, slot.remaining - seconds);
}

export function earn(state: EconomyState, amount: number): void {
  state.money += amount;
  state.runEarnings += amount;
  state.lifetimeEarnings += amount;
  state.runReputation += amount / cityCostScale(state.city);
}

// Tip earned by one tap on the restaurant. Returns the amount earned.
export function tap(state: EconomyState): number {
  const amount = billPerCustomer(state) * incomeMultiplier(state) * TAP.billFraction;
  earn(state, amount);
  return amount;
}

// Earn the income of `seconds` of play. Returns the amount earned.
export function advanceTime(state: EconomyState, seconds: number): number {
  const amount = earningsOver(state, seconds);
  earn(state, amount);
  passTime(state, seconds);
  return amount;
}
