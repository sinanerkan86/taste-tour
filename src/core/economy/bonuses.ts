import { ADS, LAB, OFFLINE, PERK, PERKS, PRESTIGE, RESEARCH, RESEARCH_IDS, PERK_IDS, type PerkId, type ResearchId } from './config';

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
}

// Every permanent income bonus together: Chef Stars, Secret Spices and Famous Chain.
export function incomeMultiplier(state: Bonuses): number {
  return (
    (1 + state.stars * PRESTIGE.bonusPerStar) *
    (1 + state.lab.levels.spices * LAB.spicesIncome) *
    (1 + state.perks.chain * PERK.chainIncome)
  );
}

// Local Suppliers make every upgrade and unlock cheaper.
export function costMultiplier(state: Bonuses): number {
  return (1 - LAB.suppliersDiscount) ** state.lab.levels.suppliers;
}

export function offlineCapSeconds(state: Bonuses): number {
  return OFFLINE.baseCapSeconds + state.lab.levels.nightShift * LAB.nightShiftSeconds;
}

export function vipTipMultiplier(state: Bonuses): number {
  return 1 + state.lab.levels.tourGuide * LAB.tourGuideTip;
}

// Scales the gap between VIP visits.
export function vipGapMultiplier(state: Bonuses): number {
  return Math.max(0.2, 1 - state.lab.levels.tourGuide * LAB.tourGuideSooner);
}

export function rushSeconds(state: Bonuses): number {
  return ADS.rushSeconds + state.lab.levels.eventPlanner * LAB.eventPlannerSeconds;
}

export function rushMaxSeconds(state: Bonuses): number {
  return ADS.rushMaxSeconds + state.lab.levels.eventPlanner * LAB.eventPlannerMaxSeconds;
}

export function starGainMultiplier(state: Bonuses): number {
  return 1 + state.perks.brand * PERK.brandStars;
}

export function researchSpeed(state: Bonuses): number {
  return 1 + state.perks.grant * PERK.grantSpeed;
}

export function labSlotCount(state: Bonuses): number {
  return 1 + state.perks.secondLab;
}
