import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { PRODUCT_IDS, type ProductId } from '../../core/economy';

// In-app purchases. Game code only talks to this interface: the browser uses a fake store for
// testing, the Android build Google Play Billing. Every product is a one-time product that is
// kept forever (acknowledged, never consumed).

export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';

export interface StoreService {
  // Localized prices of the products the store sells right now (missing ones are not on sale).
  prices(): Promise<Partial<Record<ProductId, string>>>;
  purchase(id: ProductId): Promise<PurchaseResult>;
  // Products the player owns according to the store; null when the store could not be asked.
  owned(): Promise<ProductId[] | null>;
}

const isProduct = (id: string): id is ProductId => (PRODUCT_IDS as readonly string[]).includes(id);

// Google Play purchase state of a completed purchase ("2" is pending, e.g. paid in cash later).
const PURCHASED = '1';

class PlayStoreService implements StoreService {
  async prices(): Promise<Partial<Record<ProductId, string>>> {
    try {
      const { isBillingSupported } = await NativePurchases.isBillingSupported();
      if (!isBillingSupported) return {};
      const { products } = await NativePurchases.getProducts({ productIdentifiers: [...PRODUCT_IDS], productType: PURCHASE_TYPE.INAPP });
      const prices: Partial<Record<ProductId, string>> = {};
      for (const product of products) if (isProduct(product.identifier)) prices[product.identifier] = product.priceString;
      return prices;
    } catch (error) {
      console.warn('Store prices failed', error);
      return {};
    }
  }

  async purchase(id: ProductId): Promise<PurchaseResult> {
    try {
      const transaction = await NativePurchases.purchaseProduct({ productIdentifier: id, productType: PURCHASE_TYPE.INAPP });
      // A pending purchase is granted later, when owned() finds it completed.
      return transaction.purchaseState === undefined || transaction.purchaseState === PURCHASED ? 'purchased' : 'failed';
    } catch (error) {
      const message = String((error as { message?: string })?.message ?? error).toLowerCase();
      if (message.includes('cancel')) return 'cancelled';
      console.warn('Purchase failed', error);
      return 'failed';
    }
  }

  async owned(): Promise<ProductId[] | null> {
    try {
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
      return purchases
        .filter((purchase) => purchase.purchaseState === undefined || purchase.purchaseState === PURCHASED)
        .map((purchase) => purchase.productIdentifier)
        .filter(isProduct);
    } catch (error) {
      console.warn('Store purchases failed', error);
      return null;
    }
  }
}

const TEST_PRICES: Record<ProductId, string> = { no_ads: '$3.99', golden_kitchen: '$4.99', starter_pack: '$1.99' };

// Stand-in for Google Play while developing in the browser: a confirmation overlay. Bought
// products live only in the game save, so owned() reports nothing.
class TestStoreService implements StoreService {
  async prices(): Promise<Partial<Record<ProductId, string>>> {
    return { ...TEST_PRICES };
  }

  async owned(): Promise<ProductId[] | null> {
    return [];
  }

  purchase(id: ProductId): Promise<PurchaseResult> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;gap:24px;background:rgba(10,10,20,0.92);color:#fff;font:600 22px system-ui,sans-serif';
      const title = document.createElement('div');
      title.textContent = `Test purchase: ${id} (${TEST_PRICES[id]})`;
      title.style.cssText = 'font-size:28px';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:16px';
      const button = (label: string, color: string, result: PurchaseResult) => {
        const element = document.createElement('button');
        element.textContent = label;
        element.style.cssText = `padding:12px 28px;border:0;border-radius:12px;font:600 20px system-ui,sans-serif;cursor:pointer;background:${color}`;
        element.addEventListener('click', () => {
          overlay.remove();
          resolve(result);
        });
        return element;
      };
      row.append(button('Buy', '#f4b400', 'purchased'), button('Cancel', '#888', 'cancelled'), button('Fail', '#c0392b', 'failed'));
      overlay.append(title, row);
      document.body.append(overlay);
    });
  }
}

export const store: StoreService = Capacitor.isNativePlatform() ? new PlayStoreService() : new TestStoreService();
