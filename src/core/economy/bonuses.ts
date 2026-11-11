import {
  ADS,
  CHEF_IDS,
  CHEFS,
  LAB,
  OFFLINE,
  PERK,
  PERKS,
  PRESTIGE,
  RESEARCH,
  RESEARCH_IDS,
  PERK_IDS,
  SAFE,
  SHOP,
  type ChefSkill,
  type PerkId,
  type ResearchId,
} from './config';
import type { ChefState } from './chefs';
import type { Purchases } from './shop';

// Permanent progress that survives franchises: Kitchen Lab research and franchise perks.
export interface LabSlot {
  research: ResearchId;
  // Seconds of real time left; 0 means done and waiting to be collected.
  remaining: number;
}

export interface LabState {
  levels: Record<ResearchId, number>;
  slots: LabSlot[];
}

export type PerkLevels = Record<PerkId, number>;

export function newLab(): LabState {
  return { levels: Object.fromEntries(RESEARCH_IDS.map((id) => [id, 0])) as Record<ResearchId, number>, slots: [] };
}

export function newPerks(): PerkLevels {
  return Object.fromEntries(PERK_IDS.map((id) => [id, 0])) as PerkLevels;
}

export function researchMaxLevel(id: ResearchId): number {
  return RESEARCH[id].durations.length;
}

export function perkMaxLevel(id: PerkId): number {
  return PERKS[id].maxLevel;
}

interface Bonuses {
  stars: number;
  lab: LabState;
  perks: PerkLevels;
  chefs: ChefState;
  purchases: Purchases;
  safeLevel: number;
}

// What the recruited chefs with this skill add together (see CHEFS for the units).
export function chefBonus(state: Bonuses, skill: ChefSkill): number {
  let sum = 0;
  for (const id of CHEF_IDS) if (CHEFS[id].skill === skill) sum += state.chefs.levels[id] * CHEFS[id].perLevel;
  return sum;
}

// Every permanent income bonus together: Chef Stars, Secret Spices, Famous Chain, the chefs and
// the Golden Kitchen.
export function incomeMultiplier(state: Bonuses): number {
  return (
    (1 + state.stars * PRESTIGE.bonusPerStar) *
    (1 + state.lab.levels.spices * LAB.spicesIncome) *
    (1 + state.perks.chain * PERK.chainIncome) *
    (1 + chefBonus(state, 'income')) *
    (state.purchases.golden_kitchen ? SHOP.goldenIncome : 1)
  );
}

// Section speed from the chefs (kitchen and waiters).
export function sectionRateMultiplier(state: Bonuses, section: string): number {
  if (section === 'kitchen') return 1 + chefBonus(state, 'kitchen');
  if (section === 'waiters') return 1 + chefBonus(state, 'waiters');
  return 1;
}

// Daily reward, task and chest money.
export function dailyMoneyMultiplier(state: Bonuses): number {
  return 1 + chefBonus(state, 'daily');
}

// Scene event rewards: the critic's review lasts longer and tour bus tips are bigger.
export function eventRewardMultiplier(state: Bonuses): number {
  return 1 + chefBonus(state, 'events');
}

// Local Suppliers make every upgrade and unlock cheaper.
export function costMultiplier(state: Bonuses): number {
  return (1 - LAB.suppliersDiscount) ** state.lab.levels.suppliers;
}

// Extra discount on restaurant section upgrades only (Restaurant Manager perk).
export function sectionCostMultiplier(state: Bonuses): number {
  return state.perks.manager > 0 ? 1 - PERK.managerDiscount : 1;
}

export function offlineCapSeconds(state: Bonuses): number {
  return (
    OFFLINE.baseCapSeconds +
    state.lab.levels.nightShift * LAB.nightShiftSeconds +
    chefBonus(state, 'offline') +
    state.safeLevel * SAFE.secondsPerLevel
  );
}

export function vipTipMultiplier(state: Bonuses): number {
  return 1 + state.lab.levels.tourGuide * LAB.tourGuideTip + chefBonus(state, 'vip');
}

// Scales the gap between VIP visits.
export function vipGapMultiplier(state: Bonuses): number {
  return Math.max(0.2, 1 - state.lab.levels.tourGuide * LAB.tourGuideSooner);
}

export function rushSeconds(state: Bonuses): number {
  return ADS.rushSeconds + state.lab.levels.eventPlanner * LAB.eventPlannerSeconds + chefBonus(state, 'rush');
}

export function rushMaxSeconds(state: Bonuses): number {
  return ADS.rushMaxSeconds + state.lab.levels.eventPlanner * LAB.eventPlannerMaxSeconds;
}

export function starGainMultiplier(state: Bonuses): number {
  return 1 + state.perks.brand * PERK.brandStars + chefBonus(state, 'stars');
}

export function researchSpeed(state: Bonuses): number {
  return 1 + state.perks.grant * PERK.grantSpeed + chefBonus(state, 'research');
}

export function labSlotCount(state: Bonuses): number {
  return 1 + state.perks.secondLab;
}
