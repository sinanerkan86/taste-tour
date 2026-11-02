import { ADS, DISH_MAX_LEVEL, DISH_TIERS, SECTIONS, type SectionId } from './config';
import { cityCostScale, levelCost, starsForReputation } from './formulas';
import { earn, earningsOver, newEconomy, type EconomyState } from './state';

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

export function buySectionLevel(state: EconomyState, id: SectionId): boolean {
  if (!spend(state, sectionUpgradeCost(state, id))) return false;
  state.sectionLevels[id]++;
  return true;
}

export function buyDish(state: EconomyState, index: number): boolean {
  if (state.dishLevels[index] === 0 && index !== nextLockedDish(state)) return false;
  if (!spend(state, dishCost(state, index))) return false;
  state.dishLevels[index]++;
  return true;
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
  const next = newEconomy(state.stars + pendingStars(state), state.lifetimeEarnings, state.city + 1);
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
