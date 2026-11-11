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
import { card, counterPill, outlined, plain, wrapStyle } from './style';

const CARD_WIDTH = 980;
const TILE = { width: 452, height: 236, gap: 12 };
const COLUMNS = 2;
// The card pool counter under the info text, then the grid of chefs.
const POOL = { y: 248, width: 520, height: 64 };
const GRID_TOP = 300;
const CARD_HEIGHT = GRID_TOP + Math.ceil(CHEF_IDS.length / COLUMNS) * (TILE.height + TILE.gap) + 140;
const TEXT_X = 186;
// The level up button row inside a tile.
const BUTTON_Y = 202;
const BUTTON = { width: 250, height: 58 };
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
  button: Button;
  max: Phaser.GameObjects.Text;
}

// Darkens every part of a character (a chef the tour has not reached yet).
function silhouette(object: Phaser.GameObjects.GameObject): void {
  if (object instanceof Phaser.GameObjects.Container) object.each((child: Phaser.GameObjects.GameObject) => silhouette(child));
  else if (object instanceof Phaser.GameObjects.Image) object.setTint(SILHOUETTE);
}

// The chef collection: the shared pool of chef cards on top, then one tile per famous chef with
// their skill, level and a button that spends cards on them.
export class ChefsModal extends Phaser.GameObjects.Container {
  private readonly tiles: ChefTile[] = [];
  private readonly poolText: Phaser.GameObjects.Text;
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
    children.push(modalText(scene, modal, CARD_WIDTH, top + 172, t('chefs.info'), 26, PALETTE.muted));

    // How many cards there are to spend.
    const poolY = top + POOL.y;
    const pill = scene.add.image(cx, poolY, counterPill(scene, POOL.width, POOL.height)).setScale(1 / ART_RES);
    const poolIcon = scene.add.image(cx - POOL.width / 2 + 10, poolY - 2, chefCardIcon(scene)).setScale(0.9 / ART_RES);
    this.poolText = scene.add.text(cx + 16, poolY - 2, '', outlined(34)).setOrigin(0.5);
    children.push(pill, poolIcon, this.poolText);

    const state = economy();
    const gridWidth = COLUMNS * TILE.width + (COLUMNS - 1) * TILE.gap;
    CHEF_IDS.forEach((id, i) => {
      const x = cx - gridWidth / 2 + (i % COLUMNS) * (TILE.width + TILE.gap);
      const y = top + GRID_TOP + Math.floor(i / COLUMNS) * (TILE.height + TILE.gap);
      const tile = this.createTile(scene, x, y, id, chefMet(state, id));
      this.tiles.push(tile);
      children.push(tile.container);
    });

    const close = new Button(scene, cx, top + CARD_HEIGHT - 76, 320, 90, () => this.destroy());
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
    glow.fillStyle(0x3a2618, 0.18).fillEllipse(92, 216, 110, 22);
    const person = new Person(scene, 92, 218, 'chef', CHEF_LOOKS[id]);
    person.setStyle(3);
    person.setScale(1.05).setDepth(0);
    if (!met) silhouette(person);
    const name = scene.add.text(TEXT_X, 20, chefName(id), plain(32, PALETTE.ink, true)).setOrigin(0, 0);
    name.setScale(Math.min(1, (TILE.width - TEXT_X - 20) / name.width));
    const city = scene.add.text(TEXT_X, 58, '', plain(22, PALETTE.muted)).setOrigin(0, 0);
    const stars = Array.from({ length: chefMaxLevel() }, (_, i) =>
      scene.add.image(TEXT_X + 16 + i * 34, 100, 'star').setScale(0.42),
    );
    const skill = scene.add
      .text(TEXT_X, 120, '', { ...plain(22, PALETTE.saffronDark, true), wordWrap: wrapStyle(TILE.width - TEXT_X - 18), lineSpacing: 2 })
      .setOrigin(0, 0);
    const button = new Button(scene, TEXT_X + BUTTON.width / 2, BUTTON_Y, BUTTON.width, BUTTON.height, () => this.levelUp(id));
    button.sound = null;
    const max = scene.add.text(TEXT_X, BUTTON_Y, t('chefs.maxed'), outlined(34, { color: 0xffe066, stroke: 0x8a4a00 })).setOrigin(0, 0.5);
    const container = scene.add.container(x, y, [bg, glow, person, name, city, ...stars, skill, button, max]);
    return { id, container, bg, person, name, city, stars, skill, button, max };
  }

  render(): void {
    if (!this.active) return;
    const state = this.economy();
    this.poolText.setText(t('chefs.pool', { count: state.chefs.pool }));
    for (const tile of this.tiles) {
      const { id } = tile;
      const level = state.chefs.levels[id];
      const met = chefMet(state, id);
      const needed = cardsForNextLevel(state, id);
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

      // Every chef the tour has reached shows the price of their next level; it lights up when
      // the pool covers it.
      const maxed = needed === null;
      tile.max.setVisible(maxed);
      tile.button.setVisible(met && !maxed);
      if (met && !maxed) {
        const label = level === 0 ? t('chefs.recruitCost', { cost: needed }) : t('chefs.levelUpCost', { cost: needed });
        tile.button.setLabel(label, false).setButtonStyle(ready ? BUTTON_STYLES.go : BUTTON_STYLES.disabled, ready);
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
    this.scene.tweens.add({ targets: this.poolText, scale: 1.2, duration: 120, yoyo: true });
    this.render();
  }
}
