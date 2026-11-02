// Usage: npm run sim [-- --boost 2 --hours 12 --cycles 5 --gain 2]
import { DISHES, SECTION_IDS } from '../../src/core/economy';
import { formatDuration, formatNumber } from '../../src/core/format';
import { simulate, type SimOptions } from './simulate';

function parseArgs(argv: string[]): Partial<SimOptions> {
  const options: Partial<SimOptions> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const value = Number(argv[i + 1]);
    if (argv[i] === '--boost') options.incomeBoost = value;
    if (argv[i] === '--hours') options.maxSeconds = value * 3600;
    if (argv[i] === '--cycles') options.maxCycles = value;
    if (argv[i] === '--gain') options.prestigeGain = value;
  }
  return options;
}

const result = simulate(parseArgs(process.argv.slice(2)));

console.log('\nCycles');
console.table(
  result.cycles.map((c) => ({
    cycle: c.index + 1,
    duration: formatDuration(c.duration),
    'stars before': c.starsBefore,
    'stars gained': c.starsGained,
    'final income/s': formatNumber(c.finalIncome),
    purchases: c.purchases,
    'longest wait': formatDuration(c.longestWait),
  })),
);

console.log('Bottleneck share of time (%)');
console.table(
  result.cycles.map((c) =>
    Object.fromEntries([
      ['cycle', c.index + 1],
      ...SECTION_IDS.map((id) => [id, Math.round((c.bottleneckSeconds[id] / c.duration) * 100)]),
    ]),
  ),
);

console.log('Upgrades bought per section (%)');
console.table(
  result.cycles.map((c) => {
    const total = SECTION_IDS.reduce((sum, id) => sum + (c.purchasesByTarget[id] ?? 0), 0);
    return Object.fromEntries([
      ['cycle', c.index + 1],
      ...SECTION_IDS.map((id) => [id, Math.round(((c.purchasesByTarget[id] ?? 0) / total) * 100)]),
    ]);
  }),
);

console.log('Dish unlock time within cycle');
console.table(
  result.cycles.map((c) =>
    Object.fromEntries([
      ['cycle', c.index + 1],
      ...DISHES.map((d) => {
        const unlock = c.dishUnlocks.find((u) => u.dish === d.id);
        return [d.id, unlock ? formatDuration(unlock.time) : '-'];
      }),
    ]),
  ),
);

console.log('Final levels');
console.table(
  result.cycles.map((c) =>
    Object.fromEntries([
      ['cycle', c.index + 1],
      ...SECTION_IDS.map((id) => [id, c.finalSectionLevels[id]]),
      ...DISHES.map((d, i) => [d.id, c.finalDishLevels[i]]),
    ]),
  ),
);
