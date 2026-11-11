import Phaser from 'phaser';
import {
  CHEF_IDS,
  canLevelUpChef,
  cardsForNextLevel,
  chefMaxLevel,
  chefMet,
  cityConfig,
  type ChefId,
  type EconomyState,
} from '../../core/economy';
import { t, type TranslationKey } from '../../i18n';
import { PALETTE, toCss } from '../config';
import { audio } from '../audio';
import { confetti, sparkle } from '../fx';
import { CHEF_LOOKS } from '../view/chefLooks';
import { ART_RES } from '../view/paint';
import { Person } from '../view/Person';
import { BUTTON_STYLES, Button } from './Button';
import { chefCardIcon } from './icons';
import { createModalCard, modalText } from './modalCard';
import { chefName, chefSkillText } from './progressText';
import { card, outlined, plain, wrapStyle } from './style';

const CARD_WIDTH = 980;
const TILE = { width: 452, height: 236, gap: 16 };
const COLUMNS = 2;
const GRID_TOP = 270;
const CARD_HEIGHT = GRID_TOP + Math.ceil(CHEF_IDS.length / COLUMNS) * (TILE.height + TILE.gap) + 150;
const TEXT_X = 186;
const BAR = { width: 170, height: 18 };
const BUTTON = { width: 250, height: 66 };
const SILHOUETTE = 0x3a2c3c;

const TILE_LOOKS = {
  locked: { top: 0xeee6dc, bottom: 0xd9cfc2, border: 0xbfb2a2, radius: 26 },
  open: { top: 0xffffff, bottom: 0xfff0d6, border: 0xe6c49a, radius: 26 },
  ready: { top: 0xf4ffe8, bottom: 0xd8f2c0, border: 0x5cc23a, radius: 26, borderWidth: 6 },
  recruited: { top: 0xfffbea, bottom: 0xffe7a8, border: 0xf0a020, radius: 26 },
};

interface ChefTile {
  id: ChefId;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  person: Person;
  name: Phaser.GameObjects.Text;
  city: Phaser.GameObjects.Text;
  stars: Phaser.GameObjects.Image[];
  skill: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  cardIcon: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.Text;
  button: Button;
  max: Phaser.GameObjects.Text;
}

// Darkens every part of a character (a chef the tour has not reached yet).
function silhouette(object: Phaser.GameObjects.GameObject): void {
  if (object instanceof Phaser.GameObjects.Container) object.each((child: Phaser.GameObjects.GameObject) => silhouette(child));
  else if (object instanceof Phaser.GameObjects.Image) object.setTint(SILHOUETTE);
}

// The chef collection: one tile per famous chef with their skill, level and cards.
export class ChefsModal extends Phaser.GameObjects.Container {
  private readonly tiles: ChefTile[] = [];
  private readonly fxDepth: number;

  constructor(
    scene: Phaser.Scene,
    private readonly economy: () => EconomyState,
    // Spends the cards for the chef's next level; returns whether it worked.
    private readonly onLevelUp: (id: ChefId) => boolean,
    depth: number,
  ) {
    super(scene, 0, 0);
    this.fxDepth = depth + 10;
    const modal = createModalCard(scene, CARD_WIDTH, CARD_HEIGHT, t('chefs.title'));
    const { cx, top } = modal;
    const children: Phaser.GameObjects.GameObject[] = [...modal.objects];
    children.push(modalText(scene, modal, CARD_WIDTH, top + 195, t('chefs.info'), 28, PALETTE.muted));

    const state = economy();
    const gridWidth = COLUMNS * TILE.width + (COLUMNS - 1) * TILE.gap;
    CHEF_IDS.forEach((id, i) => {
      const x = cx - gridWidth / 2 + (i % COLUMNS) * (TILE.width + TILE.gap);
      const y = top + GRID_TOP + Math.floor(i / COLUMNS) * (TILE.height + TILE.gap);
      const tile = this.createTile(scene, x, y, id, chefMet(state, id));
      this.tiles.push(tile);
      children.push(tile.container);
    });

    const close = new Button(scene, cx, top + CARD_HEIGHT - 80, 320, 90, () => this.destroy());
    close.setLabel(t('settings.close')).setButtonStyle(BUTTON_STYLES.primary);
    children.push(close);

    this.add(children);
    this.setDepth(depth);
    scene.add.existing(this);
    this.render();
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
  }

