import { ADS, CHEF, DELIVERY, DISH_MAX_LEVEL, DISH_TIERS, PARKING, PERK, SAFE, SECTION_IDS, SECTIONS, VALET, type PerkId, type SectionId } from './config';
import { giveChefCards } from './chefs';
import { cityCostScale, levelCost, starsForReputation } from './formulas';
import {
  costMultiplier,
  perkMaxLevel,
  rushMaxSeconds,
  rushSeconds,
  sectionCostMultiplier,
  starGainMultiplier,
  vipGapMultiplier,
  vipTipMultiplier,
} from './bonuses';
import { baseIncomePerSecond, earn, earningsOver, newEconomy, throughput, type EconomyState } from './state';

// What every upgrade and unlock in this restaurant is multiplied by: the city's scale, minus the
// Local Suppliers discount.
export function costScale(state: EconomyState): number {
  return cityCostScale(state.city) * costMultiplier(state);
}

// Section upgrades also get the Restaurant Manager discount.
function sectionCostScale(state: EconomyState): number {
  return costScale(state) * sectionCostMultiplier(state);
}

export function sectionUpgradeCost(state: EconomyState, id: SectionId): number {
  const cfg = SECTIONS[id];
  return levelCost(cfg.baseCost, cfg.costGrowth, state.sectionLevels[id]) * sectionCostScale(state);
}

// Unlock cost if the dish is not on the menu yet, otherwise the next level's cost.
// Infinity once the dish is mastered.
export function dishCost(state: EconomyState, index: number): number {
  const tier = DISH_TIERS[index];
  const level = state.dishLevels[index];
  if (level >= DISH_MAX_LEVEL) return Infinity;
  const cost = level === 0 ? tier.unlockCost : levelCost(tier.baseUpgradeCost, tier.costGrowth, level);
  return cost * costScale(state);
}

// Dishes unlock strictly in order. Returns -1 when every dish is on the menu.
export function nextLockedDish(state: EconomyState): number {
  return state.dishLevels.findIndex((level) => level === 0);
}

function spend(state: EconomyState, cost: number): boolean {
  if (state.money < cost) return false;
  state.money -= cost;
  return true;
}

// How many levels one tap on a buy button buys: 1, 10, or as many as the money covers.
export type BuyAmount = 1 | 10 | 'max';
export const BUY_AMOUNTS: BuyAmount[] = [1, 10, 'max'];

export interface BuyPlan {
  levels: number;
  cost: number;
}

// A fixed amount buys exactly that many levels (fewer only near a level cap), affordable or
// not, so the button can show the price. 'max' buys as many as the money covers, but at least
// one, so an unaffordable button still shows the next level's price.
function planLevels(costOf: (offset: number) => number, amount: BuyAmount, limit: number, money: number): BuyPlan {
  const wanted = Math.min(amount === 'max' ? limit : amount, limit);
  let levels = 0;
  let cost = 0;
  while (levels < wanted) {
    const next = costOf(levels);
    if (amount === 'max' && levels > 0 && cost + next > money) break;
    cost += next;
    levels++;
  }
  return { levels, cost };
}

// Safety net for 'max' on sections, which have no level cap.
const MAX_LEVELS_PER_BUY = 1000;

export function sectionBuyPlan(state: EconomyState, id: SectionId, amount: BuyAmount): BuyPlan {
  const cfg = SECTIONS[id];
  const level = state.sectionLevels[id];
  const scale = sectionCostScale(state);
  return planLevels((k) => levelCost(cfg.baseCost, cfg.costGrowth, level + k) * scale, amount, MAX_LEVELS_PER_BUY, state.money);
}

// Unlocking a dish counts as its first level. Locked dishes other than the next one cannot be bought.
export function dishBuyPlan(state: EconomyState, index: number, amount: BuyAmount): BuyPlan {
  const tier = DISH_TIERS[index];
  const level = state.dishLevels[index];
  if (level === 0 && index !== nextLockedDish(state)) return { levels: 0, cost: Infinity };
  if (level >= DISH_MAX_LEVEL) return { levels: 0, cost: Infinity };
  const scale = costScale(state);
  const costOf = (k: number) => {
    const at = level + k;
    return (at === 0 ? tier.unlockCost : levelCost(tier.baseUpgradeCost, tier.costGrowth, at)) * scale;
  };
  return planLevels(costOf, amount, DISH_MAX_LEVEL - level, state.money);
}

