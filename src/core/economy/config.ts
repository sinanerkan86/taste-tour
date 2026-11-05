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

// Numbers for the n-th dish of a city's menu. Every city reuses them, scaled (see CITY).
export interface DishTier {
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
export const DISH_TIERS: DishTier[] = [
  { basePrice: 2, unlockCost: 0, baseUpgradeCost: 15, costGrowth: 1.25 },
  { basePrice: 16, unlockCost: 500, baseUpgradeCost: 120, costGrowth: 1.25 },
  { basePrice: 125, unlockCost: 7.5e7, baseUpgradeCost: 950, costGrowth: 1.25 },
  { basePrice: 1e3, unlockCost: 3e9, baseUpgradeCost: 7.5e3, costGrowth: 1.25 },
  { basePrice: 8e3, unlockCost: 3e10, baseUpgradeCost: 6e4, costGrowth: 1.25 },
  { basePrice: 6.5e4, unlockCost: 3e11, baseUpgradeCost: 4.8e5, costGrowth: 1.25 },
  { basePrice: 5e5, unlockCost: 3.3e12, baseUpgradeCost: 3.8e6, costGrowth: 1.25 },
];

export interface CityConfig {
  id: string;
  // Dish ids in menu order, one per DISH_TIERS entry: well-known dishes of that city's own cuisine,
  // from street food to the main courses, ending with a signature dessert.
  dishes: string[];
}

// Franchising moves to the next city. After the last one the list starts over (with ever
// bigger numbers), so new cities can be added as content updates.
export const CITIES: CityConfig[] = [
  { id: 'istanbul', dishes: ['doner', 'lahmacun', 'pide', 'kofte', 'manti', 'iskender', 'baklava'] },
  { id: 'rome', dishes: ['bruschetta', 'pizza', 'carbonara', 'lasagna', 'risotto', 'ossobuco', 'tiramisu'] },
  { id: 'paris', dishes: ['croissant', 'crepe', 'croqueMonsieur', 'quiche', 'ratatouille', 'coqAuVin', 'cremeBrulee'] },
  { id: 'cairo', dishes: ['falafel', 'foulMedames', 'koshari', 'shawarma', 'mahshi', 'fattah', 'omAli'] },
  { id: 'mumbai', dishes: ['samosa', 'pavBhaji', 'masalaDosa', 'butterChicken', 'tandoori', 'biryani', 'gulabJamun'] },
  { id: 'bangkok', dishes: ['springRolls', 'satay', 'somTam', 'padThai', 'tomYum', 'greenCurry', 'mangoStickyRice'] },
  { id: 'tokyo', dishes: ['gyoza', 'ramen', 'tempura', 'tonkatsu', 'sukiyaki', 'sushi', 'mochi'] },
  { id: 'rio', dishes: ['paoDeQueijo', 'coxinha', 'acai', 'moqueca', 'feijoada', 'churrasco', 'brigadeiro'] },
  { id: 'mexicoCity', dishes: ['taco', 'quesadilla', 'guacamole', 'tamales', 'enchiladas', 'mole', 'churros'] },
  { id: 'newYork', dishes: ['hotDog', 'bagel', 'burger', 'buffaloWings', 'pastrami', 'steak', 'cheesecake'] },
];

export const CITY = {
  // Prices in each city are this much higher than in the previous one (bigger numbers feel like progress).
  priceStep: 1000,
  // Costs grow on top of that by the star bonus a player is expected to bring along, so every city
  // takes about as long as the first one. Players with more stars than this get through faster.
  expectedStarsPerCity: 10,
};

// A dish stops leveling here ("mastered"), so growth has to come from new dishes.
export const DISH_MAX_LEVEL = 100;

// Reaching each of these levels multiplies the output of a section or the price of a dish.
export const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];
export const MILESTONE_BONUS = {
  section: 1.5,
  dish: 2,
};

export const PRESTIGE = {
  // Stars a franchise awards = floor((run reputation / starDivisor) ^ starExponent), where reputation
  // is the run's earnings measured in the city's own cost scale.
  // A cube root rewards staying longer less and less, so moving on to the next city wins in the end.
  // Tuned so an on-pace city gives CITY.expectedStarsPerCity stars after about 1.5 hours.
  starDivisor: 1.5e11,
  starExponent: 1 / 3,
  // Each Chef Star adds this fraction to income (0.1 = +10%).
  bonusPerStar: 0.1,
};

export const TAP = {
  // A tap earns this fraction of one customer's bill. Strong while few customers come in,
  // negligible once the restaurant runs itself, so tapping fades out naturally.
  billFraction: 0.25,
};

// Rewards for watching a rewarded ad.
export const ADS = {
  // Rush: income is multiplied by this while rush time is left.
  rushMultiplier: 2,
  rushSeconds: 4 * 60 * 60,
  // Rush time stacks up to this much.
  rushMaxSeconds: 12 * 60 * 60,
  // Time skip: earn this many seconds of income at once, then wait for the cooldown.
  timeSkipSeconds: 60 * 60,
  timeSkipCooldownSeconds: 30 * 60,
  // Offline earnings collected with an ad are multiplied by this.
  offlineMultiplier: 2,
  // VIP guest: shows up now and then and tips this many seconds of (non-Rush) income for an ad.
  vipTipSeconds: 15 * 60,
  // Seconds of play between VIP visits (random in this range), and how long a VIP waits.
  vipMinGapSeconds: 8 * 60,
  vipMaxGapSeconds: 12 * 60,
  vipFirstGapSeconds: 4 * 60,
  vipStaySeconds: 40,
};

export const OFFLINE = {
  // Offline earnings are capped to this many seconds at first.
  baseCapSeconds: 2 * 60 * 60,
};
