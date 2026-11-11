import { ADS, RESEARCH, RESEARCH_IDS, type ResearchId } from './config';
import { labSlotCount, researchMaxLevel, researchSpeed, type LabSlot } from './bonuses';
import type { EconomyState } from './state';

// Kitchen Lab: research runs on real time (passTime counts it down, also while the game is
// closed) and a finished project waits in its slot until the player collects it.

export function researchMaxed(state: EconomyState, id: ResearchId): boolean {
  return state.lab.levels[id] >= researchMaxLevel(id);
}

// Seconds the next level of a project takes, after the Research Grant perk.
export function researchDuration(state: EconomyState, id: ResearchId): number {
  const level = state.lab.levels[id];
  if (level >= researchMaxLevel(id)) return Infinity;
  return RESEARCH[id].durations[level] / researchSpeed(state);
}

export function researchSlot(state: EconomyState, id: ResearchId): LabSlot | null {
  return state.lab.slots.find((slot) => slot.research === id) ?? null;
}

export function freeLabSlots(state: EconomyState): number {
  return Math.max(0, labSlotCount(state) - state.lab.slots.length);
}

export function canStartResearch(state: EconomyState, id: ResearchId): boolean {
  return freeLabSlots(state) > 0 && !researchMaxed(state, id) && researchSlot(state, id) === null;
}

export function startResearch(state: EconomyState, id: ResearchId): boolean {
  if (!canStartResearch(state, id)) return false;
  state.lab.slots.push({ research: id, remaining: researchDuration(state, id) });
  return true;
}

// Whether an ad may cut the time left on this project: it runs, has not been sped up yet and
// has enough time left to be worth it.
export function canSpeedUpResearch(state: EconomyState, id: ResearchId): boolean {
  const slot = researchSlot(state, id);
  return slot !== null && !slot.spedUp && slot.remaining > ADS.labSpeedUpMinSeconds;
}

// Seconds an ad would take off the project.
export function researchSpeedUpSeconds(state: EconomyState, id: ResearchId): number {
  const slot = researchSlot(state, id);
  return slot ? slot.remaining * (1 - ADS.labSpeedUpFactor) : 0;
}

// The ad reward: cuts the time left on a running project (once per project level).
export function speedUpResearch(state: EconomyState, id: ResearchId): boolean {
  if (!canSpeedUpResearch(state, id)) return false;
  const slot = researchSlot(state, id)!;
  slot.remaining *= ADS.labSpeedUpFactor;
  slot.spedUp = true;
  return true;
}

// Projects that are done and waiting to be collected.
export function finishedResearch(state: EconomyState): ResearchId[] {
  return state.lab.slots.filter((slot) => slot.remaining <= 0).map((slot) => slot.research);
}

// Collects a finished project: its level goes up and the slot frees up.
export function collectResearch(state: EconomyState, id: ResearchId): boolean {
  const slot = researchSlot(state, id);
  if (!slot || slot.remaining > 0) return false;
  state.lab.slots = state.lab.slots.filter((s) => s !== slot);
  state.lab.levels[id]++;
  return true;
}

// True when the lab wants the player: a project is done, or a slot is free and something is left to research.
export function labNeedsAttention(state: EconomyState): boolean {
  if (finishedResearch(state).length > 0) return true;
  return RESEARCH_IDS.some((id) => canStartResearch(state, id));
}
