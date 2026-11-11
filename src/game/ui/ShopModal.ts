import Phaser from 'phaser';
import { ADS, SHOP, baseIncomePerSecond, type EconomyState, type ProductId } from '../../core/economy';
import { formatNumber } from '../../core/format';
import { t, tDurationShort } from '../../i18n';
import { PALETTE } from '../config';
import { ART_RES, paintTexture } from '../view/paint';
import { BUTTON_STYLES, Button } from './Button';
import { chefCardIcon, giftIcon } from './icons';
import { createModalCard } from './modalCard';
import { card, outlined, plain, wrapStyle } from './style';

const CARD_WIDTH = 960;
const ITEM = { width: 880, height: 250, gap: 26 };
const ORDER: ProductId[] = ['starter_pack', 'golden_kitchen', 'no_ads'];
const ITEMS_TOP = 190;
const CARD_HEIGHT = ITEMS_TOP + ORDER.length * (ITEM.height + ITEM.gap) + 230;
const TEXT_X = 190;
const PRICE = { width: 230, height: 96 };

const ITEM_LOOKS = {
  normal: { top: 0xffffff, bottom: 0xfff0d6, border: 0xe6c49a, radius: 28 },
  best: { top: 0xfffbea, bottom: 0xffe08a, border: 0xf0a020, radius: 28, borderWidth: 6 },
  owned: { top: 0xf2f8ec, bottom: 0xdcebcf, border: 0x8cc46e, radius: 28 },
};

export interface ShopActions {
  // Runs the store purchase and grants it; resolves when the store is done.
  buy(id: ProductId): Promise<void>;
  restore(): Promise<void>;
}

interface ItemView {
  id: ProductId;
  bg: Phaser.GameObjects.Image;
  button: Button;
}