// Buys levels if the money covers the whole plan. Returns how many levels were bought.
export function buySectionLevels(state: EconomyState, id: SectionId, amount: BuyAmount): number {
  const plan = sectionBuyPlan(state, id, amount);
  if (plan.levels === 0 || !spend(state, plan.cost)) return 0;
  state.sectionLevels[id] += plan.levels;
  return plan.levels;
}

export function buyDishLevels(state: EconomyState, index: number, amount: BuyAmount): number {
  const plan = dishBuyPlan(state, index, amount);
  if (plan.levels === 0 || !spend(state, plan.cost)) return 0;
  // A new dish on the menu earns a card for the chef of the city.
  if (state.dishLevels[index] === 0) giveChefCards(state, CHEF.dishCards);
  state.dishLevels[index] += plan.levels;
  return plan.levels;
}

export function buySectionLevel(state: EconomyState, id: SectionId): boolean {
  return buySectionLevels(state, id, 1) > 0;
}

export function buyDish(state: EconomyState, index: number): boolean {
  return buyDishLevels(state, index, 1) > 0;
}

// Opening delivery is its first level; after that each courier level costs like a section
// level (the Restaurant Manager discount applies).
export function deliveryBuyPlan(state: EconomyState, amount: BuyAmount): BuyPlan {
  const level = state.deliveryLevel;
  if (level === 0) return { levels: 1, cost: DELIVERY.unlockCost * costScale(state) };
  const scale = sectionCostScale(state);
  return planLevels((k) => levelCost(DELIVERY.baseCost, DELIVERY.costGrowth, level + k) * scale, amount, MAX_LEVELS_PER_BUY, state.money);
}

export function deliveryCost(state: EconomyState): number {
  return deliveryBuyPlan(state, 1).cost;
}

export function buyDeliveryLevels(state: EconomyState, amount: BuyAmount): number {
  const plan = deliveryBuyPlan(state, amount);
  if (plan.levels === 0 || !spend(state, plan.cost)) return 0;
  state.deliveryLevel += plan.levels;
  return plan.levels;
}

// Opening the lot is its first level; after that each level of spaces costs like a section level.
export function parkingBuyPlan(state: EconomyState, amount: BuyAmount): BuyPlan {
  const level = state.parkingLevel;
  if (level === 0) return { levels: 1, cost: PARKING.unlockCost * costScale(state) };
  const scale = sectionCostScale(state);
  return planLevels((k) => levelCost(PARKING.baseCost, PARKING.costGrowth, level + k) * scale, amount, MAX_LEVELS_PER_BUY, state.money);
}

export function parkingCost(state: EconomyState): number {
  return parkingBuyPlan(state, 1).cost;
}

export function buyParkingLevels(state: EconomyState, amount: BuyAmount): number {
  const plan = parkingBuyPlan(state, amount);
  if (plan.levels === 0 || !spend(state, plan.cost)) return 0;
  state.parkingLevel += plan.levels;
  return plan.levels;
}

// Valet service: offered once the lot is big enough; Infinity once it is bought.
export function valetCost(state: EconomyState): number {
  return state.valet ? Infinity : VALET.cost * costScale(state);
}

export function canBuyValet(state: EconomyState): boolean {
  return !state.valet && state.parkingLevel >= VALET.minParkingLevel;
}

export function buyValet(state: EconomyState): boolean {
  if (!canBuyValet(state) || !spend(state, valetCost(state))) return false;
  state.valet = true;
  return true;
}

// Next Night Safe level's cost; Infinity at the top level.
export function safeUpgradeCost(state: EconomyState): number {
  const cost = SAFE.costs[state.safeLevel];
  return cost === undefined ? Infinity : cost * costScale(state);
}

export function buySafeLevel(state: EconomyState): boolean {
  const cost = safeUpgradeCost(state);
  if (!Number.isFinite(cost) || !spend(state, cost)) return false;
  state.safeLevel++;
  return true;
}

// Stars a franchise would award right now.
export function pendingStars(state: EconomyState): number {
  return starsForReputation(state.runReputation, starGainMultiplier(state));
}

// A franchise opens once the city's whole menu is unlocked and it would award a star.
export function canFranchise(state: EconomyState): boolean {
  return nextLockedDish(state) < 0 && pendingStars(state) > 0;
}

