import { MILESTONES, PRESTIGE } from './config';

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

export function totalStarsFor(lifetimeEarnings: number): number {
  return Math.floor(Math.sqrt(lifetimeEarnings / PRESTIGE.starDivisor));
}

export function starMultiplier(stars: number): number {
  return 1 + stars * PRESTIGE.bonusPerStar;
}

export function offlineEarnings(incomePerSecond: number, secondsAway: number, capSeconds: number): number {
  return incomePerSecond * Math.min(Math.max(secondsAway, 0), capSeconds);
}
