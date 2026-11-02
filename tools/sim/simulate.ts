// Balance simulation: a greedy "bot player" plays the economy from src/core and records pacing.
// It runs in Node (tools/sim/cli.ts) and in the browser (sim.html), so it must stay pure.
import {
  DISHES,
  PRESTIGE,
  SECTION_IDS,
  dishCost,
  earn,
  incomePerSecond,
  newEconomy,
  nextLockedDish,
  pendingStars,
  prestige,
  sectionRates,
  sectionUpgradeCost,
  starMultiplier,
  throughput,
  type EconomyState,
  type SectionId,
} from '../../src/core/economy';

export interface SimOptions {
  // Total simulated active play time.
  maxSeconds: number;
  maxCycles: number;
  // The bot franchises once the new stars would multiply its star bonus by this much.
  prestigeGain: number;
  // Extra income multiplier, e.g. 2 to model a permanently active Rush ad.
  incomeBoost: number;
  // Stop the first time no useful purchase is affordable within this many seconds (used for calibration).
  stopAfterWait: number;
}

export const DEFAULT_OPTIONS: SimOptions = {
  maxSeconds: 12 * 3600,
  maxCycles: 5,
  prestigeGain: 2,
  incomeBoost: 1,
  stopAfterWait: Infinity,
};

export interface Sample {
  time: number;
  cycle: number;
  income: number;
  bottleneck: SectionId;
}

export interface CycleResult {
  index: number;
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
  // Seconds into the cycle at which each dish was unlocked.
  dishUnlocks: { dish: string; time: number }[];
  finalSectionLevels: Record<SectionId, number>;
  finalDishLevels: number[];
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

  DISHES.forEach((dish, i) => {
    if (state.dishLevels[i] > 0 || i === nextLockedDish(state)) {
      options.push({ label: dish.id, targets: [dish.id], cost: dishCost(state, i), apply: (s) => s.dishLevels[i]++ });
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
      label: `${DISHES[next].id} to ${LOOKAHEAD_DISH_LEVEL}`,
      targets: Array<string>(LOOKAHEAD_DISH_LEVEL).fill(DISHES[next].id),
      cost,
      apply: (s) => (s.dishLevels[next] = LOOKAHEAD_DISH_LEVEL),
    });
  }
  return options;
}

function clone(state: EconomyState): EconomyState {
  return { ...state, sectionLevels: { ...state.sectionLevels }, dishLevels: [...state.dishLevels] };
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

  function newCycle(index: number, startTime: number, starsBefore: number): CycleResult {
    return {
      index,
      startTime,
      duration: 0,
      starsBefore,
      starsGained: 0,
      finalIncome: 0,
      purchases: 0,
      longestWait: 0,
      purchasesByTarget: {},
      bottleneckSeconds: emptyBottleneckTimes(),
      dishUnlocks: [{ dish: DISHES[0].id, time: 0 }],
      finalSectionLevels: { ...state.sectionLevels },
      finalDishLevels: [...state.dishLevels],
    };
  }

  const income = (s: EconomyState) => incomePerSecond(s) * options.incomeBoost;

  function advance(seconds: number): void {
    const inc = income(state);
    earn(state, inc * seconds);
    cycle.bottleneckSeconds[throughput(state).bottleneck] += seconds;
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
    cycles.push(cycle);
  }

  sample();
  while (time < options.maxSeconds) {
    const inc = income(state);

    // Time until the bot is willing to franchise.
    const targetStars = Math.ceil(((options.prestigeGain - 1) * starMultiplier(state.stars)) / PRESTIGE.bonusPerStar);
    const neededLifetime = (state.stars + targetStars) ** 2 * PRESTIGE.starDivisor;
    const timeToPrestige = Math.max(0, (neededLifetime - state.lifetimeEarnings) / inc);

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

    if (timeToPrestige <= bestWait || !best) {
      advance(timeToPrestige);
      cycle.starsGained = pendingStars(state);
      closeCycle();
      if (cycles.length >= options.maxCycles) break;
      state = prestige(state);
      cycle = newCycle(cycles.length, time, state.stars);
      lastSampleTime = -Infinity;
      sample();
      continue;
    }

    if (shortestWait > options.stopAfterWait) break;
    advance(bestWait);
    state.money = Math.max(0, state.money - best.cost);
    const lockedBefore = nextLockedDish(state);
    best.apply(state);
    if (lockedBefore >= 0 && state.dishLevels[lockedBefore] > 0) {
      cycle.dishUnlocks.push({ dish: DISHES[lockedBefore].id, time: time - cycle.startTime });
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