// Section level a new restaurant opens with (Head Start perk).
export function startingSectionLevel(state: EconomyState): number {
  const head = Math.min(state.perks.headStart, PERK.headStartLevels.length);
  return head > 0 ? PERK.headStartLevels[head - 1] : 1;
}

// Franchise: sell the restaurant and start over in the next city, keeping the stars, the lab
// and the perks. `perk` is the franchise perk the player picked (see perkOffers). The city's
// chef sends the player off with a few chef cards.
export function prestige(state: EconomyState, perk: PerkId | null = null): EconomyState {
  const gained = pendingStars(state);
  const chefs = structuredClone(state.chefs);
  chefs.pool += CHEF.franchiseCards;
  const next = newEconomy(state.stars + gained, state.lifetimeEarnings, state.city + 1);
  next.cityStars = [...state.cityStars, gained];
  // Ad rewards were earned by the player, not the restaurant, so they move along.
  next.rushSeconds = state.rushSeconds;
  next.timeSkipCooldown = state.timeSkipCooldown;
  next.staffCooldown = state.staffCooldown;
  next.lab = { levels: { ...state.lab.levels }, slots: state.lab.slots.map((slot) => ({ ...slot })) };
  next.perks = { ...state.perks };
  next.daily = structuredClone(state.daily);
  next.chefs = chefs;
  next.purchases = { ...state.purchases };
  if (perk && next.perks[perk] < perkMaxLevel(perk)) next.perks[perk]++;
  const level = startingSectionLevel(next);
  for (const id of SECTION_IDS) next.sectionLevels[id] = level;
  return next;
}

// Rush (rewarded ad): adds boosted time, up to the cap.
export function activateRush(state: EconomyState): void {
  state.rushSeconds = Math.min(state.rushSeconds + rushSeconds(state), rushMaxSeconds(state));
}

export function canActivateRush(state: EconomyState): boolean {
  return state.rushSeconds + rushSeconds(state) <= rushMaxSeconds(state);
}

// What a time skip (rewarded ad) pays right now.
export function timeSkipAmount(state: EconomyState): number {
  return earningsOver(state, ADS.timeSkipSeconds);
}

// Pays a time skip unless it is cooling down. Returns the amount earned (0 if refused).
export function useTimeSkip(state: EconomyState): number {
  if (state.timeSkipCooldown > 0) return 0;
  const amount = timeSkipAmount(state);
  earn(state, amount);
  state.timeSkipCooldown = ADS.timeSkipCooldownSeconds;
  return amount;
}

// Free levels the staff help ad would hire for the bottleneck section right now: as many as
// ADS.staffHelpSeconds of income would buy. 0 while it cools down or when not even one level fits.
export function staffHelpLevels(state: EconomyState): number {
  if (state.staffCooldown > 0) return 0;
  const id = throughput(state).bottleneck;
  const budget = baseIncomePerSecond(state) * ADS.staffHelpSeconds;
  const cfg = SECTIONS[id];
  const level = state.sectionLevels[id];
  const scale = sectionCostScale(state);
  let levels = 0;
  let cost = 0;
  while (levels < MAX_LEVELS_PER_BUY) {
    cost += levelCost(cfg.baseCost, cfg.costGrowth, level + levels) * scale;
    if (cost > budget) break;
    levels++;
  }
  return levels;
}

// The ad reward: the levels are added for free and the cooldown starts. Returns the levels.
export function useStaffHelp(state: EconomyState): number {
  const levels = staffHelpLevels(state);
  if (levels <= 0) return 0;
  state.sectionLevels[throughput(state).bottleneck] += levels;
  state.staffCooldown = ADS.staffHelpCooldownSeconds;
  return levels;
}

// What a VIP guest tips for a rewarded ad. Rush does not raise it, so the two do not stack.
export function vipTip(state: EconomyState): number {
  return baseIncomePerSecond(state) * ADS.vipTipSeconds * vipTipMultiplier(state);
}

// Picks the seconds of play until the next VIP visit; random in [0, 1) comes from the caller.
// With a state, the Tour Guide research brings them sooner.
export function nextVipGap(random: number, state?: EconomyState): number {
  const gap = ADS.vipMinGapSeconds + random * (ADS.vipMaxGapSeconds - ADS.vipMinGapSeconds);
  return state ? gap * vipGapMultiplier(state) : gap;
}
