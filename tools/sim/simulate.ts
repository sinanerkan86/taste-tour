// Balance simulation: a greedy "bot player" plays the economy from src/core and records pacing.
// It runs in Node (tools/sim/cli.ts) and in the browser (sim.html), so it must stay pure.
import {
  DISH_TIERS,
  PRESTIGE,
  RESEARCH_IDS,
  collectResearch,
  finishedResearch,
  passTime,
  researchDuration,
  perkOffers,
  startResearch,
  starGainMultiplier,
  type PerkId,
  type ResearchId,
  SECTION_IDS,
  canFranchise,
  cityConfig,
  cityCostScale,
  dishCost,
  deliveryCost,
  deliveryFlow,
  incomeBreakdown,
  earn,
  incomePerSecond,
  newEconomy,
  nextLockedDish,
  pendingStars,
  prestige,
  sectionRates,
  sectionUpgradeCost,
  throughput,
  type EconomyState,
  type SectionId,
} from '../../src/core/economy';

export interface SimOptions {
  // Total simulated active play time.
  maxSeconds: number;
  maxCycles: number;
  // Once the menu is complete, the bot stays until its stars per hour peak, times this factor.
  stayFactor: number;
  // Extra income multiplier, e.g. 2 to model a permanently active Rush ad.
  incomeBoost: number;
  // Stop the first time no useful purchase is affordable within this many seconds (used for calibration).
  stopAfterWait: number;
  // Real seconds per second of active play, for the Kitchen Lab (it also runs while the game is
  // closed): 4 means the player is in the game a quarter of the time. 0 turns the lab off.
  labTimeFactor: number;
  // Whether the bot picks franchise perks.
  perks: boolean;
}

// The bot researches whatever of these finishes soonest (the others do not change active play),
// and picks perks in this order (first one offered wins).
const RESEARCH_PRIORITY: ResearchId[] = ['spices', 'suppliers'];
const PERK_PRIORITY: PerkId[] = ['chain', 'brand', 'headStart', 'grant', 'secondLab', 'manager'];

export const DEFAULT_OPTIONS: SimOptions = {
  maxSeconds: 12 * 3600,
  maxCycles: 5,
  stayFactor: 1,
  incomeBoost: 1,
  stopAfterWait: Infinity,
  labTimeFactor: 4,
  perks: true,
};

export interface Sample {
  time: number;
  cycle: number;
  income: number;
  bottleneck: SectionId;
}

export interface CycleResult {
  index: number;
  city: string;
  startTime: number;
  duration: number;
  starsBefore: number;
  starsGained: number;
  finalIncome: number;
  purchases: number;
  longestWait: number;
  // How many times each section or dish was bought.
  purchasesByTarget: Record<string, number>;
  bottleneckSeconds: Record<SectionId, number>;
  // Seconds into the cycle at which each dish (menu position) was unlocked.
  dishUnlocks: { dish: number; time: number }[];
  finalSectionLevels: Record<SectionId, number>;
  finalDishLevels: number[];
  // Delivery: when it opened (seconds into the cycle), courier level and its share of income at
  // the end, and the share of time the kitchen held it back.
  deliveryOpened: number | null;
  finalDeliveryLevel: number;
  deliveryShare: number;
  deliveryKitchenSeconds: number;
  // Perk picked at the end of the cycle, and research levels at its end.
  perk: PerkId | null;
  labLevels: Record<ResearchId, number>;
}

export interface SimResult {
  options: SimOptions;
  cycles: CycleResult[];
  samples: Sample[];
}

const LOOKAHEAD_DISH_LEVEL = 10;

interface Option {
  label: string;
  // Sections and dishes this option levels up.
  targets: string[];
  cost: number;
  apply: (state: EconomyState) => void;
}

