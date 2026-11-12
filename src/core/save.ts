import {
  CHEF,
  CHEF_IDS,
  DAILY,
  WEEKLY,
  PRODUCT_IDS,
  SAFE,
  chefMaxLevel,
  cardsSpentOn,
  DISH_TIERS,
  PERK_IDS,
  TASK_KINDS,
  RESEARCH_IDS,
  SECTION_IDS,
  cityCostScale,
  earningsOver,
  labSlotCount,
  offlineCapSeconds,
  newEconomy,
  perkMaxLevel,
  researchMaxLevel,
  type DailyTask,
  type EconomyState,
  type LabSlot,
  type ResearchId,
} from './economy';

// 2: chef collection (saves from version 1 get the chef cards their past cities would have given).
export const SAVE_VERSION = 2;

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
    staffCooldown: Math.max(0, finiteOr(saved.staffCooldown, 0)),
    reviewSeconds: Math.max(0, finiteOr(saved.reviewSeconds, 0)),
    lab: fresh.lab,
    perks: fresh.perks,
    daily: fresh.daily,
    chefs: fresh.chefs,
    purchases: fresh.purchases,
    safeLevel: 0,
    deliveryLevel: Math.max(0, Math.floor(finiteOr(saved.deliveryLevel, 0))),
  };
  for (const id of CHEF_IDS) {
    economy.chefs.levels[id] = Math.min(chefMaxLevel(), Math.max(0, Math.floor(finiteOr(saved.chefs?.levels?.[id], 0))));
  }
  economy.chefs.pool = Math.max(0, Math.floor(finiteOr(saved.chefs?.pool, 0)));
  // Saves from 1.3.0-1.4.x kept cards per chef: they all go into the shared pool.
  const perChef = (saved.chefs as { cards?: Record<string, unknown> } | undefined)?.cards;
  if (typeof perChef === 'object' && perChef !== null) {
    for (const value of Object.values(perChef)) economy.chefs.pool += Math.max(0, Math.floor(finiteOr(value, 0)));
  }
  for (const id of PRODUCT_IDS) economy.purchases[id] = saved.purchases?.[id] === true;
  economy.safeLevel = Math.min(SAFE.costs.length, Math.max(0, Math.floor(finiteOr(saved.safeLevel, 0))));
  for (const id of PERK_IDS) {
    economy.perks[id] = Math.min(perkMaxLevel(id), Math.max(0, Math.floor(finiteOr(saved.perks?.[id], 0))));
  }
  for (const id of RESEARCH_IDS) {
    economy.lab.levels[id] = Math.min(researchMaxLevel(id), Math.max(0, Math.floor(finiteOr(saved.lab?.levels?.[id], 0))));
  }
  // Running projects: known, not maxed, one slot each, no more than the slots the perks allow.
  const slots = Array.isArray(saved.lab?.slots) ? (saved.lab.slots as Partial<LabSlot>[]) : [];
  for (const slot of slots) {
    const id = slot?.research as ResearchId;
    if (!RESEARCH_IDS.includes(id) || economy.lab.slots.some((s) => s.research === id)) continue;
    if (economy.lab.levels[id] >= researchMaxLevel(id) || economy.lab.slots.length >= labSlotCount(economy)) continue;
    economy.lab.slots.push({ research: id, remaining: Math.max(0, finiteOr(slot.remaining, 0)), ...(slot.spedUp === true && { spedUp: true }) });
  }
  for (const id of SECTION_IDS) {
    economy.sectionLevels[id] = Math.max(1, Math.floor(finiteOr(saved.sectionLevels?.[id], 1)));
  }
  DISH_TIERS.forEach((_, i) => {
    economy.dishLevels[i] = Math.max(fresh.dishLevels[i], Math.floor(finiteOr(saved.dishLevels?.[i], 0)));
  });

  // Daily rewards and tasks (saves from before them start fresh).
  const daily = saved.daily;
  if (typeof daily === 'object' && daily !== null) {
    economy.daily.streak = Math.max(0, Math.floor(finiteOr(daily.streak, 0)));
    economy.daily.lastClaimDay = Math.floor(finiteOr(daily.lastClaimDay, -1));
    economy.daily.taskDay = Math.floor(finiteOr(daily.taskDay, -1));
    economy.daily.chestClaimed = daily.chestClaimed === true;
    economy.daily.tasks = parseTasks(daily.tasks, DAILY.taskRewards.length);
    // A broken task list is rolled again.
    if (economy.daily.tasks.length !== DAILY.taskRewards.length) economy.daily.taskDay = -1;
    // Weekly tasks and the streak saver (saves from before them roll this week's tasks).
    economy.daily.week = Math.floor(finiteOr(daily.week, -1));
    economy.daily.weeklyChestClaimed = daily.weeklyChestClaimed === true;
    economy.daily.saverWeek = Math.floor(finiteOr(daily.saverWeek, -1));
    economy.daily.weeklyTasks = parseTasks(daily.weeklyTasks, WEEKLY.taskCount);
    if (economy.daily.weeklyTasks.length !== WEEKLY.taskCount) economy.daily.week = -1;
  }

  if (finiteOr(data.version, 1) < 2) backPayChefCards(economy);

  const seenHints = Array.isArray(data.seenHints) ? data.seenHints.filter((id) => typeof id === 'string') : [];

  return { version: SAVE_VERSION, savedAt: finiteOr(data.savedAt, Date.now()), economy, seenHints };
}

// A saved task list: known kinds only, sane numbers, at most `count` tasks.
function parseTasks(value: unknown, count: number): DailyTask[] {
  const tasks = Array.isArray(value) ? (value as Partial<DailyTask>[]) : [];
  return tasks
    .slice(0, count)
    .filter((task) => TASK_KINDS.includes(task?.kind as DailyTask['kind']))
    .map((task) => {
      const target = Math.max(1, finiteOr(task.target, 1));
      return {
        kind: task.kind as DailyTask['kind'],
        target,
        progress: Math.min(target, Math.max(0, finiteOr(task.progress, 0))),
        claimed: task.claimed === true,
      };
    });
}

// Saves from before the chef collection: every finished city pays the cards it would have given
// (its dishes and the franchise), and the current city's dishes already on the menu are paid
// unless the cards held and spent already cover them (cards given since the update).
function backPayChefCards(economy: EconomyState): void {
  const perCity = (DISH_TIERS.length - 1) * CHEF.dishCards + CHEF.franchiseCards;
  const unlocked = economy.dishLevels.filter((level, i) => level > 0 && DISH_TIERS[i].unlockCost > 0).length;
  const had = economy.chefs.pool + CHEF_IDS.reduce((sum, id) => sum + cardsSpentOn(economy, id), 0);
  economy.chefs.pool += economy.city * perCity + Math.max(0, unlocked * CHEF.dishCards - had);
}

export interface OfflineReward {
  // Seconds that count toward the reward (after the cap).
  seconds: number;
  // The cap that applied (Night Shift research raises it).
  capSeconds: number;
  // Real time away, for display.
  secondsAway: number;
  amount: number;
}

// What the restaurant earned while the game was not running. A clock set backwards counts as zero.
export function offlineReward(
  economy: EconomyState,
  awaySince: number,
  now: number,
  capSeconds: number = offlineCapSeconds(economy),
): OfflineReward {
  const secondsAway = Math.max(0, (now - awaySince) / 1000);
  const seconds = Math.min(secondsAway, capSeconds);
  // Rush keeps running while the player is away.
  return { seconds, capSeconds, secondsAway, amount: earningsOver(economy, seconds) };
}
