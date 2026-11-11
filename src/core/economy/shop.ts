import { PRODUCT_IDS, SHOP, type ChefId, type ProductId } from './config';
import { giveChefCards } from './chefs';
import { baseIncomePerSecond, earn, type EconomyState } from './state';

// In-app purchases (GDD 8b). The game only keeps what the player owns; the store layer
// (src/game/store) talks to Google Play and calls grantPurchase once a purchase went through.

export type Purchases = Record<ProductId, boolean>;

export function newPurchases(): Purchases {
  return Object.fromEntries(PRODUCT_IDS.map((id) => [id, false])) as Purchases;
}

export function owns(state: EconomyState, id: ProductId): boolean {
  return state.purchases[id];
}

// With "No ads" every rewarded ad's reward is given without the ad.
export function adsRemoved(state: EconomyState): boolean {
  return state.purchases.no_ads;
}

export interface GrantedPurchase {
  money: number;
  rush: number;
  cards: number;
  chef: ChefId | null;
}

// Marks a product as owned and pays out what it contains. Returns null if it was owned already
// (every product can only be bought once).
export function grantPurchase(state: EconomyState, id: ProductId): GrantedPurchase | null {
  if (state.purchases[id]) return null;
  state.purchases[id] = true;
  const granted: GrantedPurchase = { money: 0, rush: 0, cards: 0, chef: null };
  if (id === 'starter_pack') {
    granted.money = SHOP.starter.money * baseIncomePerSecond(state);
    earn(state, granted.money);
    // Bought Rush may go past the usual cap.
    state.rushSeconds += SHOP.starter.rush;
    granted.rush = SHOP.starter.rush;
    granted.chef = giveChefCards(state, SHOP.starter.cards);
    granted.cards = granted.chef ? SHOP.starter.cards : 0;
  }
  return granted;
}
