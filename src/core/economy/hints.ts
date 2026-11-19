import type { SectionId } from './config';
import { SECTION_IDS } from './config';
import { nextMilestone } from './formulas';
import {
  canBuyRoofBar,
  canBuyValet,
  deliveryBuyPlan,
  deliveryCost,
  parkingBuyPlan,
  parkingCost,
  roofBarCost,
  safeUpgradeCost,
  sectionBuyPlan,
  terraceBuyPlan,
  terraceCost,
  valetCost,
  type BuyPlan,
} from './actions';
import { busStopBuyPlan, busStopCost } from './busStop';
import type { EconomyState } from './state';

// The upgrade rows that can carry a hint in the panel (one per row, sections by their id).
export type HintRow = SectionId | 'delivery' | 'safe' | 'parking' | 'valet' | 'busStop' | 'terrace' | 'roofBar';

// Whether the levels the money covers (at least the next one) reach the next milestone.
function reachesMilestone(state: EconomyState, level: number, plan: BuyPlan): boolean {
  const next = nextMilestone(level);
  return next !== null && plan.cost <= state.money && level + plan.levels >= next;
}

// Rows worth pointing at: something new or one-time that the money covers (the lot, valet, bus
// stop, delivery, terrace, roof bar, the first Night Safe level), or levels the money covers that
// reach the row's next milestone. A plain "one more level" gets no hint.
export function upgradeHints(state: EconomyState): Set<HintRow> {
  const hints = new Set<HintRow>();
  const can = (cost: number) => Number.isFinite(cost) && cost <= state.money;

  for (const id of SECTION_IDS) {
    if (reachesMilestone(state, state.sectionLevels[id], sectionBuyPlan(state, id, 'max'))) hints.add(id);
  }
  if (state.deliveryLevel === 0 ? can(deliveryCost(state)) : reachesMilestone(state, state.deliveryLevel, deliveryBuyPlan(state, 'max'))) hints.add('delivery');
  if (state.safeLevel === 0 && can(safeUpgradeCost(state))) hints.add('safe');
  if (state.parkingLevel === 0 ? can(parkingCost(state)) : reachesMilestone(state, state.parkingLevel, parkingBuyPlan(state, 'max'))) hints.add('parking');
  if (canBuyValet(state) && can(valetCost(state))) hints.add('valet');
  if (state.busStopLevel === 0 ? can(busStopCost(state)) : reachesMilestone(state, state.busStopLevel, busStopBuyPlan(state, 'max'))) hints.add('busStop');
  if (state.terraceLevel === 0 ? can(terraceCost(state)) : reachesMilestone(state, state.terraceLevel, terraceBuyPlan(state, 'max'))) hints.add('terrace');
  if (canBuyRoofBar(state) && can(roofBarCost(state))) hints.add('roofBar');
  return hints;
}
