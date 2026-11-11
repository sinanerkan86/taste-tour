import { describe, expect, it } from 'vitest';
import {
  CHEF,
  CHEF_IDS,
  DAILY,
  SHOP,
  baseIncomePerSecond,
  buyDish,
  canLevelUpChef,
  cardTarget,
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
  type EconomyState,
} from '.';
import { createSave, parseSave, serializeSave } from '../save';

function maxChef(state: EconomyState, id: (typeof CHEF_IDS)[number]): void {
  state.chefs.cards[id] = CHEF.cardsPerLevel.reduce((a, b) => a + b, 0);
  while (levelUpChef(state, id));
}

describe('chef collection', () => {
  it('has one chef per city of the tour', () => {
    expect(chefOfCity(0)).toBe('selim');
    expect(chefOfCity(6)).toBe('kenji');
    expect(chefOfCity(CHEF_IDS.length + 1)).toBe('giulia');
  });

  it('gives the city chef a card for every new dish', () => {
    const state = newEconomy();
    state.money = 1e6;
    expect(buyDish(state, 1)).toBe(true);
    expect(state.chefs.cards.selim).toBe(CHEF.dishCards);
    // Leveling an existing dish gives nothing.
    buyDish(state, 1);
    expect(state.chefs.cards.selim).toBe(CHEF.dishCards);
  });

  it('recruits and levels up with cards', () => {
    const state = newEconomy();
    expect(canLevelUpChef(state, 'selim')).toBe(false);
    state.chefs.cards.selim = 3;
    expect(chefsNeedAttention(state)).toBe(true);
    expect(levelUpChef(state, 'selim')).toBe(true);
    expect(levelUpChef(state, 'selim')).toBe(true);
    expect(state.chefs.levels.selim).toBe(2);
    expect(state.chefs.cards.selim).toBe(0);
    expect(levelUpChef(state, 'selim')).toBe(false);
  });

  it('stops at the max level', () => {
    const state = newEconomy();
    maxChef(state, 'selim');
    expect(state.chefs.levels.selim).toBe(CHEF.cardsPerLevel.length);
    expect(state.chefs.cards.selim).toBe(0);
    expect(levelUpChef(state, 'selim')).toBe(false);
  });

  it('sends spare cards to the met chef furthest from max level', () => {
    const state = newEconomy();
    state.city = 2;
    maxChef(state, 'amelie');
    state.chefs.levels.selim = 3;
    expect(cardTarget(state)).toBe('giulia');
    maxChef(state, 'giulia');
    expect(cardTarget(state)).toBe('selim');
    maxChef(state, 'selim');
    expect(cardTarget(state)).toBeNull();
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
    expect(grantReview(state)).toBe('selim');
    expect(state.chefs.cards.selim).toBe(CHEF.criticCards);
    refreshDaily(state, 100);
    state.daily.tasks.forEach((task) => {
      task.progress = task.target;
      task.claimed = true;
    });
    const granted = claimChest(state);
    expect(granted?.cards).toBe(DAILY.chest.cards);
    expect(state.chefs.cards.selim).toBe(CHEF.criticCards + DAILY.chest.cards!);
  });

  it('keeps chefs through a franchise and adds farewell cards', () => {
    const state = newEconomy();
    state.chefs.levels.selim = 2;
    state.dishLevels = state.dishLevels.map(() => 1);
    state.runReputation = 1e15;
    const next = prestige(state);
    expect(next.chefs.levels.selim).toBe(2);
    expect(next.chefs.cards.selim).toBe(CHEF.franchiseCards);
    expect(state.chefs.cards.selim).toBe(0);
  });

  it('survives a save round trip and repairs bad values', () => {
    const state = newEconomy();
    state.chefs.levels.kenji = 3;
    state.chefs.cards.kenji = 4;
    state.purchases.no_ads = true;
    const loaded = parseSave(serializeSave(createSave(state, 0)))!;
    expect(loaded.economy.chefs.levels.kenji).toBe(3);
    expect(loaded.economy.chefs.cards.kenji).toBe(4);
    expect(loaded.economy.purchases.no_ads).toBe(true);
    const raw = JSON.parse(serializeSave(createSave(state, 0)));
    raw.economy.chefs.levels.kenji = 99;
    raw.economy.purchases.golden_kitchen = 'yes';
    delete raw.economy.chefs.cards;
    const repaired = parseSave(JSON.stringify(raw))!;
    expect(repaired.economy.chefs.levels.kenji).toBe(CHEF.cardsPerLevel.length);
    expect(repaired.economy.chefs.cards.kenji).toBe(0);
    expect(repaired.economy.purchases.golden_kitchen).toBe(false);
  });
});

describe('chef cards for old saves', () => {
  it('pays the cards of finished cities and tops up the current one', () => {
    const state = newEconomy();
    state.city = 3;
    state.dishLevels = [5, 5, 5, 0, 0, 0, 0];
    state.chefs.levels.karim = 1;
    const raw = JSON.parse(serializeSave(createSave(state, 0)));
    raw.version = 1;
    const loaded = parseSave(JSON.stringify(raw))!.economy;
    const perCity = 6 * CHEF.dishCards + CHEF.franchiseCards;
    expect(loaded.chefs.cards.selim).toBe(perCity);
    expect(loaded.chefs.cards.amelie).toBe(perCity);
    // Two dishes unlocked in Cairo; one card already spent on recruiting Karim.
    expect(loaded.chefs.cards.karim).toBe(1);
    expect(loaded.chefs.cards.priya).toBe(0);
    // A current save is left alone.
    expect(parseSave(serializeSave(createSave(state, 0)))!.economy.chefs.cards.selim).toBe(0);
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
    expect(state.chefs.cards.selim).toBe(SHOP.starter.cards);
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
