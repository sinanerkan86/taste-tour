import { CITIES, CITY, MILESTONES, PRESTIGE, type CityConfig } from './config';

export function milestonesReached(level: number): number {
  let count = 0;
  for (const m of MILESTONES) {
    if (level >= m) count++;
    else break;
  }
  return count;
}

// The next milestone level above `level`, or null past the last one.
export function nextMilestone(level: number): number | null {
  return MILESTONES.find((m) => m > level) ?? null;
}

// Output that grows linearly with level and jumps by `milestoneBonus` at each milestone.
export function scaledValue(base: number, level: number, milestoneBonus: number): number {
  if (level <= 0) return 0;
  return base * level * milestoneBonus ** milestonesReached(level);
}

// Cost of going from `level` to `level + 1`.
export function levelCost(baseCost: number, growth: number, level: number): number {
  return baseCost * growth ** (level - 1);
}

export function starsForReputation(reputation: number): number {
  // The epsilon keeps exact powers (1000 ** (1/3) = 9.999...) from rounding down.
  return Math.floor((reputation / PRESTIGE.starDivisor) ** PRESTIGE.starExponent + 1e-9);
}

export function starMultiplier(stars: number): number {
  return 1 + stars * PRESTIGE.bonusPerStar;
}

// The n-th restaurant of the chain (0 = the first one). Cities repeat after the last one.
export function cityConfig(city: number): CityConfig {
  return CITIES[city % CITIES.length];
}

export function cityPriceScale(city: number): number {
  return CITY.priceStep ** city;
}

export function cityCostScale(city: number): number {
  return cityPriceScale(city) * starMultiplier(CITY.expectedStarsPerCity * city);
}
