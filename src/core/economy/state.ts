import { ADS, DELIVERY, DISH_TIERS, EVENTS, MILESTONE_BONUS, PARKING, SECTION_IDS, SECTIONS, TAP, VALET, type SectionId } from './config';
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
  // Seconds until the staff help ad is offered again.
  staffCooldown: number;
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
  // Night Safe level of this restaurant (longer offline earnings); starts over with a franchise.
  safeLevel: number;
  // Courier level of this restaurant; 0 while delivery is not open. Starts over with a franchise.
  deliveryLevel: number;
  // Parking lot level (0 = no lot yet) and whether it has valet service. Both start over with a franchise.
  parkingLevel: number;
  valet: boolean;
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
    staffCooldown: 0,
    reviewSeconds: 0,
    lab: newLab(),
    perks: newPerks(),
    daily: newDaily(),
    chefs: newChefs(),
    purchases: newPurchases(),
    safeLevel: 0,
    deliveryLevel: 0,
    parkingLevel: 0,
    valet: false,
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
  rates.entrance += parkingRate(state);
  return rates;
}

// Drivers per second the parking lot brings in (0 without a lot).
export function parkingRate(state: EconomyState): number {
  return scaledValue(PARKING.baseRate, state.parkingLevel, MILESTONE_BONUS.section) * (state.valet ? VALET.rateMultiplier : 1);
}

export interface Arrivals {
  // Customers per second who walk in and who come by car (the entrance's rate is their sum).
  walkIn: number;
  parking: number;
  // Share of the dining room's customers who came by car, and what that adds to the average bill.
  carShare: number;
  billMultiplier: number;
}

// Seats are filled from both ways in, in proportion to how many each one brings.
export function arrivals(state: EconomyState): Arrivals {
  const parking = parkingRate(state);
  const total = sectionRates(state).entrance;
  const walkIn = total - parking;
  const carShare = total > 0 ? parking / total : 0;
  const bonus = PARKING.carBillBonus + (state.valet ? VALET.extraBillBonus : 0);
  return { walkIn, parking, carShare, billMultiplier: 1 + carShare * bonus };
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

// Delivery orders per second the couriers could take out (0 while delivery is closed).
export function courierRate(state: EconomyState): number {
  return scaledValue(DELIVERY.baseRate, state.deliveryLevel, MILESTONE_BONUS.section);
}

export interface DeliveryFlow {
  // Orders the couriers take out per second.
  ordersPerSecond: number;
  // What the couriers could take, and what the kitchen has left after the dining room.
  courierRate: number;
  kitchenSpare: number;
  // What holds delivery back: too few couriers, or a kitchen busy with dine-in customers.
  limitedBy: 'couriers' | 'kitchen';
}

// The kitchen cooks for dine-in customers first; delivery gets what it has left.
export function deliveryFlow(state: EconomyState): DeliveryFlow {
  const couriers = courierRate(state);
  const kitchenSpare = Math.max(0, sectionRates(state).kitchen - throughput(state).customersPerSecond);
  return {
    ordersPerSecond: Math.min(couriers, kitchenSpare),
    courierRate: couriers,
    kitchenSpare,
    limitedBy: couriers <= kitchenSpare ? 'couriers' : 'kitchen',
  };
}

// Income without the timed boosts, split into the dining room and delivery.
export function incomeBreakdown(state: EconomyState): { dineIn: number; delivery: number } {
  const perBill = billPerCustomer(state) * incomeMultiplier(state);
  return {
    dineIn: throughput(state).customersPerSecond * perBill * arrivals(state).billMultiplier,
    delivery: deliveryFlow(state).ordersPerSecond * DELIVERY.billFraction * perBill,
  };
}

// Income without the Rush boost.
export function baseIncomePerSecond(state: EconomyState): number {
  const { dineIn, delivery } = incomeBreakdown(state);
  return dineIn + delivery;
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

// Runs down timed effects (Rush, review, ad cooldowns, lab research).
export function passTime(state: EconomyState, seconds: number): void {
  state.rushSeconds = Math.max(0, state.rushSeconds - seconds);
  state.reviewSeconds = Math.max(0, state.reviewSeconds - seconds);
  state.timeSkipCooldown = Math.max(0, state.timeSkipCooldown - seconds);
  state.staffCooldown = Math.max(0, state.staffCooldown - seconds);
  for (const slot of state.lab.slots) slot.remaining = Math.max(0, slot.remaining - seconds);
}

export function earn(state: EconomyState, amount: number): void {
  state.money += amount;
  state.runEarnings += amount;
  state.lifetimeEarnings += amount;
  state.runReputation += amount / cityCostScale(state.city);
}

// Tip earned by one tap on the restaurant. Returns the amount earned.
// What one tap on the restaurant earns: a fifth of a second of income, but at least a quarter
// of one customer's bill (which only matters in the first minutes).
export function tapAmount(state: EconomyState): number {
  const bill = billPerCustomer(state) * incomeMultiplier(state) * TAP.billFraction;
  return Math.max(incomePerSecond(state) * TAP.incomeFraction, bill);
}

export function tap(state: EconomyState): number {
  const amount = tapAmount(state);
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
