import { describe, expect, it } from 'vitest';
import {
  CHEF,
  CHEF_IDS,
  DAILY,
  SHOP,
  baseIncomePerSecond,
  buyDish,
  canLevelUpChef,
  chefOfCity,
  chefsNeedAttention,
  claimChest,
  grantPurchase,
  grantReview,
  incomeMultiplier,
  levelUpChef,
  newEconomy,
  offlineCapSeconds,
  prestige,
  refreshDaily,
  rushSeconds,
  sectionRates,
} from '.';
import { createSave, parseSave, serializeSave } from '../save';

const MAX_CARDS = CHEF.cardsPerLevel.reduce((a, b) => a + b, 0);

describe('chef collection', () => {
  it('has one chef per city of the tour', () => {
    expect(chefOfCity(0)).toBe('selim');
    expect(chefOfCity(6)).toBe('kenji');
    expect(chefOfCity(CHEF_IDS.length + 1)).toBe('giulia');
  });

  it('adds a card to the pool for every new dish', () => {
    const state = newEconomy();
    state.money = 1e6;
    expect(buyDish(state, 1)).toBe(true);
    expect(state.chefs.pool).toBe(CHEF.dishCards);
    // Leveling an existing dish gives nothing.
    buyDish(state, 1);
    expect(state.chefs.pool).toBe(CHEF.dishCards);
  });

  it('lets the player spend the pool on any chef the tour has reached', () => {
    const state = newEconomy();
    state.city = 1;
    expect(canLevelUpChef(state, 'selim')).toBe(false);
    state.chefs.pool = 4;
    expect(chefsNeedAttention(state)).toBe(true);
    expect(levelUpChef(state, 'giulia')).toBe(true);
    expect(levelUpChef(state, 'giulia')).toBe(true);
    expect(state.chefs.levels.giulia).toBe(2);
    expect(state.chefs.pool).toBe(1);
    expect(levelUpChef(state, 'selim')).toBe(true);
    expect(state.chefs.pool).toBe(0);
    // Chefs of cities ahead cannot be recruited yet.
    state.chefs.pool = 10;
    expect(levelUpChef(state, 'amelie')).toBe(false);
  });

  it('stops at the max level', () => {
    const state = newEconomy();
    state.chefs.pool = MAX_CARDS + 5;
    while (levelUpChef(state, 'selim'));
    expect(state.chefs.levels.selim).toBe(CHEF.cardsPerLevel.length);
    expect(state.chefs.pool).toBe(5);
    expect(chefsNeedAttention(state)).toBe(false);
  });

  it('applies chef skills', () => {
    const state = newEconomy();
    const income = incomeMultiplier(state);
    const kitchen = sectionRates(state).kitchen;
    const offline = offlineCapSeconds(state);
    const rush = rushSeconds(state);
    state.chefs.levels.selim = 2;
    state.chefs.levels.giulia = 1;
    state.chefs.levels.karim = 1;
    state.chefs.levels.sofia = 1;
    expect(incomeMultiplier(state)).toBeCloseTo(income * 1.2);
    expect(sectionRates(state).kitchen).toBeCloseTo(kitchen * 1.2);
    expect(offlineCapSeconds(state)).toBe(offline + 30 * 60);
    expect(rushSeconds(state)).toBe(rush + 30 * 60);
  });

  it('pays cards from a good review and the daily chest', () => {
    const state = newEconomy();
    expect(grantReview(state)).toBe(CHEF.criticCards);
    refreshDaily(state, 100);
    state.daily.tasks.forEach((task) => {
      task.progress = task.target;
      task.claimed = true;
    });
    expect(claimChest(state)?.cards).toBe(DAILY.chest.cards);
    expect(state.chefs.pool).toBe(CHEF.criticCards + DAILY.chest.cards!);
  });

  it('keeps chefs and cards through a franchise and adds farewell cards', () => {
    const state = newEconomy();
    state.chefs.levels.selim = 2;
    state.chefs.pool = 2;
    state.dishLevels = state.dishLevels.map(() => 1);
    state.runReputation = 1e15;
    const next = prestige(state);
    expect(next.chefs.levels.selim).toBe(2);
    expect(next.chefs.pool).toBe(2 + CHEF.franchiseCards);
    expect(state.chefs.pool).toBe(2);
  });

  it('survives a save round trip and repairs bad values', () => {
    const state = newEconomy();
    state.chefs.levels.kenji = 3;
    state.chefs.pool = 4;
    state.purchases.no_ads = true;
    const loaded = parseSave(serializeSave(createSave(state, 0)))!;
    expect(loaded.economy.chefs.levels.kenji).toBe(3);
    expect(loaded.economy.chefs.pool).toBe(4);
    expect(loaded.economy.purchases.no_ads).toBe(true);
    const raw = JSON.parse(serializeSave(createSave(state, 0)));
    raw.economy.chefs.levels.kenji = 99;
    raw.economy.chefs.pool = -3;
    raw.economy.purchases.golden_kitchen = 'yes';
    const repaired = parseSave(JSON.stringify(raw))!;
    expect(repaired.economy.chefs.levels.kenji).toBe(CHEF.cardsPerLevel.length);
    expect(repaired.economy.chefs.pool).toBe(0);
    expect(repaired.economy.purchases.golden_kitchen).toBe(false);
  });
});

