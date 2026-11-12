// Usage: npm run sim [-- --boost 2 --hours 12 --cycles 5 --stay 1.5 --lab 4 --perks 1]
import { DISH_TIERS, RESEARCH_IDS, SECTION_IDS } from '../../src/core/economy';
import { formatDuration, formatNumber } from '../../src/core/format';
import { dishLabel, simulate, type SimOptions } from './simulate';

function parseArgs(argv: string[]): Partial<SimOptions> {
  const options: Partial<SimOptions> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const value = Number(argv[i + 1]);
    if (argv[i] === '--boost') options.incomeBoost = value;
    if (argv[i] === '--hours') options.maxSeconds = value * 3600;
    if (argv[i] === '--cycles') options.maxCycles = value;
    if (argv[i] === '--stay') options.stayFactor = value;
    if (argv[i] === '--lab') options.labTimeFactor = value;
    if (argv[i] === '--perks') options.perks = value !== 0;
  }
  return options;
}

const result = simulate(parseArgs(process.argv.slice(2)));

console.log('\nCycles');
console.table(
  result.cycles.map((c) => ({
    cycle: c.index + 1,
    city: c.city,
    duration: formatDuration(c.duration),
    'stars before': c.starsBefore,
    'stars gained': c.starsGained,
    'final income/s': formatNumber(c.finalIncome),
    purchases: c.purchases,
    'longest wait': formatDuration(c.longestWait),
    perk: c.perk ?? '-',
    lab: RESEARCH_IDS.map((id) => c.labLevels[id]).join('/'),
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
      ...DISH_TIERS.map((_, i) => {
        const unlock = c.dishUnlocks.find((u) => u.dish === i);
        return [dishLabel(i), unlock ? formatDuration(unlock.time) : '-'];
      }),
    ]),
  ),
);

console.log('Delivery');
console.table(
  result.cycles.map((c) => ({
    cycle: c.index + 1,
    opened: c.deliveryOpened === null ? '-' : formatDuration(c.deliveryOpened),
    level: c.finalDeliveryLevel,
    'share of income at the end (%)': Math.round(c.deliveryShare * 100),
    'kitchen-limited time (%)': Math.round((c.deliveryKitchenSeconds / c.duration) * 100),
    'courier upgrades (%)': Math.round(((c.purchasesByTarget.delivery ?? 0) / Math.max(c.purchases, 1)) * 100),
  })),
);

console.log('Parking');
console.table(
  result.cycles.map((c) => ({
    cycle: c.index + 1,
    opened: c.parkingOpened === null ? '-' : formatDuration(c.parkingOpened),
    level: c.finalParkingLevel,
    valet: c.valetBought === null ? '-' : formatDuration(c.valetBought),
    'bill bonus at the end (%)': Math.round((c.carBillMultiplier - 1) * 100),
    'parking upgrades (%)': Math.round(((c.purchasesByTarget.parking ?? 0) / Math.max(c.purchases, 1)) * 100),
  })),
);

console.log('Bus stop');
console.table(
  result.cycles.map((c) => ({
    cycle: c.index + 1,
    opened: c.busOpened === null ? '-' : formatDuration(c.busOpened),
    level: c.finalBusLevel,
    'share of income at the end (%)': Math.round(c.busShare * 100),
    'seat-limited time (%)': Math.round((c.busSeatSeconds / c.duration) * 100),
    'bus upgrades (%)': Math.round(((c.purchasesByTarget.bus ?? 0) / Math.max(c.purchases, 1)) * 100),
  })),
);

console.log('Final levels');
console.table(
  result.cycles.map((c) =>
    Object.fromEntries([
      ['cycle', c.index + 1],
      ...SECTION_IDS.map((id) => [id, c.finalSectionLevels[id]]),
      ...DISH_TIERS.map((_, i) => [dishLabel(i), c.finalDishLevels[i]]),
    ]),
  ),
);
