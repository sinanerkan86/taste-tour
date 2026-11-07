import { PERK, PERK_IDS, type PerkId, type SectionId } from './config';
import { perkMaxLevel } from './bonuses';
import { sectionUpgradeCost } from './actions';
import { baseIncomePerSecond, throughput, type EconomyState } from './state';

// Small deterministic random generator (mulberry32), so the perks offered at a franchise do
// not change when the game is reloaded.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ownedPerkLevels(state: EconomyState): number {
  return PERK_IDS.reduce((sum, id) => sum + state.perks[id], 0);
}

// The perks the player may pick from at this franchise (a different mix each time).
export function perkOffers(state: EconomyState): PerkId[] {
  const open = PERK_IDS.filter((id) => state.perks[id] < perkMaxLevel(id));
  const owned = ownedPerkLevels(state);
  if (owned === 0) return PERK.firstOffers.filter((id) => open.includes(id));
  const random = seeded(state.city * 7919 + owned * 104729 + 17);
  const pool = [...open];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, PERK.offers);
}

// Safety net: one call never buys more than this many levels.
const MANAGER_MAX_LEVELS = 100;

// The Manager perk: buys bottleneck levels that cost at most a few seconds of income, the cheap
// upgrades a player would buy anyway. Returns the sections it upgraded (one entry per level).
export function managerBuy(state: EconomyState): SectionId[] {
  const bought: SectionId[] = [];
  if (state.perks.manager <= 0) return bought;
  const budget = baseIncomePerSecond(state) * PERK.managerSeconds;
  while (bought.length < MANAGER_MAX_LEVELS) {
    const id = throughput(state).bottleneck;
    const cost = sectionUpgradeCost(state, id);
    if (cost > budget || cost > state.money) break;
    state.money -= cost;
    state.sectionLevels[id]++;
    bought.push(id);
  }
  return bought;
}
