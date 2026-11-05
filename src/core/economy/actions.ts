import { ADS, DISH_MAX_LEVEL, DISH_TIERS, SECTIONS, type SectionId } from './config';
import { cityCostScale, levelCost, starsForReputation } from './formulas';
import { baseIncomePerSecond, earn, earningsOver, newEconomy, type EconomyState } from './state';

export function sectionUpgradeCost(state: EconomyState, id: SectionId): number {
  const cfg = SECTIONS[id];
  return levelCost(cfg.baseCost, cfg.costGrowth, state.sectionLevels[id]) * cityCostScale(state.city);
}

// Unlock cost if the dish is not on the menu yet, otherwise the next level's cost.
// Infinity once the dish is mastered.
export function dishCost(state: EconomyState, index: number): number {
  const tier = DISH_TIERS[index];
  const level = state.dishLevels[index];
  if (level >= DISH_MAX_LEVEL) return Infinity;
  const cost = level === 0 ? tier.unlockCost : levelCost(tier.baseUpgradeCost, tier.costGrowth, level);
  return cost * cityCostScale(state.city);
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
  const scale = cityCostScale(state.city);
  return planLevels((k) => levelCost(cfg.baseCost, cfg.costGrowth, level + k) * scale, amount, MAX_LEVELS_PER_BUY, state.money);
}

// Unlocking a dish counts as its first level. Locked dishes other than the next one cannot be bought.
export function dishBuyPlan(state: EconomyState, index: number, amount: BuyAmount): BuyPlan {
  const tier = DISH_TIERS[index];
  const level = state.dishLevels[index];
  if (level === 0 && index !== nextLockedDish(state)) return { levels: 0, cost: Infinity };
  if (level >= DISH_MAX_LEVEL) return { levels: 0, cost: Infinity };
  const scale = cityCostScale(state.city);
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
  state.dishLevels[index] += plan.levels;
  return plan.levels;
}

export function buySectionLevel(state: EconomyState, id: SectionId): boolean {
  return buySectionLevels(state, id, 1) > 0;
}

export function buyDish(state: EconomyState, index: number): boolean {
  return buyDishLevels(state, index, 1) > 0;
}

// Stars a franchise would award right now.
export function pendingStars(state: EconomyState): number {
  return starsForReputation(state.runReputation);
}

// A franchise opens once the city's whole menu is unlocked and it would award a star.
export function canFranchise(state: EconomyState): boolean {
  return nextLockedDish(state) < 0 && pendingStars(state) > 0;
}

// Franchise: sell the restaurant and start over in the next city, keeping the stars.
export function prestige(state: EconomyState): EconomyState {
  const gained = pendingStars(state);
  const next = newEconomy(state.stars + gained, state.lifetimeEarnings, state.city + 1);
  next.cityStars = [...state.cityStars, gained];
  // Ad rewards were earned by the player, not the restaurant, so they move along.
  next.rushSeconds = state.rushSeconds;
  next.timeSkipCooldown = state.timeSkipCooldown;
  return next;
}

// Rush (rewarded ad): adds boosted time, up to the cap.
export function activateRush(state: EconomyState): void {
  state.rushSeconds = Math.min(state.rushSeconds + ADS.rushSeconds, ADS.rushMaxSeconds);
}

export function canActivateRush(state: EconomyState): boolean {
  return state.rushSeconds + ADS.rushSeconds <= ADS.rushMaxSeconds;
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

// What a VIP guest tips for a rewarded ad. Rush does not raise it, so the two do not stack.
export function vipTip(state: EconomyState): number {
  return baseIncomePerSecond(state) * ADS.vipTipSeconds;
}

// Picks the seconds of play until the next VIP visit; random in [0, 1) comes from the caller.
export function nextVipGap(random: number): number {
  return ADS.vipMinGapSeconds + random * (ADS.vipMaxGapSeconds - ADS.vipMinGapSeconds);
}
