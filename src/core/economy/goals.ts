import { DISH_TIERS, PRESTIGE } from './config';
import { canFranchise, dishBuyPlan, nextLockedDish } from './actions';
import type { EconomyState } from './state';

// The one thing the player is working toward right now, shown in the goal bar.
// progress runs from 0 to 1 (1 = can do it now).
export type Goal =
  | { kind: 'unlockDish'; dish: number; progress: number }
  | { kind: 'firstStar'; progress: number }
  | { kind: 'franchise'; progress: number };

export function currentGoal(state: EconomyState): Goal {
  const dish = nextLockedDish(state);
  if (dish >= 0) {
    const { cost } = dishBuyPlan(state, dish, 1);
    return { kind: 'unlockDish', dish, progress: Math.min(1, state.money / cost) };
  }
  if (canFranchise(state)) return { kind: 'franchise', progress: 1 };
  // The whole menu is out but a franchise would not award a star yet.
  return { kind: 'firstStar', progress: Math.min(1, state.runReputation / PRESTIGE.starDivisor) };
}

// Dishes on the menu; the restaurant's decor grows with it (1 = just opened).
export function menuSize(state: EconomyState): number {
  return state.dishLevels.filter((level) => level > 0).length;
}

export const MENU_SIZE = DISH_TIERS.length;

// Section levels at which a section gets its next look in the scene (staff outfits, furniture).
// The first city ends with sections around level 100-150, so all three show up in a normal run.
export const STYLE_LEVELS = [25, 50, 100];
export const STYLE_TIERS = STYLE_LEVELS.length;

// 0 = the plain starting look, up to STYLE_TIERS.
export function styleTier(level: number): number {
  return STYLE_LEVELS.filter((threshold) => level >= threshold).length;
}