function candidates(state: EconomyState): Option[] {
  const options: Option[] = SECTION_IDS.map((id) => ({
    label: id,
    targets: [id],
    cost: sectionUpgradeCost(state, id),
    apply: (s) => s.sectionLevels[id]++,
  }));

  // When several sections tie for the bottleneck, upgrading one alone gains nothing,
  // so also offer upgrading all tied sections together.
  const rates = sectionRates(state);
  const min = Math.min(...SECTION_IDS.map((id) => rates[id]));
  const tied = SECTION_IDS.filter((id) => rates[id] <= min * (1 + 1e-9));
  if (tied.length > 1) {
    options.push({
      label: tied.join('+'),
      targets: tied,
      cost: tied.reduce((sum, id) => sum + sectionUpgradeCost(state, id), 0),
      apply: (s) => tied.forEach((id) => s.sectionLevels[id]++),
    });
  }

  options.push({ label: 'delivery', targets: ['delivery'], cost: deliveryCost(state), apply: (s) => s.deliveryLevel++ });

  DISH_TIERS.forEach((_, i) => {
    if (state.dishLevels[i] > 0 || i === nextLockedDish(state)) {
      options.push({ label: dishLabel(i), targets: [dishLabel(i)], cost: dishCost(state, i), apply: (s) => s.dishLevels[i]++ });
    }
  });

  // A fresh dish earns little at level 1; a player looks ahead to its first few levels.
  const next = nextLockedDish(state);
  if (next >= 0) {
    const after = clone(state);
    let cost = 0;
    while (after.dishLevels[next] < LOOKAHEAD_DISH_LEVEL) {
      cost += dishCost(after, next);
      after.dishLevels[next]++;
    }
    options.push({
      label: `${dishLabel(next)} to ${LOOKAHEAD_DISH_LEVEL}`,
      targets: Array<string>(LOOKAHEAD_DISH_LEVEL).fill(dishLabel(next)),
      cost,
      apply: (s) => (s.dishLevels[next] = LOOKAHEAD_DISH_LEVEL),
    });
  }
  return options;
}

// Cities have different dishes, so reports name dishes by menu position.
export function dishLabel(index: number): string {
  return `dish ${index + 1}`;
}

// Stars per second of the current run, without rounding down, after earning `extra` more.
function starRate(state: EconomyState, elapsed: number, extra = 0, extraTime = 0): number {
  const reputation = state.runReputation + extra / cityCostScale(state.city);
  return ((reputation / PRESTIGE.starDivisor) ** PRESTIGE.starExponent * starGainMultiplier(state)) / Math.max(elapsed + extraTime, 1);
}

function clone(state: EconomyState): EconomyState {
  return {
    ...state,
    sectionLevels: { ...state.sectionLevels },
    dishLevels: [...state.dishLevels],
    lab: { levels: { ...state.lab.levels }, slots: state.lab.slots.map((slot) => ({ ...slot })) },
    perks: { ...state.perks },
    chefs: structuredClone(state.chefs),
    purchases: { ...state.purchases },
  };
}

function emptyBottleneckTimes(): Record<SectionId, number> {
  return Object.fromEntries(SECTION_IDS.map((id) => [id, 0])) as Record<SectionId, number>;
}

