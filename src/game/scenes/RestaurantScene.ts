import Phaser from 'phaser';
import {
  advanceTime,
  buyDish,
  buySectionLevel,
  incomePerSecond,
  newEconomy,
  type EconomyState,
  type SectionId,
} from '../../core/economy';
import { formatNumber } from '../../core/format';
import { t } from '../../i18n';
import { FONT, GAME_WIDTH, LAYOUT, PALETTE, toCss } from '../config';
import { UpgradePanel } from '../ui/UpgradePanel';

const PANEL_REFRESH_MS = 100;
const EARNINGS_POPUP_MS = 1000;

export class RestaurantScene extends Phaser.Scene {
  private economy!: EconomyState;
  private panel!: UpgradePanel;
  private moneyText!: Phaser.GameObjects.Text;
  private incomeText!: Phaser.GameObjects.Text;
  private steam: Phaser.GameObjects.Ellipse[] = [];
  private elapsed = 0;
  private sincePanelRefresh = 0;
  private sincePopup = 0;
  private earnedSincePopup = 0;

  constructor() {
    super('Restaurant');
  }

  create(): void {
    this.economy = newEconomy();
    // Dev-only shortcut for testing: /?money=1e6
    if (import.meta.env.DEV) {
      const money = Number(new URLSearchParams(location.search).get('money'));
      if (money > 0) this.economy.money = money;
    }
    this.drawRoom();
    this.drawHud();
    this.panel = new UpgradePanel(
      this,
      (id) => this.buySection(id),
      (index) => this.buyDish(index),
    );
    this.refreshUi();
  }

  // Called every frame; delta is milliseconds since the previous frame.
  update(_time: number, delta: number): void {
    this.earnedSincePopup += advanceTime(this.economy, delta / 1000);
    this.elapsed += delta / 1000;
    this.animateSteam();

    this.sincePopup += delta;
    if (this.sincePopup >= EARNINGS_POPUP_MS) {
      this.sincePopup = 0;
      this.showEarningsPopup(this.earnedSincePopup);
      this.earnedSincePopup = 0;
    }

    this.sincePanelRefresh += delta;
    if (this.sincePanelRefresh >= PANEL_REFRESH_MS) {
      this.sincePanelRefresh = 0;
      this.refreshUi();
    } else {
      this.moneyText.setText(formatNumber(this.economy.money, 0));
    }
  }

  private buySection(id: SectionId): void {
    if (!buySectionLevel(this.economy, id)) return;
    this.panel.pulseSection(id);
    this.refreshUi();
  }

  private buyDish(index: number): void {
    if (!buyDish(this.economy, index)) return;
    this.panel.pulseDish(index);
    this.refreshUi();
  }

  private refreshUi(): void {
    this.moneyText.setText(formatNumber(this.economy.money, 0));
    this.incomeText.setText(t('hud.perSecond', { amount: formatNumber(incomePerSecond(this.economy)) }));
    this.panel.refresh(this.economy);
  }

  private drawHud(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, LAYOUT.hudHeight, PALETTE.pomegranate).setOrigin(0);
    this.add.rectangle(0, LAYOUT.hudHeight, GAME_WIDTH, 8, PALETTE.pomegranateDark).setOrigin(0);
    this.add.image(GAME_WIDTH / 2 - 150, 78, 'coin').setScale(1.1);
    this.moneyText = this.add
      .text(GAME_WIDTH / 2 - 100, 78, '0', {
        fontFamily: FONT,
        fontSize: '72px',
        fontStyle: 'bold',
        color: toCss(PALETTE.cream),
      })
      .setOrigin(0, 0.5);
    this.incomeText = this.add
      .text(GAME_WIDTH / 2, 150, '', { fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: toCss(PALETTE.saffron) })
      .setOrigin(0.5);
  }

  private drawRoom(): void {
    const top = LAYOUT.hudHeight;
    const floorTop = 640;
    this.add.rectangle(0, top, GAME_WIDTH, floorTop - top, PALETTE.wall).setOrigin(0);
    for (let i = 0, x = 0; x < GAME_WIDTH; i++, x += 60) {
      this.add.rectangle(x, floorTop - 80, 60, 80, i % 2 === 0 ? PALETTE.tileBlue : 0x2f8fb0).setOrigin(0);
    }
    for (let i = 0, y = floorTop; y < LAYOUT.panelTop; i++, y += 70) {
      this.add.rectangle(0, y, GAME_WIDTH, 70, i % 2 === 0 ? PALETTE.floor : PALETTE.floorDark).setOrigin(0);
    }
    // Placeholder stove until the living scene arrives.
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, 600, 390, 160, PALETTE.ink);
    this.add.circle(cx - 60, 525, 38, 0x555555);
    this.add.circle(cx + 60, 525, 38, 0x555555);
    this.add.rectangle(cx, 495, 180, 60, 0x8c8c8c);
    this.steam = Array.from({ length: 5 }, () => this.add.ellipse(cx, 450, 60, 45, 0xffffff, 0.6));
  }

  private animateSteam(): void {
    const cx = GAME_WIDTH / 2;
    this.steam.forEach((puff, i) => {
      const t = (this.elapsed * 0.6 + i / this.steam.length) % 1;
      puff.y = 460 - t * 180;
      puff.x = cx + Math.sin((this.elapsed + i) * 2) * 15;
      puff.setAlpha(0.6 * (1 - t));
      puff.setScale(0.6 + t);
    });
  }

  private showEarningsPopup(amount: number): void {
    if (amount <= 0) return;
    const x = GAME_WIDTH / 2 + Phaser.Math.Between(-260, 260);
    const y = Phaser.Math.Between(720, 900);
    const popup = this.add
      .text(x, y, `+${formatNumber(amount)}`, {
        fontFamily: FONT,
        fontSize: '48px',
        fontStyle: 'bold',
        color: toCss(PALETTE.saffron),
        stroke: toCss(PALETTE.ink),
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: popup,
      y: y - 160,
      alpha: 0,
      duration: 1100,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }
}
