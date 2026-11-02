// All tunable economy numbers live here. The balance simulation (tools/sim) reads the same data,
// so tuning happens in one place.

export const SECTION_IDS = ['entrance', 'seating', 'kitchen', 'waiters', 'cashier', 'dishwashing'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface SectionConfig {
  id: SectionId;
  // Customers per second at level 1.
  baseRate: number;
  // Cost of going from level 1 to level 2.
  baseCost: number;
  // Each next level costs this much more than the previous one.
  costGrowth: number;
}

export interface DishConfig {
  id: string;
  // Price per serving at level 1.
  basePrice: number;
  // Cost to add the dish to the menu (0 = on the menu from the start).
  unlockCost: number;
  // Cost of going from level 1 to level 2.
  baseUpgradeCost: number;
  costGrowth: number;
}

export const SECTIONS: Record<SectionId, SectionConfig> = {
  // Each section has its own cost curve, so the bottleneck moves around as the restaurant grows.
  entrance: { id: 'entrance', baseRate: 0.25, baseCost: 5, costGrowth: 1.2 },
  seating: { id: 'seating', baseRate: 0.3, baseCost: 8, costGrowth: 1.205 },
  kitchen: { id: 'kitchen', baseRate: 0.35, baseCost: 20, costGrowth: 1.215 },
  waiters: { id: 'waiters', baseRate: 0.28, baseCost: 12, costGrowth: 1.215 },
  cashier: { id: 'cashier', baseRate: 0.45, baseCost: 40, costGrowth: 1.22 },
  dishwashing: { id: 'dishwashing', baseRate: 0.5, baseCost: 60, costGrowth: 1.21 },
};

// Unlock costs are calibrated so each new dish arrives as growth from the previous one stalls.
export const DISHES: DishConfig[] = [
  { id: 'doner', basePrice: 2, unlockCost: 0, baseUpgradeCost: 15, costGrowth: 1.25 },
  { id: 'pizza', basePrice: 16, unlockCost: 500, baseUpgradeCost: 120, costGrowth: 1.25 },
  { id: 'taco', basePrice: 125, unlockCost: 7.5e7, baseUpgradeCost: 950, costGrowth: 1.25 },
  { id: 'burger', basePrice: 1e3, unlockCost: 3e9, baseUpgradeCost: 7.5e3, costGrowth: 1.25 },
  { id: 'ramen', basePrice: 8e3, unlockCost: 3e10, baseUpgradeCost: 6e4, costGrowth: 1.25 },
  { id: 'sushi', basePrice: 6.5e4, unlockCost: 3e11, baseUpgradeCost: 4.8e5, costGrowth: 1.25 },
  { id: 'paella', basePrice: 5e5, unlockCost: 3.3e12, baseUpgradeCost: 3.8e6, costGrowth: 1.25 },
];

// A dish stops leveling here ("mastered"), so growth has to come from new dishes.
export const DISH_MAX_LEVEL = 100;

// Reaching each of these levels multiplies the output of a section or the price of a dish.
export const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];
export const MILESTONE_BONUS = {
  section: 1.5,
  dish: 2,
};

export const PRESTIGE = {
  // stars = floor(sqrt(lifetimeEarnings / starDivisor))
  starDivisor: 1e12,
  // Each Chef Star adds this fraction to income (0.1 = +10%).
  bonusPerStar: 0.1,
};

export const TAP = {
  // A tap earns this fraction of one customer's bill. Strong while few customers come in,
  // negligible once the restaurant runs itself, so tapping fades out naturally.
  billFraction: 0.25,
};

export const OFFLINE = {
  // Offline earnings are capped to this many seconds at first.
  baseCapSeconds: 2 * 60 * 60,
};
