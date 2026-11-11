import { CHEF, CHEF_IDS, type ChefId } from './config';
import type { EconomyState } from './state';

// Chef collection (GDD 6f): one famous chef per city of the tour. Cards come from playing
// (dishes added to the menu, franchises, the daily chest, good reviews, the starter pack). The
// player spends them to recruit a chef and to level them up; levels are permanent.

export interface ChefState {
  // Cards waiting to be spent, per chef.
  cards: Record<ChefId, number>;
  // 0 = not recruited yet.
  levels: Record<ChefId, number>;
}

export function newChefs(): ChefState {
  const zero = () => Object.fromEntries(CHEF_IDS.map((id) => [id, 0])) as Record<ChefId, number>;
  return { cards: zero(), levels: zero() };
}

export function chefMaxLevel(): number {
  return CHEF.cardsPerLevel.length;
}

// The chef who belongs to a city of the tour (the list repeats like the cities do).
export function chefOfCity(city: number): ChefId {
  return CHEF_IDS[city % CHEF_IDS.length];
}

// A chef can only get cards once the tour has reached their city.
export function chefMet(state: EconomyState, id: ChefId): boolean {
  return CHEF_IDS.indexOf(id) <= state.city;
}

// Cards the next level takes; null at max level.
export function cardsForNextLevel(state: EconomyState, id: ChefId): number | null {
  const level = state.chefs.levels[id];
  return level >= chefMaxLevel() ? null : CHEF.cardsPerLevel[level];
}

export function canLevelUpChef(state: EconomyState, id: ChefId): boolean {
  const needed = cardsForNextLevel(state, id);
  return needed !== null && state.chefs.cards[id] >= needed;
}

// Spends the cards for the next level (the first level recruits the chef).
export function levelUpChef(state: EconomyState, id: ChefId): boolean {
  if (!canLevelUpChef(state, id)) return false;
  state.chefs.cards[id] -= cardsForNextLevel(state, id)!;
  state.chefs.levels[id]++;
  return true;
}

// Cards a chef can still use before reaching max level.
function cardsWanted(state: EconomyState, id: ChefId): number {
  const level = state.chefs.levels[id];
  const left = CHEF.cardsPerLevel.slice(level).reduce((sum, n) => sum + n, 0);
  return Math.max(0, left - state.chefs.cards[id]);
}

// Who gets cards that are not tied to a chef: the chef of this city while they still need
// cards, otherwise the met chef furthest from max level. Null when every met chef has enough.
export function cardTarget(state: EconomyState): ChefId | null {
  const local = chefOfCity(state.city);
  if (cardsWanted(state, local) > 0) return local;
  let best: ChefId | null = null;
  for (const id of CHEF_IDS) {
    if (!chefMet(state, id)) continue;
    if (cardsWanted(state, id) > (best ? cardsWanted(state, best) : 0)) best = id;
  }
  return best;
}

// Gives cards to `cardTarget`. Returns who got them (null if nobody needed them).
export function giveChefCards(state: EconomyState, count: number): ChefId | null {
  if (count <= 0) return null;
  const id = cardTarget(state);
  if (id) state.chefs.cards[id] += count;
  return id;
}

// True when a chef can be recruited or leveled up (the red "!" on the chefs button).
export function chefsNeedAttention(state: EconomyState): boolean {
  return CHEF_IDS.some((id) => canLevelUpChef(state, id));
}

export function recruitedChefs(state: EconomyState): number {
  return CHEF_IDS.filter((id) => state.chefs.levels[id] > 0).length;
}