describe('chef cards for old saves', () => {
  it('pays the cards of finished cities and the dishes of the current one', () => {
    const state = newEconomy();
    state.city = 3;
    state.dishLevels = [5, 5, 5, 0, 0, 0, 0];
    // One card from a Cairo dish was already spent on recruiting Karim.
    state.chefs.levels.karim = 1;
    const raw = JSON.parse(serializeSave(createSave(state, 0)));
    raw.version = 1;
    const perCity = 6 * CHEF.dishCards + CHEF.franchiseCards;
    expect(parseSave(JSON.stringify(raw))!.economy.chefs.pool).toBe(3 * perCity + 1);
    // A current save is left alone.
    expect(parseSave(serializeSave(createSave(state, 0)))!.economy.chefs.pool).toBe(0);
  });

  it('moves cards kept per chef (1.3.0-1.4.x) into the pool', () => {
    const raw = JSON.parse(serializeSave(createSave(newEconomy(), 0)));
    raw.economy.chefs = { cards: { selim: 9, giulia: 4 }, levels: { selim: 1 } };
    const loaded = parseSave(JSON.stringify(raw))!.economy;
    expect(loaded.chefs.pool).toBe(13);
    expect(loaded.chefs.levels.selim).toBe(1);
  });
});

describe('shop', () => {
  it('doubles income with the Golden Kitchen', () => {
    const state = newEconomy();
    const before = baseIncomePerSecond(state);
    expect(grantPurchase(state, 'golden_kitchen')).not.toBeNull();
    expect(baseIncomePerSecond(state)).toBeCloseTo(before * SHOP.goldenIncome);
    expect(grantPurchase(state, 'golden_kitchen')).toBeNull();
  });

  it('pays the starter pack once', () => {
    const state = newEconomy();
    const income = baseIncomePerSecond(state);
    const granted = grantPurchase(state, 'starter_pack')!;
    expect(granted.money).toBeCloseTo(income * SHOP.starter.money);
    expect(state.rushSeconds).toBe(SHOP.starter.rush);
    expect(state.chefs.pool).toBe(SHOP.starter.cards);
    expect(grantPurchase(state, 'starter_pack')).toBeNull();
  });

  it('keeps purchases through a franchise', () => {
    const state = newEconomy();
    grantPurchase(state, 'no_ads');
    state.dishLevels = state.dishLevels.map(() => 1);
    state.runReputation = 1e15;
    expect(prestige(state).purchases.no_ads).toBe(true);
  });
});
