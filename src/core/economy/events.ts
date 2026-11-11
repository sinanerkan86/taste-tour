import { CHEF, EVENTS, type SectionId } from './config';
import { eventRewardMultiplier, incomeMultiplier } from './bonuses';
import { giveChefCards } from './chefs';
import { sectionUpgradeCost } from './actions';
import { baseIncomePerSecond, boostMultiplier, dishPrice, earn, throughput, type EconomyState } from './state';

// Scene events: every few minutes of play something happens in the restaurant (GDD 6e).
//  - critic: a food critic watches for a minute; raise customers/s to the target (fix the
//    bottleneck) and they write a good review, which boosts income for a while.
//  - tourBus: a coach of tourists; for a few seconds every tap tips income, with a combo.
//  - festival: the city celebrates one dish of the menu, which sells for more for a while.

export const EVENT_KINDS = ['critic', 'tourBus', 'festival'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

// Seconds of play until the next event; `random` is in [0, 1).
export function nextEventGap(random: number): number {
  return EVENTS.minGapSeconds + random * (EVENTS.maxGapSeconds - EVENTS.minGapSeconds);
}

// The customers/s the critic asks for: what the player could reach by spending part of their
// money (plus a little income) on the bottleneck, one level at a time. Null when that would not
// be a real step up (the critic then does not come).
export function criticTarget(state: EconomyState): number | null {
  const now = throughput(state).customersPerSecond;
  let budget = state.money * EVENTS.critic.moneyShare + baseIncomePerSecond(state) * EVENTS.critic.incomeSeconds;
  const levels = { ...state.sectionLevels };
  const trial: EconomyState = { ...state, sectionLevels: levels };
  const cap = now * EVENTS.critic.maxGain;
  for (let i = 0; i < 1000 && throughput(trial).customersPerSecond < cap; i++) {
    const id: SectionId = throughput(trial).bottleneck;
    const cost = sectionUpgradeCost(trial, id);
    if (cost > budget) break;
    budget -= cost;
    levels[id]++;
  }
  const target = Math.min(cap, throughput(trial).customersPerSecond);
  return target >= now * EVENTS.critic.minGain ? target : null;
}

// How far the player got toward the critic's target, 0 to 1.
export function criticProgress(state: EconomyState, start: number, target: number): number {
  if (target <= start) return 1;
  return Math.min(1, Math.max(0, (throughput(state).customersPerSecond - start) / (target - start)));
}

// How long a good review boosts income (Malee makes it last longer).
export function reviewDuration(state: EconomyState): number {
  return EVENTS.critic.reviewSeconds * eventRewardMultiplier(state);
}

// The good review: a timed income boost (a new review restarts the clock) and a chef card.
// Returns the cards given.
export function grantReview(state: EconomyState): number {
  state.reviewSeconds = Math.max(state.reviewSeconds, reviewDuration(state));
  return giveChefCards(state, CHEF.criticCards);
}

// Combo step for the n-th tap in a row (n from 1).
export function busCombo(taps: number): number {
  return Math.min(EVENTS.tourBus.maxCombo, 1 + Math.floor(Math.max(0, taps - 1) / EVENTS.tourBus.comboTaps));
}

// What one tap tips during the tour bus, Rush and review included.
export function busTip(state: EconomyState, combo: number): number {
  return baseIncomePerSecond(state) * boostMultiplier(state) * EVENTS.tourBus.tipSeconds * combo * eventRewardMultiplier(state);
}

// The extra income per second while a festival sells `dish` for more.
export function festivalBonusPerSecond(state: EconomyState, dish: number): number {
  if (!(state.dishLevels[dish] > 0)) return 0;
  const extra = dishPrice(state, dish) * (EVENTS.festival.priceMultiplier - 1);
  return throughput(state).customersPerSecond * extra * incomeMultiplier(state) * boostMultiplier(state);
}

// The dish a festival celebrates: one on the menu, picked at random.
export function pickFestivalDish(state: EconomyState, random: number): number {
  const menu = state.dishLevels.flatMap((level, i) => (level > 0 ? [i] : []));
  return menu[Math.min(menu.length - 1, Math.floor(random * menu.length))];
}

// Which event comes next: never the same twice in a row, and no critic without a reachable target.
export function pickEvent(state: EconomyState, random: number, last: EventKind | null): EventKind {
  const kinds = EVENT_KINDS.filter((kind) => kind !== last && (kind !== 'critic' || criticTarget(state) !== null));
  const pool = kinds.length > 0 ? kinds : EVENT_KINDS.filter((kind) => kind !== 'critic');
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
}

// Pays a tour bus tip.
export function payBusTip(state: EconomyState, combo: number): number {
  const amount = busTip(state, combo);
  earn(state, amount);
  return amount;
}
