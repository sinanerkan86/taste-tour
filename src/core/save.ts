import {
  DISH_TIERS,
  OFFLINE,
  SECTION_IDS,
  cityCostScale,
  earningsOver,
  newEconomy,
  type EconomyState,
} from './economy';

export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  // Wall-clock time (ms since epoch) when the save was written.
  savedAt: number;
  economy: EconomyState;
  // Ids of one-time hints the player has already seen.
  seenHints: string[];
}

export function createSave(economy: EconomyState, now: number, seenHints: string[] = []): SaveData {
  return { version: SAVE_VERSION, savedAt: now, economy, seenHints: [...seenHints] };
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data);
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// Parses and repairs a save. Missing sections or dishes (added in later versions) get
// their starting values. Returns null if the data is unusable.
export function parseSave(json: string): SaveData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Partial<SaveData>;
  const saved = data.economy as Partial<EconomyState> | undefined;
  if (typeof saved !== 'object' || saved === null) return null;

  const fresh = newEconomy();
  const city = Math.max(0, Math.floor(finiteOr(saved.city, 0)));
  const runEarnings = Math.max(0, finiteOr(saved.runEarnings, 0));
  const economy: EconomyState = {
    money: Math.max(0, finiteOr(saved.money, 0)),
    lifetimeEarnings: Math.max(0, finiteOr(saved.lifetimeEarnings, 0)),
    runEarnings,
    // Saves from before cities existed only have run earnings.
    runReputation: Math.max(0, finiteOr(saved.runReputation, runEarnings / cityCostScale(city))),
    stars: Math.max(0, Math.floor(finiteOr(saved.stars, 0))),
    city,
    // One entry per finished city; saves from before the world map count those cities as 0.
    cityStars: Array.from({ length: city }, (_, i) => Math.max(0, Math.floor(finiteOr(saved.cityStars?.[i], 0)))),
    sectionLevels: { ...fresh.sectionLevels },
    dishLevels: [...fresh.dishLevels],
    rushSeconds: Math.max(0, finiteOr(saved.rushSeconds, 0)),
    timeSkipCooldown: Math.max(0, finiteOr(saved.timeSkipCooldown, 0)),
  };
  for (const id of SECTION_IDS) {
    economy.sectionLevels[id] = Math.max(1, Math.floor(finiteOr(saved.sectionLevels?.[id], 1)));
  }
  DISH_TIERS.forEach((_, i) => {
    economy.dishLevels[i] = Math.max(fresh.dishLevels[i], Math.floor(finiteOr(saved.dishLevels?.[i], 0)));
  });

  const seenHints = Array.isArray(data.seenHints) ? data.seenHints.filter((id) => typeof id === 'string') : [];

  return { version: SAVE_VERSION, savedAt: finiteOr(data.savedAt, Date.now()), economy, seenHints };
}

export interface OfflineReward {
  // Seconds that count toward the reward (after the cap).
  seconds: number;
  // Real time away, for display.
  secondsAway: number;
  amount: number;
}

// What the restaurant earned while the game was not running. A clock set backwards counts as zero.
export function offlineReward(
  economy: EconomyState,
  awaySince: number,
  now: number,
  capSeconds: number = OFFLINE.baseCapSeconds,
): OfflineReward {
  const secondsAway = Math.max(0, (now - awaySince) / 1000);
  const seconds = Math.min(secondsAway, capSeconds);
  // Rush keeps running while the player is away.
  return { seconds, secondsAway, amount: earningsOver(economy, seconds) };
}
