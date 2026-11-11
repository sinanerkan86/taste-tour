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
  // ...and also by the lab and perk bonuses a player is expected to have gathered: costs in the
  // n-th city are multiplied by (1 + expectedBonusPerCity * n). Players ahead of that (more
  // research, better perks) get through faster.
  expectedBonusPerCity: 0.6,
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

// Scene events: something happens every few minutes of play (see events.ts and GDD 6e).
export const EVENTS = {
  // Seconds of play before the first event, and between events (random in the range).
  firstGapSeconds: 150,
  minGapSeconds: 240,
  maxGapSeconds: 360,
  critic: {
    // The critic stays this long; the player must raise customers/s to the target meanwhile.
    seconds: 60,
    // The target is what greedy bottleneck upgrades reach with this share of the money plus
    // this many seconds of income, but no more than maxGain times now (a handful of taps);
    // it must be at least minGain times now, or no critic comes.
    moneyShare: 0.5,
    incomeSeconds: 30,
    minGain: 1.05,
    maxGain: 1.3,
    // A good review: income multiplied by this for this long (it keeps running offline).
    reviewMultiplier: 1.5,
    reviewSeconds: 15 * 60,
  },
  tourBus: {
    seconds: 25,
    // Each tap during the bus tips this many seconds of income times the combo.
    tipSeconds: 1,
    // The combo goes up one step every `comboTaps` taps, up to `maxCombo`, and drops back to 1
    // after `comboResetMs` without a tap.
    comboTaps: 6,
    maxCombo: 5,
    comboResetMs: 1200,
    // The bus's tips can be doubled with a rewarded ad.
    adMultiplier: 2,
  },
  festival: {
    seconds: 180,
    // One dish of the menu sells for this many times its price.
    priceMultiplier: 3,
  },
};

export const OFFLINE = {
  // Offline earnings are capped to this many seconds at first.
  baseCapSeconds: 2 * 60 * 60,
};

const MINUTE = 60;
const HOUR = 60 * MINUTE;

// Kitchen Lab: research projects that take real time (they keep running while the game is
// closed) and give permanent bonuses that survive franchises. A finished project waits for the
// player to collect it, which gives a reason to come back.
export const RESEARCH_IDS = ['spices', 'suppliers', 'nightShift', 'tourGuide', 'eventPlanner'] as const;
export type ResearchId = (typeof RESEARCH_IDS)[number];

export interface ResearchConfig {
  // Seconds each next level takes; the list length is the max level.
  durations: number[];
}

export const RESEARCH: Record<ResearchId, ResearchConfig> = {
  // Short first steps teach the lab in the first session; later ones fill a night or a day.
  spices: { durations: [3, 15, 45, 90, 180, 300, 480, 720, 960, 1440].map((m) => m * MINUTE) },
  suppliers: { durations: [5, 20, 60, 120, 240, 360, 540, 720, 1080, 1440].map((m) => m * MINUTE) },
  nightShift: { durations: [10, 45, 120, 240, 480, 720].map((m) => m * MINUTE) },
  tourGuide: { durations: [15, 60, 180, 360, 720].map((m) => m * MINUTE) },
  eventPlanner: { durations: [30, 120, 360, 720].map((m) => m * MINUTE) },
};

export const LAB = {
  // Secret Spices: income +25% per level.
  spicesIncome: 0.25,
  // Local Suppliers: every upgrade and unlock costs 6% less per level (multiplied, not added).
  suppliersDiscount: 0.06,
  // Night Shift: offline earnings are counted for one more hour per level.
  nightShiftSeconds: HOUR,
  // Tour Guide: VIP guests tip 30% more and come 12% sooner per level.
  tourGuideTip: 0.3,
  tourGuideSooner: 0.12,
  // Event Planner: each Rush ad lasts one more hour, and Rush stacks three more hours, per level.
  eventPlannerSeconds: HOUR,
  eventPlannerMaxSeconds: 3 * HOUR,
};

// Franchise perks: each franchise lets the player pick one of a few perks. They are permanent.
export const PERK_IDS = ['manager', 'headStart', 'chain', 'brand', 'grant', 'secondLab'] as const;
export type PerkId = (typeof PERK_IDS)[number];

export const PERKS: Record<PerkId, { maxLevel: number }> = {
  manager: { maxLevel: 1 },
  headStart: { maxLevel: 3 },
  chain: { maxLevel: Infinity },
  brand: { maxLevel: 5 },
  grant: { maxLevel: 3 },
  secondLab: { maxLevel: 1 },
};

export const PERK = {
  // Perks offered at each franchise.
  offers: 3,
  // The first franchise always offers these, so the manager shows up early.
  firstOffers: ['manager', 'headStart', 'chain'] as PerkId[],
  // Manager: restaurant section upgrades cost this much less. It must never spend the player's
  // money by itself: choosing between an upgrade and saving for a dish is the game.
  managerDiscount: 0.3,
  // Head start: a new restaurant opens with every section at this level (per perk level).
  headStartLevels: [10, 25, 50],
  // Famous Chain: income +50% per level.
  chainIncome: 0.5,
  // Brand Value: franchises award 20% more stars per level.
  brandStars: 0.2,
  // Research Grant: lab projects run 25% faster per level.
  grantSpeed: 0.25,
};

// Chef collection: one famous chef per city of the tour (in CITIES order). Chef cards are earned
// while playing; enough cards recruit a chef and then level them up. Chefs are permanent and
// each one is good at one thing (GDD 6f).
export const CHEF_IDS = ['selim', 'giulia', 'amelie', 'karim', 'priya', 'malee', 'kenji', 'lucas', 'sofia', 'jordan'] as const;
export type ChefId = (typeof CHEF_IDS)[number];

export type ChefSkill =
  | 'income'
  | 'kitchen'
  | 'waiters'
  | 'offline'
  | 'daily'
  | 'events'
  | 'research'
  | 'vip'
  | 'rush'
  | 'stars';

// Each chef's skill, and what one level of it adds (a fraction, or seconds for offline and rush).
export const CHEFS: Record<ChefId, { skill: ChefSkill; perLevel: number }> = {
  selim: { skill: 'income', perLevel: 0.1 },
  giulia: { skill: 'kitchen', perLevel: 0.2 },
  amelie: { skill: 'waiters', perLevel: 0.2 },
  karim: { skill: 'offline', perLevel: 30 * MINUTE },
  priya: { skill: 'daily', perLevel: 0.2 },
  malee: { skill: 'events', perLevel: 0.2 },
  kenji: { skill: 'research', perLevel: 0.1 },
  lucas: { skill: 'vip', perLevel: 0.2 },
  sofia: { skill: 'rush', perLevel: 30 * MINUTE },
  jordan: { skill: 'stars', perLevel: 0.05 },
};

export const CHEF = {
  // Cards it takes to recruit a chef (level 1) and then to reach each next level; the list
  // length is the max level.
  cardsPerLevel: [1, 2, 3, 5, 8],
  // Cards for the chef of the city: per dish added to the menu, and when franchising out of it.
  dishCards: 1,
  franchiseCards: 3,
  // A good review from the food critic.
  criticCards: 1,
};

// In-app purchases (one-time products in Google Play). Ids are the Play product ids.
export const PRODUCT_IDS = ['no_ads', 'golden_kitchen', 'starter_pack'] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

export const SHOP = {
  // Golden Kitchen: income multiplied by this for good.
  goldenIncome: 2,
  // Starter pack: seconds of income at once, seconds of Rush (it may go past the usual cap) and
  // chef cards for the chef of the city.
  starter: { money: 2 * HOUR, rush: 8 * HOUR, cards: 5 },
};
