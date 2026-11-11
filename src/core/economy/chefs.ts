import { CHEF, CHEF_IDS, type ChefId } from './config';
import type { EconomyState } from './state';

// Chef collection (GDD 6f): one famous chef per city of the tour. Chef cards come from playing
// (dishes added to the menu, franchises, the daily chest, good reviews, the starter pack) into
// one shared pool; the player chooses which chef to spend them on: recruiting a chef is the first
// level, then each level costs more cards. Levels are permanent.

export interface ChefState {
  // Chef cards waiting to be spent, on any chef the tour has reached.
  pool: number;
  // 0 = not recruited yet.
  levels: Record<ChefId, number>;
}

export function newChefs(): ChefState {
  return { pool: 0, levels: Object.fromEntries(CHEF_IDS.map((id) => [id, 0])) as Record<ChefId, number> };
}

export function chefMaxLevel(): number {
  return CHEF.cardsPerLevel.length;
}

// The chef who belongs to a city of the tour (the list repeats like the cities do).
export function chefOfCity(city: number): ChefId {
  return CHEF_IDS[city % CHEF_IDS.length];
}

// A chef can be recruited once the tour has reached their city.
export function chefMet(state: EconomyState, id: ChefId): boolean {
  return CHEF_IDS.indexOf(id) <= state.city;
}

// Cards the next level takes; null at max level.
export function cardsForNextLevel(state: EconomyState, id: ChefId): number | null {
  const level = state.chefs.levels[id];
  return level >= chefMaxLevel() ? null : CHEF.cardsPerLevel[level];
}

// Cards spent on a chef so far.
export function cardsSpentOn(state: EconomyState, id: ChefId): number {
  return CHEF.cardsPerLevel.slice(0, state.chefs.levels[id]).reduce((sum, n) => sum + n, 0);
}

export function canLevelUpChef(state: EconomyState, id: ChefId): boolean {
  const needed = cardsForNextLevel(state, id);
  return chefMet(state, id) && needed !== null && state.chefs.pool >= needed;
}

// Spends cards from the pool on the chef's next level (the first level recruits the chef).
export function levelUpChef(state: EconomyState, id: ChefId): boolean {
  if (!canLevelUpChef(state, id)) return false;
  state.chefs.pool -= cardsForNextLevel(state, id)!;
  state.chefs.levels[id]++;
  return true;
}

// Adds cards to the pool. Returns how many were added.
export function giveChefCards(state: EconomyState, count: number): number {
  const cards = Math.max(0, Math.floor(count));
  state.chefs.pool += cards;
  return cards;
}

// True when some chef can be recruited or leveled up (the red "!" on the chefs button).
export function chefsNeedAttention(state: EconomyState): boolean {
  return CHEF_IDS.some((id) => canLevelUpChef(state, id));
}

export function recruitedChefs(state: EconomyState): number {
  return CHEF_IDS.filter((id) => state.chefs.levels[id] > 0).length;
}