export function simulate(partial: Partial<SimOptions> = {}): SimResult {
  const options = { ...DEFAULT_OPTIONS, ...partial };
  const cycles: CycleResult[] = [];
  const samples: Sample[] = [];

  let state = newEconomy();
  let time = 0;
  let cycle = newCycle(0, 0, 0);
  let lastSampleTime = -Infinity;
  // When this run's stars per hour peaked (null until then).
  let peakTime: number | null = null;

  function newCycle(index: number, startTime: number, starsBefore: number): CycleResult {
    return {
      index,
      city: cityConfig(state.city).id,
      startTime,
      duration: 0,
      starsBefore,
      starsGained: 0,
      finalIncome: 0,
      purchases: 0,
      longestWait: 0,
      purchasesByTarget: {},
      bottleneckSeconds: emptyBottleneckTimes(),
      dishUnlocks: [{ dish: 0, time: 0 }],
      finalSectionLevels: { ...state.sectionLevels },
      finalDishLevels: [...state.dishLevels],
      deliveryOpened: null,
      finalDeliveryLevel: 0,
      deliveryShare: 0,
      deliveryKitchenSeconds: 0,
      perk: null,
      labLevels: { ...state.lab.levels },
    };
  }

  const income = (s: EconomyState) => incomePerSecond(s) * options.incomeBoost;

  // Collects finished research and keeps every lab slot busy.
  function tendLab(): void {
    if (options.labTimeFactor <= 0) return;
    for (const id of finishedResearch(state)) collectResearch(state, id);
    const byDuration = (ids: ResearchId[]) => [...ids].sort((a, b) => researchDuration(state, a) - researchDuration(state, b));
    for (const id of [...byDuration(RESEARCH_PRIORITY), ...byDuration([...RESEARCH_IDS])]) startResearch(state, id);
  }

  // Active seconds until the next lab project finishes.
  function nextLabEvent(): number {
    if (options.labTimeFactor <= 0 || state.lab.slots.length === 0) return Infinity;
    return Math.min(...state.lab.slots.map((slot) => slot.remaining)) / options.labTimeFactor;
  }

  function advance(seconds: number): void {
    const inc = income(state);
    earn(state, inc * seconds);
    if (options.labTimeFactor > 0) passTime(state, seconds * options.labTimeFactor);
    cycle.bottleneckSeconds[throughput(state).bottleneck] += seconds;
    if (state.deliveryLevel > 0 && deliveryFlow(state).limitedBy === 'kitchen') cycle.deliveryKitchenSeconds += seconds;
    cycle.longestWait = Math.max(cycle.longestWait, seconds);
    time += seconds;
  }

  function sample(): void {
    if (time - lastSampleTime < 15) return;
    lastSampleTime = time;
    samples.push({ time, cycle: cycle.index, income: income(state), bottleneck: throughput(state).bottleneck });
  }

  function closeCycle(): void {
    cycle.duration = time - cycle.startTime;
    cycle.finalIncome = income(state);
    cycle.finalSectionLevels = { ...state.sectionLevels };
    cycle.finalDishLevels = [...state.dishLevels];
    cycle.finalDeliveryLevel = state.deliveryLevel;
    const split = incomeBreakdown(state);
    cycle.deliveryShare = split.delivery / Math.max(split.dineIn + split.delivery, 1e-300);
    cycle.labLevels = { ...state.lab.levels };
    cycles.push(cycle);
  }

  sample();
  while (time < options.maxSeconds) {
    tendLab();
    const inc = income(state);
    const elapsed = time - cycle.startTime;

    // Pick the purchase that pays for itself soonest, counting the time spent saving up for it.
    let best: Option | null = null;
    let bestScore = Infinity;
    let bestWait = 0;
    let shortestWait = Infinity;
    for (const option of candidates(state)) {
      const after = clone(state);
      option.apply(after);
      const gain = income(after) - inc;
      if (gain <= 0 || !Number.isFinite(option.cost)) continue;
      const wait = Math.max(0, (option.cost - state.money) / inc);
      shortestWait = Math.min(shortestWait, wait);
      const score = wait + option.cost / gain;
      if (score < bestScore) {
        best = option;
        bestScore = score;
        bestWait = wait;
      }
    }

    // Time until the bot is willing to franchise (Infinity while the menu is incomplete).
    let timeToPrestige = Infinity;
    if (canFranchise(state) || (nextLockedDish(state) < 0 && !best)) {
      const wait = best ? bestWait : 0;
      if (peakTime === null && (!best || starRate(state, elapsed, inc * wait, wait) < starRate(state, elapsed))) {
        peakTime = elapsed;
      }
      if (peakTime !== null) timeToPrestige = Math.max(0, peakTime * options.stayFactor - elapsed);
      // At least one star is needed to franchise.
      const reputationForOne = PRESTIGE.starDivisor - state.runReputation;
      timeToPrestige = Math.max(timeToPrestige, (reputationForOne * cityCostScale(state.city)) / inc);
    }

    // A lab project finishing first changes the numbers: go there and decide again.
    const labEvent = nextLabEvent();
    if (labEvent < Math.min(timeToPrestige, best ? bestWait : Infinity)) {
      advance(labEvent);
      continue;
    }

    if (timeToPrestige <= bestWait || !best) {
      if (!Number.isFinite(timeToPrestige)) break;
      advance(timeToPrestige);
      cycle.starsGained = pendingStars(state);
      closeCycle();
      const offers = options.perks ? perkOffers(state) : [];
      cycle.perk = PERK_PRIORITY.find((id) => offers.includes(id)) ?? null;
      if (cycles.length >= options.maxCycles) break;
      state = prestige(state, cycle.perk);
      cycle = newCycle(cycles.length, time, state.stars);
      lastSampleTime = -Infinity;
      peakTime = null;
      sample();
      continue;
    }

    if (shortestWait > options.stopAfterWait) break;
    advance(bestWait);
    state.money = Math.max(0, state.money - best.cost);
    const lockedBefore = nextLockedDish(state);
    if (best.label === 'delivery' && state.deliveryLevel === 0) cycle.deliveryOpened = time - cycle.startTime;
    best.apply(state);
    if (lockedBefore >= 0 && state.dishLevels[lockedBefore] > 0) {
      cycle.dishUnlocks.push({ dish: lockedBefore, time: time - cycle.startTime });
    }
    cycle.purchases++;
    for (const target of best.targets) {
      cycle.purchasesByTarget[target] = (cycle.purchasesByTarget[target] ?? 0) + 1;
    }
    sample();
  }

  if (cycles.length === 0 || cycles[cycles.length - 1] !== cycle) {
    cycle.starsGained = pendingStars(state);
    closeCycle();
  }
  return { options, cycles, samples };
}