  private createTile(scene: Phaser.Scene, x: number, y: number, id: ChefId, met: boolean): ChefTile {
    const bg = scene.add.image(TILE.width / 2, TILE.height / 2, '__DEFAULT').setScale(1 / ART_RES);
    // A soft spotlight behind the chef in their neckerchief color.
    const glow = scene.add.graphics();
    glow.fillStyle(CHEF_LOOKS[id].scarf ?? PALETTE.saffron, met ? 0.22 : 0.1).fillCircle(92, 112, 76);
    glow.fillStyle(0x3a2618, 0.18).fillEllipse(92, 214, 110, 22);
    const person = new Person(scene, 92, 216, 'chef', CHEF_LOOKS[id]);
    person.setStyle(3);
    person.setScale(1.05).setDepth(0);
    if (!met) silhouette(person);
    const name = scene.add.text(TEXT_X, 22, chefName(id), plain(32, PALETTE.ink, true)).setOrigin(0, 0);
    name.setScale(Math.min(1, (TILE.width - TEXT_X - 20) / name.width));
    const city = scene.add.text(TEXT_X, 62, '', plain(22, PALETTE.muted)).setOrigin(0, 0);
    const stars = Array.from({ length: chefMaxLevel() }, (_, i) =>
      scene.add.image(TEXT_X + 16 + i * 34, 106, 'star').setScale(0.42),
    );
    const skill = scene.add
      .text(TEXT_X, 128, '', { ...plain(23, PALETTE.saffronDark, true), wordWrap: wrapStyle(TILE.width - TEXT_X - 18), lineSpacing: 2 })
      .setOrigin(0, 0);
    const barY = 198;
    const bar = scene.add.graphics();
    const cardIcon = scene.add.image(TEXT_X + 16, barY, chefCardIcon(scene)).setScale(0.62 / ART_RES);
    const count = scene.add.text(TEXT_X + 40 + BAR.width + 12, barY, '', plain(24, PALETTE.muted, true)).setOrigin(0, 0.5);
    const button = new Button(scene, TEXT_X + BUTTON.width / 2, barY, BUTTON.width, BUTTON.height, () => this.levelUp(id));
    button.sound = null;
    const max = scene.add.text(TEXT_X, barY, t('chefs.maxed'), outlined(34, { color: 0xffe066, stroke: 0x8a4a00 })).setOrigin(0, 0.5);
    const container = scene.add.container(x, y, [bg, glow, person, name, city, ...stars, skill, bar, cardIcon, count, button, max]);
    return { id, container, bg, person, name, city, stars, skill, bar, cardIcon, count, button, max };
  }

  render(): void {
    if (!this.active) return;
    const state = this.economy();
    for (const tile of this.tiles) {
      const { id } = tile;
      const level = state.chefs.levels[id];
      const met = chefMet(state, id);
      const needed = cardsForNextLevel(state, id);
      const cards = state.chefs.cards[id];
      const ready = canLevelUpChef(state, id);
      const look = !met ? 'locked' : ready ? 'ready' : level > 0 ? 'recruited' : 'open';
      tile.bg.setTexture(card(this.scene, `chef-tile-${look}`, TILE.width, TILE.height, TILE_LOOKS[look]));
      const cityName = t(`city.${cityConfig(CHEF_IDS.indexOf(id)).id}` as TranslationKey);
      tile.city.setText(met ? cityName : t('chefs.locked', { city: cityName }));
      tile.city.setScale(Math.min(1, (TILE.width - TEXT_X - 16) / Math.max(1, tile.city.width)));
      tile.name.setAlpha(met ? 1 : 0.6);
      tile.person.setAlpha(!met || level > 0 ? 1 : 0.65);
      tile.stars.forEach((star, i) => star.setAlpha(i < level ? 1 : 0.22).setTint(i < level ? 0xffffff : 0x8a7462));
      // Recruited chefs show what they give now; the others what one level gives.
      tile.skill.setText(level > 0 ? chefSkillText(id, level) : t('chefs.perLevel', { skill: chefSkillText(id, 1) }));
      tile.skill.setColor(toCss(level > 0 ? PALETTE.saffronDark : PALETTE.muted));

      const maxed = needed === null;
      tile.max.setVisible(maxed);
      tile.button.setVisible(ready);
      if (ready) tile.button.setLabel(level === 0 ? t('chefs.recruit') : t('chefs.levelUp'), false).setButtonStyle(BUTTON_STYLES.go);
      const showBar = met && !maxed && !ready;
      tile.cardIcon.setVisible(showBar);
      tile.count.setVisible(showBar);
      tile.bar.clear();
      if (showBar) {
        tile.count.setText(`${cards}/${needed}`);
        const x = TEXT_X + 40;
        const y = 198 - BAR.height / 2;
        tile.bar.fillStyle(0x3a2618, 0.18).fillRoundedRect(x, y, BAR.width, BAR.height, BAR.height / 2);
        if (cards > 0) {
          const w = Math.max(BAR.height, (BAR.width * cards) / needed!);
          tile.bar.fillStyle(0xf0a020, 1).fillRoundedRect(x, y, w, BAR.height, BAR.height / 2);
        }
      }
    }
  }

  private levelUp(id: ChefId): void {
    if (!this.onLevelUp(id)) return;
    const tile = this.tiles.find((item) => item.id === id)!;
    const x = tile.container.x + 92;
    const y = tile.container.y + 110;
    audio.play('celebrate');
    sparkle(this.scene, x, y, PALETTE.saffron, this.fxDepth);
    confetti(this.scene, x, y, this.fxDepth);
    this.scene.tweens.add({ targets: tile.person, y: tile.person.y - 30, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    this.render();
  }
}
