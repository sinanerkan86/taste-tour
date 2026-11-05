// Demo game states for the Play Store screenshots (see screenshots.mjs). `before` runs right
// after the game loads, `action` just before the picture; both run in the page with `scene`
// set to the Restaurant scene.

const sections = (entrance, seating, kitchen, waiters, cashier, dishwashing) => ({
  entrance,
  seating,
  kitchen,
  waiters,
  cashier,
  dishwashing,
});

function economy(fields) {
  return {
    money: 0,
    lifetimeEarnings: 0,
    runEarnings: 0,
    runReputation: 0,
    stars: 0,
    city: 0,
    cityStars: [],
    rushSeconds: 0,
    timeSkipCooldown: 0,
    ...fields,
  };
}

const tokyo = economy({
  money: 4.2e9,
  lifetimeEarnings: 9.5e11,
  runEarnings: 2.1e10,
  runReputation: 2.1e10 / 4000,
  stars: 236,
  city: 6,
  cityStars: [14, 22, 31, 38, 59, 72],
  sectionLevels: sections(62, 58, 55, 57, 51, 53),
  dishLevels: [48, 40, 34, 27, 19, 8, 0],
  rushSeconds: 3 * 3600,
});

export const SHOTS = [
  {
    name: '01-restaurant',
    economy: economy({
      money: 3.4e5,
      lifetimeEarnings: 2.6e6,
      runEarnings: 2.6e6,
      runReputation: 2.6e6,
      sectionLevels: sections(34, 31, 28, 30, 26, 27),
      dishLevels: [32, 25, 18, 11, 4, 0, 0],
    }),
  },
  {
    name: '02-menu',
    economy: economy({
      money: 8.1e6,
      lifetimeEarnings: 6.3e8,
      runEarnings: 4.4e7,
      runReputation: 4.4e7 / 6,
      stars: 14,
      city: 1,
      cityStars: [14],
      sectionLevels: sections(41, 38, 36, 37, 33, 35),
      dishLevels: [44, 36, 29, 21, 13, 5, 0],
    }),
    action: `scene.panel.showTab('menu')`,
  },
  {
    name: '03-vip-guest',
    economy: tokyo,
    // The VIP walks in about 12 s after the load and waits 40 s near the door.
    before: `scene.vipCountdown = 12`,
  },
  {
    name: '04-world-tour',
    economy: tokyo,
    waitMs: 4000,
    action: `scene.openWorldMap()`,
    afterMs: 2500,
  },
  {
    name: '05-franchise',
    economy: economy({
      money: 7.7e8,
      lifetimeEarnings: 3.9e10,
      runEarnings: 9.8e9,
      // About 25 stars to gain: (reputation / 1.5e11) ^ (1/3).
      runReputation: 2.4e15,
      stars: 36,
      city: 2,
      cityStars: [14, 22],
      sectionLevels: sections(52, 50, 47, 49, 45, 46),
      dishLevels: [55, 47, 39, 31, 24, 16, 6],
    }),
    action: `scene.openFranchise()`,
  },
];
