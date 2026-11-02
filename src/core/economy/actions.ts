import { DISH_MAX_LEVEL, DISHES, SECTIONS, type SectionId } from './config';
import { levelCost, totalStarsFor } from './formulas';
import { newEconomy, type EconomyState } from './state';

export function sectionUpgradeCost(state: EconomyState, id: SectionId): number {
  const cfg = SECTIONS[id];
  return levelCost(cfg.baseCost, cfg.costGrowth, state.sectionLevels[id]);
}

// Unlock cost if the dish is not on the menu yet, otherwise the next level's cost.
// Infinity once the dish is mastered.
export function dishCost(state: EconomyState, index: number): number {
  const dish = DISHES[index];
  const level = state.dishLevels[index];
  if (level >= DISH_MAX_LEVEL) return Infinity;
  return level === 0 ? dish.unlockCost : levelCost(dish.baseUpgradeCost, dish.costGrowth, level);
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

export function pendingStars(state: EconomyState): number {
  return Math.max(0, totalStarsFor(state.lifetimeEarnings) - state.stars);
}

// Franchise: start over with the stars earned so far.
export function prestige(state: EconomyState): EconomyState {
  return newEconomy(state.stars + pendingStars(state), state.lifetimeEarnings);
}