// The "No Ads" badge: the ad screen crossed out in red.
function noAdsIcon(scene: Phaser.Scene): string {
  return paintTexture(scene, 'icon-no-ads', 120, 120, (ctx) => {
    ctx.translate(60, 60);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2618';
    ctx.beginPath();
    ctx.roundRect(-30, -22, 60, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(14, 0);
    ctx.lineTo(-8, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e8463a';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, Math.PI * 2);
    ctx.moveTo(-32, -32);
    ctx.lineTo(32, 32);
    ctx.stroke();
  });
}

// One-time purchases: starter pack, Golden Kitchen and No Ads, with prices from the store.
export class ShopModal extends Phaser.GameObjects.Container {
  private readonly items: ItemView[] = [];
  private prices: Partial<Record<ProductId, string>> | null = null;
  private busy = false;

  constructor(
    scene: Phaser.Scene,
    private readonly economy: () => EconomyState,
    prices: Promise<Partial<Record<ProductId, string>>>,
    private readonly actions: ShopActions,
    depth: number,
  ) {
    super(scene, 0, 0);
    const modal = createModalCard(scene, CARD_WIDTH, CARD_HEIGHT, t('shop.title'));
    const { cx, top } = modal;
    const children: Phaser.GameObjects.GameObject[] = [...modal.objects];

    ORDER.forEach((id, i) => {
      const y = top + ITEMS_TOP + i * (ITEM.height + ITEM.gap) + ITEM.height / 2;
      children.push(...this.createItem(scene, cx, y, id));
    });

    const restore = new Button(scene, cx, top + CARD_HEIGHT - 190, 460, 80, () => void this.run(() => this.actions.restore()));
    restore.setLabel(t('shop.restore')).setButtonStyle(BUTTON_STYLES.toggle);
    const close = new Button(scene, cx, top + CARD_HEIGHT - 80, 320, 90, () => this.destroy());
    close.setLabel(t('settings.close')).setButtonStyle(BUTTON_STYLES.primary);
    children.push(restore, close);

    this.add(children);
    this.setDepth(depth);
    scene.add.existing(this);
    this.render();
    void prices.then((loaded) => {
      this.prices = loaded;
      this.render();
    });
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
  }

  private createItem(scene: Phaser.Scene, cx: number, y: number, id: ProductId): Phaser.GameObjects.GameObject[] {
    const left = cx - ITEM.width / 2;
    const bg = scene.add.image(cx, y, '__DEFAULT').setScale(1 / ART_RES);
    const objects: Phaser.GameObjects.GameObject[] = [bg];
    const iconX = left + 95;
    if (id === 'no_ads') {
      objects.push(scene.add.image(iconX, y, noAdsIcon(scene)).setScale(1.1 / ART_RES));
    } else if (id === 'golden_kitchen') {
      objects.push(scene.add.image(iconX, y - 8, 'coin').setScale(1.9));
      objects.push(scene.add.text(iconX + 30, y + 34, `x${SHOP.goldenIncome}`, outlined(46, { color: 0xffe066, stroke: 0x8a4a00 })).setOrigin(0.5));
    } else {
      objects.push(scene.add.image(iconX, y - 4, giftIcon(scene)).setScale(2.1 / ART_RES));
      objects.push(scene.add.image(iconX + 44, y + 40, chefCardIcon(scene)).setScale(1.1 / ART_RES).setAngle(12));
    }
    const nameKey = id === 'no_ads' ? 'shop.noAds.name' : id === 'golden_kitchen' ? 'shop.golden.name' : 'shop.starter.name';
    const textWidth = ITEM.width - TEXT_X - PRICE.width - 40;
    const name = scene.add.text(left + TEXT_X, y - 86, t(nameKey), plain(38, PALETTE.ink, true)).setOrigin(0, 0);
    name.setScale(Math.min(1, textWidth / name.width));
    const desc = scene.add
      .text(left + TEXT_X, y - 30, this.description(id), { ...plain(26, PALETTE.muted), wordWrap: wrapStyle(textWidth), lineSpacing: 4 })
      .setOrigin(0, 0);
    const button = new Button(scene, cx + ITEM.width / 2 - PRICE.width / 2 - 24, y, PRICE.width, PRICE.height, () =>
      void this.run(() => this.actions.buy(id)),
    );
    button.sound = 'buy';
    objects.push(name, desc, button);
    if (id === 'starter_pack') {
      const ribbon = scene.add
        .text(cx + ITEM.width / 2 - PRICE.width / 2 - 24, y - ITEM.height / 2 + 6, t('shop.best'), {
          ...plain(22, 0xffffff, true),
          backgroundColor: '#e8463a',
          padding: { x: 12, y: 4 },
        })
        .setOrigin(0.5);
      objects.push(ribbon);
    }
    this.items.push({ id, bg, button });
    return objects;
  }

  private description(id: ProductId): string {
    if (id === 'no_ads') return t('shop.noAds.desc');
    if (id === 'golden_kitchen') return t('shop.golden.desc', { multiplier: SHOP.goldenIncome });
    return t('shop.starter.desc', {
      money: formatNumber(SHOP.starter.money * baseIncomePerSecond(this.economy())),
      rush: tDurationShort(SHOP.starter.rush),
      multiplier: ADS.rushMultiplier,
      cards: SHOP.starter.cards,
    });
  }

  // One store call at a time.
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await action();
    } finally {
      this.busy = false;
    }
    this.render();
  }

  render(): void {
    if (!this.active) return;
    const state = this.economy();
    for (const item of this.items) {
      const owned = state.purchases[item.id];
      const look = owned ? 'owned' : item.id === 'starter_pack' ? 'best' : 'normal';
      item.bg.setTexture(card(this.scene, `shop-item-${look}`, ITEM.width, ITEM.height, ITEM_LOOKS[look]));
      const price = this.prices?.[item.id];
      if (owned) item.button.setLabel(`${t('shop.owned')} ✓`).setButtonStyle(BUTTON_STYLES.disabled, false);
      else if (this.prices === null) item.button.setLabel('…').setButtonStyle(BUTTON_STYLES.disabled, false);
      else if (!price) item.button.setLabel(t('shop.unavailable')).setButtonStyle(BUTTON_STYLES.disabled, false);
      else item.button.setLabel(price).setButtonStyle(BUTTON_STYLES.buy);
    }
  }
}
