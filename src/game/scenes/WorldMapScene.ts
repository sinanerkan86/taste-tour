import Phaser from 'phaser';
import { CITIES, DISH_TIERS, cityConfig, type EconomyState } from '../../core/economy';
import { formatNumber } from '../../core/format';
import { t, type TranslationKey } from '../../i18n';
import { audio } from '../audio';
import { GAME_WIDTH } from '../config';
import { DISH_COLORS } from '../colors';
import { dishIcon, lockIcon } from '../ui/icons';
import { counterPill, glossyButton, outlined } from '../ui/style';
import { type Ctx, ART_RES, css, ellipse, paintTexture, radial, roundRect, seeded, vGradient } from '../view/paint';
import { cityTheme } from '../view/themes';

// The world tour: a winding road that climbs up the screen from the first city to the next
// ones. Finished cities show the stars they gave, the current one glows with a pin over it,
// and the cities ahead wait under a padlock, showing their landmark and first dish.

export interface WorldMapData {
  economy: EconomyState;
}

const NODE_GAP = 430;
const NODE_RADIUS = 100;
const BOTTOM_PAD = 380;
const TOP_PAD = 560;
const HEADER_HEIGHT = 170;
const CHUNK = 1024;
const ROAD_WIDTH = 66;
const FLING_DECAY = 0.92;

type NodeState = 'done' | 'current' | 'locked';

interface MapNode {
  index: number;
  x: number;
  y: number;
  state: NodeState;
}

export class WorldMapScene extends Phaser.Scene {
  private mapHeight = 0;
  private nodes: MapNode[] = [];
  private velocity = 0;
  private dragging = false;
  private lastY = 0;

  constructor() {
    super('WorldMap');
  }

  create(data: WorldMapData): void {
    const economy = data.economy;
    const count = Math.max(CITIES.length, economy.city + 3);
    this.mapHeight = BOTTOM_PAD + (count - 1) * NODE_GAP + TOP_PAD;
    this.nodes = Array.from({ length: count }, (_, index) => ({
      index,
      x: GAME_WIDTH / 2 + Math.sin(index * 1.25 + 0.4) * 250,
      y: this.mapHeight - BOTTOM_PAD - index * NODE_GAP,
      state: index < economy.city ? 'done' : index === economy.city ? 'current' : 'locked',
    }));

    // Taps never reach the restaurant underneath.
    this.add.rectangle(0, 0, GAME_WIDTH, this.mapHeight, 0x000000, 0).setOrigin(0).setInteractive();
    this.paintLandscape();
    this.drawProgress(economy.city);
    this.nodes.forEach((node) => this.drawNode(node, economy));
    this.addClouds();
    this.drawHeader(economy);
    this.setUpScrolling(economy.city);

    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    if (this.dragging || Math.abs(this.velocity) < 0.05) return;
    this.scrollBy(this.velocity * (delta / 16.7));
    this.velocity *= Math.pow(FLING_DECAY, delta / 16.7);
  }

  private close(): void {
    audio.play('click');
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.stop());
  }

  // --- Scrolling ------------------------------------------------------------------------------

  private setUpScrolling(current: number): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, GAME_WIDTH, this.mapHeight);
    // Open with the current city a little below the middle, then drift up to hint at what is next.
    const node = this.nodes[current];
    camera.scrollY = Phaser.Math.Clamp(node.y - this.scale.height * 0.62, 0, this.mapHeight - this.scale.height);
    this.tweens.add({ targets: camera, scrollY: camera.scrollY - 120, duration: 1400, delay: 350, ease: 'Sine.easeInOut' });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.tweens.killTweensOf(camera);
      this.dragging = true;
      this.velocity = 0;
      this.lastY = pointer.y;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      const dy = this.lastY - pointer.y;
      this.lastY = pointer.y;
      this.scrollBy(dy);
      this.velocity = dy;
    });
    this.input.on('pointerup', () => (this.dragging = false));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollBy(dy));
  }

  private scrollBy(dy: number): void {
    const camera = this.cameras.main;
    camera.scrollY = Phaser.Math.Clamp(camera.scrollY + dy, 0, Math.max(0, this.mapHeight - this.scale.height));
  }

  // --- Landscape ------------------------------------------------------------------------------

  // The meadow, river, trees and road are painted once into tall strips (one texture per
  // CHUNK of height, so no texture gets too big for phone GPUs).
  private paintLandscape(): void {
    const points = this.roadPoints();
    for (let top = 0; top < this.mapHeight; top += CHUNK) {
      const height = Math.min(CHUNK, this.mapHeight - top);
      const key = `map-${this.mapHeight}-${top}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      const texture = this.textures.createCanvas(key, GAME_WIDTH, height);
      if (!texture) continue;
      const ctx = texture.getContext();
      ctx.translate(0, -top);
      paintMeadow(ctx, this.mapHeight, top, height, points, this.nodes);
      texture.refresh();
      this.add.image(0, top, key).setOrigin(0).setDepth(-10);
    }
  }

  // A smooth road through all nodes, from below the first one to above the last.
  private roadPoints(): Phaser.Math.Vector2[] {
    const anchors = [
      new Phaser.Math.Vector2(this.nodes[0].x - 160, this.mapHeight + 40),
      ...this.nodes.map((n) => new Phaser.Math.Vector2(n.x, n.y)),
      new Phaser.Math.Vector2(GAME_WIDTH / 2, -60),
    ];
    return new Phaser.Curves.Spline(anchors).getPoints(anchors.length * 24);
  }

  // Golden footsteps along the road up to the current city, twinkling in a wave.
  private drawProgress(current: number): void {
    const points = this.roadPoints();
    const stopY = this.nodes[current].y;
    // Evenly spaced dots: walk the curve by length.
    const curve = new Phaser.Curves.Spline(points);
    const length = curve.getLength();
    const dots: Phaser.GameObjects.Arc[] = [];
    for (let d = 0; d < length; d += 44) {
      const p = curve.getPointAt(d / length);
      if (p.y < stopY + NODE_RADIUS + 10) break;
      if (p.y > this.mapHeight - 10) continue;
      dots.push(this.add.circle(p.x, p.y, 9, 0xffd34d).setStrokeStyle(3, 0xb07f00).setDepth(-5));
    }
    dots.forEach((dot, i) =>
      this.tweens.add({ targets: dot, scale: 1.35, duration: 380, yoyo: true, repeat: -1, repeatDelay: 1400, delay: i * 70, ease: 'Sine.easeInOut' }),
    );
  }

  // --- Cities -----------------------------------------------------------------------------

  private drawNode(node: MapNode, economy: EconomyState): void {
    const config = cityConfig(node.index);
    const theme = cityTheme(config.id);
    const cycle = Math.floor(node.index / CITIES.length);
    const { x, y, state } = node;

    // Glow under the current city.
    if (state === 'current') {
      const glow = this.add.image(x, y, glowTexture(this)).setScale(2.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
      this.tweens.add({ targets: glow, scale: 2.6, alpha: 0.6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // Landmark in a round window: sky, silhouette, a strip of ground.
    const scale = 0.78;
    const art = this.add.graphics().setDepth(2);
    const r = (NODE_RADIUS - 8) / scale;
    art.fillStyle(theme.sky, 1).fillCircle(0, 0, r);
    art.fillStyle(0xffffff, 0.35).fillCircle(-r * 0.3, -r * 0.45, r * 0.22);
    theme.landmark(art, 0, 4);
    art.fillStyle(theme.accent, 1).fillPoints(chord(r, 0.62), true);
    art.fillStyle(0x000000, 0.12).fillPoints(chord(r, 0.78), true);
    art.setPosition(x, y).setScale(scale);
    if (state === 'locked') this.add.circle(x, y, NODE_RADIUS - 6, 0x2a3550, 0.5).setDepth(3);
    this.add.image(x, y, ringTexture(this, state)).setScale(1 / ART_RES).setDepth(4);

    // Name ribbon.
    const ribbonY = y + NODE_RADIUS + 18;
    this.add.image(x, ribbonY, ribbonTexture(this, state)).setScale(1 / ART_RES).setDepth(5);
    const name = t(`city.${config.id}` as TranslationKey) + (cycle > 0 ? ` ${'I'.repeat(Math.min(cycle + 1, 3))}` : '');
    const label = this.add.text(x, ribbonY - 4, name, outlined(36)).setOrigin(0.5).setDepth(6);
    label.setScale(Math.min(1, 250 / label.width));

    if (state === 'done') {
      const stars = economy.cityStars[node.index] ?? 0;
      this.badge(x + NODE_RADIUS * 0.72, y - NODE_RADIUS * 0.72, stars > 0 ? `★ ${formatNumber(stars, 0)}` : '✓', 0x5cc23a);
    } else if (state === 'current') {
      const served = economy.dishLevels.filter((level) => level > 0).length;
      this.badge(x, y + NODE_RADIUS + 82, t('map.progress', { done: served, total: DISH_TIERS.length }), 0xffbe1a);
      this.pin(x, y - NODE_RADIUS - 20, this.nodes[node.index + 1]?.x ?? x);
    } else {
      this.add.image(x, y - 6, lockIcon(this)).setScale(1.5).setDepth(6);
      // A taste of what is coming: the city's first dish.
      const dish = this.add.image(x + NODE_RADIUS * 0.8, y + NODE_RADIUS * 0.45, dishIcon(this, config.dishes[0], DISH_COLORS[0])).setScale(0.8).setDepth(6);
      this.tweens.add({ targets: dish, y: dish.y - 8, duration: 1200 + node.index * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private badge(x: number, y: number, text: string, color: number): void {
    const label = this.add.text(0, -3, text, outlined(30)).setOrigin(0.5);
    const width = Math.max(90, label.width + 44);
    const bg = this.add.image(0, 0, glossyButton(this, Math.round(width), 66, { face: color })).setScale(1 / ART_RES);
    this.add.container(x, y, [bg, label]).setDepth(7);
  }

  // "You are here": a bouncing map pin with a chef hat.
  // The label sits beside the pin, on the side away from the next city, whose name ribbon
  // would otherwise run into it.
  private pin(x: number, y: number, nextX: number): void {
    const pin = this.add.image(x, y, pinTexture(this)).setOrigin(0.5, 1).setScale(1 / ART_RES).setDepth(8);
    this.tweens.add({ targets: pin, y: y - 22, duration: 520, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
    const right = nextX <= x;
    const gap = 70;
    const here = this.add
      .text(right ? x + gap : x - gap, y - 80, t('map.here'), outlined(30, { color: 0xffe066 }))
      .setOrigin(right ? 0 : 1, 0.5)
      .setDepth(8);
    const room = right ? GAME_WIDTH - 16 - (x + gap) : x - gap - 16;
    here.setScale(Math.min(1, room / here.width));
    this.tweens.add({ targets: here, y: here.y - 22, duration: 520, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
  }

  private addClouds(): void {
    const key = cloudTexture(this);
    const random = seeded(11);
    // Clouds drift between the cities, never over them.
    for (const node of this.nodes) {
      const y = node.y - NODE_GAP / 2 + (random() - 0.5) * 60;
      const cloud = this.add
        .image(random() * GAME_WIDTH, y, key)
        .setScale((0.8 + random() * 0.7) / ART_RES)
        .setAlpha(0.85)
        .setDepth(20);
      const speed = 14 + random() * 12;
      const travel = () => {
        const distance = GAME_WIDTH + 500 - cloud.x;
        this.tweens.add({
          targets: cloud,
          x: GAME_WIDTH + 250,
          duration: (distance / speed) * 1000,
          onComplete: () => {
            cloud.x = -250;
            travel();
          },
        });
      };
      travel();
    }
  }

  // --- Header -------------------------------------------------------------------------------

  private drawHeader(economy: EconomyState): void {
    const bar = this.add.image(0, 0, headerTexture(this)).setOrigin(0).setScale(1 / ART_RES).setScrollFactor(0).setDepth(30);
    bar.setInteractive();
    this.add.text(GAME_WIDTH / 2, 70, t('map.title'), outlined(56)).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    // Total stars, left.
    this.add.image(150, 70, counterPill(this, 200, 64)).setScale(1 / ART_RES).setScrollFactor(0).setDepth(31);
    this.add.image(66, 68, 'star').setScale(0.9).setScrollFactor(0).setDepth(32);
    this.add.text(104, 68, formatNumber(economy.stars, 0), outlined(36)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(32);
    // Close, right.
    const close = this.add.container(GAME_WIDTH - 80, 72).setScrollFactor(0).setDepth(32);
    const face = this.add.image(0, 0, glossyButton(this, 100, 100, { face: 0xec4a3c })).setScale(1 / ART_RES);
    const cross = this.add.text(0, -5, '✕', outlined(52)).setOrigin(0.5);
    close.add([face, cross]).setSize(100, 100).setInteractive({ useHandCursor: true });
    close.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.close();
    });
  }
}

// --- Painters --------------------------------------------------------------------------------

function chord(r: number, from: number): Phaser.Math.Vector2[] {
  // Points of the circle below the line y = r * (from - 0.5) * 2, for the ground strip.
  const cut = Math.asin(Phaser.Math.Clamp((from - 0.5) * 2, -1, 1));
  const points: Phaser.Math.Vector2[] = [];
  for (let a = cut; a <= Math.PI - cut; a += 0.08) points.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  return points;
}

const GRASS_TOP = '#7fcf5f';
const GRASS_BOTTOM = '#5fb84a';

function paintMeadow(ctx: Ctx, mapHeight: number, top: number, height: number, road: Phaser.Math.Vector2[], nodes: MapNode[]): void {
  ctx.fillStyle = vGradient(ctx, 0, mapHeight, [
    [0, '#9fdc7a'],
    [0.5, GRASS_TOP],
    [1, GRASS_BOTTOM],
  ]);
  ctx.fillRect(0, top, GAME_WIDTH, height);
  const random = seeded(7);
  // Lighter and darker grass patches.
  for (let i = 0; i < mapHeight / 60; i++) {
    const x = random() * GAME_WIDTH;
    const y = random() * mapHeight;
    const r = 60 + random() * 140;
    ctx.fillStyle = random() < 0.5 ? 'rgba(255,255,200,0.10)' : 'rgba(30,90,20,0.08)';
    ellipse(ctx, x, y, r, r * 0.6);
    ctx.fill();
  }
  // Road: shadow, edge, sand, dashes.
  const stroke = (width: number, color: string, dash: number[] = []) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    road.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  };
  ctx.save();
  ctx.translate(0, 8);
  stroke(ROAD_WIDTH + 14, 'rgba(40,70,20,0.3)');
  ctx.restore();
  stroke(ROAD_WIDTH + 12, '#b07a48');
  stroke(ROAD_WIDTH, '#f3d9a4');
  stroke(ROAD_WIDTH - 26, '#f8e6c0');
  stroke(6, 'rgba(255,255,255,0.7)', [18, 26]);
  // Trees and flowers, kept off the road, the river and the city circles.
  const roadNear = (x: number, y: number) => road.some((p) => Math.abs(p.y - y) < 60 && Math.abs(p.x - x) < ROAD_WIDTH + 40);
  const ponds: { x: number; y: number }[] = [];
  const nodeNear = (x: number, y: number) => nodes.some((n) => Phaser.Math.Distance.Between(n.x, n.y, x, y) < NODE_RADIUS + 150);
  // Ponds with lily pads, away from the road and the cities.
  for (let i = 0; i < mapHeight / 700; i++) {
    const x = 120 + random() * (GAME_WIDTH - 240);
    const y = 300 + random() * (mapHeight - 600);
    if (roadNear(x, y) || nodeNear(x, y) || road.some((p) => Phaser.Math.Distance.Between(p.x, p.y, x, y) < 190)) continue;
    paintPond(ctx, x, y, 90 + random() * 50, random);
    ponds.push({ x, y });
  }
  const pondNear = (x: number, y: number) => ponds.some((p) => Phaser.Math.Distance.Between(p.x, p.y, x, y) < 170);
  for (let i = 0; i < mapHeight / 22; i++) {
    const x = random() * GAME_WIDTH;
    const y = random() * mapHeight;
    if (y < top - 120 || y > top + height + 120) continue;
    if (roadNear(x, y) || nodeNear(x, y) || pondNear(x, y)) continue;
    if (random() < 0.6) paintTree(ctx, x, y, 22 + random() * 18, random);
    else paintFlowers(ctx, x, y, random);
  }
}

const TREE_GREENS = ['#3f9a3a', '#4aa83f', '#2f8a3a', '#58b24a'];
const FLOWER_COLORS = ['#ff7a9a', '#ffd34d', '#ffffff', '#c58aff', '#ff8a4a'];

function paintTree(ctx: Ctx, x: number, y: number, r: number, random: () => number): void {
  ctx.fillStyle = 'rgba(30,60,15,0.3)';
  ellipse(ctx, x + r * 0.3, y + r * 0.9, r * 1.1, r * 0.45);
  ctx.fill();
  ctx.fillStyle = '#7a4a2a';
  ctx.fillRect(x - r * 0.12, y, r * 0.24, r * 0.8);
  const green = TREE_GREENS[Math.floor(random() * TREE_GREENS.length)];
  [
    [0, -r * 0.2, r],
    [-r * 0.55, r * 0.15, r * 0.7],
    [r * 0.55, r * 0.15, r * 0.7],
  ].forEach(([dx, dy, rr]) => {
    ctx.fillStyle = radial(ctx, x + dx, y + dy, 1, rr, [
      [0, css(parseInt(green.slice(1), 16), 0.35)],
      [1, green],
    ], x + dx - rr * 0.3, y + dy - rr * 0.4);
    ellipse(ctx, x + dx, y + dy, rr, rr);
    ctx.fill();
  });
  if (random() < 0.3) {
    ctx.fillStyle = '#ff5a4a';
    for (let i = 0; i < 4; i++) {
      ellipse(ctx, x + (random() - 0.5) * r * 1.2, y - r * 0.3 + (random() - 0.5) * r, 3.5, 3.5);
      ctx.fill();
    }
  }
}

function paintPond(ctx: Ctx, x: number, y: number, r: number, random: () => number): void {
  ctx.fillStyle = 'rgba(40,90,30,0.3)';
  ellipse(ctx, x, y + 6, r + 10, r * 0.6 + 8);
  ctx.fill();
  ctx.fillStyle = '#4fb4e8';
  ellipse(ctx, x, y, r, r * 0.6);
  ctx.fill();
  ctx.fillStyle = radial(ctx, x, y, 2, r, [
    [0, '#a8e6ff'],
    [1, 'rgba(127,208,244,0)'],
  ], x - r * 0.3, y - r * 0.2);
  ellipse(ctx, x, y, r * 0.85, r * 0.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 4; i++) {
    ellipse(ctx, x + (random() - 0.5) * r, y + (random() - 0.5) * r * 0.5, 10, 3);
    ctx.fill();
  }
  ctx.fillStyle = '#58b24a';
  for (let i = 0; i < 3; i++) {
    const px = x + (random() - 0.5) * r * 1.1;
    const py = y + (random() - 0.5) * r * 0.6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 12, 0.4, Math.PI * 2 - 0.2);
    ctx.closePath();
    ctx.fill();
  }
}

function paintFlowers(ctx: Ctx, x: number, y: number, random: () => number): void {
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)];
    ellipse(ctx, x + (random() - 0.5) * 50, y + (random() - 0.5) * 30, 4.5, 4.5);
    ctx.fill();
  }
}

function glowTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'map-glow', 120, 120, (ctx) => {
    ctx.fillStyle = radial(ctx, 60, 60, 0, 60, [
      [0, 'rgba(255,230,140,0.9)'],
      [0.5, 'rgba(255,210,90,0.35)'],
      [1, 'rgba(255,210,90,0)'],
    ]);
    ctx.fillRect(0, 0, 120, 120);
  });
}

const RING_COLORS: Record<NodeState, [string, string, string]> = {
  done: ['#e8fff0', '#8fe07a', '#3a9a2a'],
  current: ['#fff6c0', '#ffd34d', '#c88a00'],
  locked: ['#f0f0f4', '#b8bcc8', '#7a7f8c'],
};

function ringTexture(scene: Phaser.Scene, state: NodeState): string {
  const size = NODE_RADIUS * 2 + 30;
  return paintTexture(scene, `map-ring-${state}`, size, size, (ctx) => {
    const c = size / 2;
    const [light, mid, dark] = RING_COLORS[state];
    ctx.fillStyle = 'rgba(30,40,20,0.35)';
    ellipse(ctx, c, c + 8, NODE_RADIUS + 10, NODE_RADIUS + 10);
    ctx.fill();
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#3a2016';
    ellipse(ctx, c, c, NODE_RADIUS + 2, NODE_RADIUS + 2);
    ctx.stroke();
    const g = ctx.createLinearGradient(0, c - NODE_RADIUS, 0, c + NODE_RADIUS);
    g.addColorStop(0, light);
    g.addColorStop(0.5, mid);
    g.addColorStop(1, dark);
    ctx.lineWidth = 15;
    ctx.strokeStyle = g;
    ellipse(ctx, c, c, NODE_RADIUS + 2, NODE_RADIUS + 2);
    ctx.stroke();
    // Inner shadow on the picture, and a gloss arc on the rim.
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ellipse(ctx, c, c, NODE_RADIUS - 10, NODE_RADIUS - 10);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(c, c, NODE_RADIUS + 2, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
  });
}

function ribbonTexture(scene: Phaser.Scene, state: NodeState): string {
  const face = state === 'locked' ? 0x8a8fa0 : state === 'current' ? 0xec4a3c : 0x2fa4d8;
  return paintTexture(scene, `map-ribbon-${state}`, 330, 90, (ctx) => {
    const w = 290;
    const h = 58;
    const x = 20;
    const y = 12;
    // Folded tails.
    ctx.fillStyle = css(face, -0.45);
    [
      [x - 14, x + 30],
      [x + w + 14, x + w - 30],
    ].forEach(([outer, inner]) => {
      ctx.beginPath();
      ctx.moveTo(inner, y + 14);
      ctx.lineTo(outer, y + 14);
      ctx.lineTo(outer + (outer < inner ? 12 : -12), y + 14 + h / 2);
      ctx.lineTo(outer, y + h + 14);
      ctx.lineTo(inner, y + h + 14);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = '#3a2016';
    roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 14);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, y, y + h, [
      [0, css(face, 0.3)],
      [0.55, css(face)],
      [1, css(face, -0.25)],
    ]);
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    roundRect(ctx, x + 10, y + 4, w - 20, h * 0.35, 8);
    ctx.fill();
  });
}

function pinTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'map-pin', 110, 150, (ctx) => {
    ctx.translate(55, 146);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, 0, -2, 18, 6);
    ctx.fill();
    ctx.fillStyle = '#3a2016';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.bezierCurveTo(-44, -56, -50, -86, -48, -98);
    ctx.arc(0, -98, 48, Math.PI, 0);
    ctx.bezierCurveTo(50, -86, 44, -56, 0, -4);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, -140, -10, [
      [0, '#ff7a6a'],
      [1, '#c8281e'],
    ]);
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(-38, -58, -43, -86, -42, -98);
    ctx.arc(0, -98, 42, Math.PI, 0);
    ctx.bezierCurveTo(43, -86, 38, -58, 0, -12);
    ctx.fill();
    // White face with a little toque.
    ctx.fillStyle = '#fff8ec';
    ellipse(ctx, 0, -98, 26, 26);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-9, -108, 8, 0, Math.PI * 2);
    ctx.arc(0, -113, 10, 0, Math.PI * 2);
    ctx.arc(9, -108, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-11, -108, 22, 12);
    ctx.fillStyle = '#e0dad0';
    ctx.fillRect(-12, -98, 24, 4);
    ctx.fillStyle = '#3a2016';
    ellipse(ctx, -6, -88, 2.2, 2.6);
    ctx.fill();
    ellipse(ctx, 6, -88, 2.2, 2.6);
    ctx.fill();
    ctx.strokeStyle = '#c8384c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -84, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ellipse(ctx, -20, -122, 10, 6);
    ctx.fill();
  });
}

function cloudTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'map-cloud', 260, 120, (ctx) => {
    const puffs: [number, number, number][] = [
      [70, 72, 40],
      [120, 52, 50],
      [175, 66, 42],
      [210, 82, 30],
      [40, 88, 26],
    ];
    ctx.fillStyle = 'rgba(80,110,150,0.18)';
    puffs.forEach(([x, y, r]) => {
      ellipse(ctx, x + 6, y + 10, r, r);
      ctx.fill();
    });
    puffs.forEach(([x, y, r]) => {
      ctx.fillStyle = radial(ctx, x, y, 1, r, [
        [0, '#ffffff'],
        [1, '#e4eefa'],
      ], x - r * 0.3, y - r * 0.4);
      ellipse(ctx, x, y, r, r);
      ctx.fill();
    });
  });
}

function headerTexture(scene: Phaser.Scene): string {
  return paintTexture(scene, 'map-header', GAME_WIDTH, HEADER_HEIGHT, (ctx) => {
    ctx.fillStyle = 'rgba(20,30,60,0.3)';
    roundRect(ctx, 0, 8, GAME_WIDTH, HEADER_HEIGHT - 14, [0, 0, 40, 40]);
    ctx.fill();
    ctx.fillStyle = vGradient(ctx, 0, HEADER_HEIGHT - 20, [
      [0, '#5aa8f0'],
      [1, '#2f6fc8'],
    ]);
    roundRect(ctx, 0, 0, GAME_WIDTH, HEADER_HEIGHT - 20, [0, 0, 40, 40]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, 30, 10, GAME_WIDTH - 60, 40, 20);
    ctx.fill();
    ctx.strokeStyle = '#fff4dc';
    ctx.lineWidth = 5;
    roundRect(ctx, -10, -10, GAME_WIDTH + 20, HEADER_HEIGHT - 12, [0, 0, 44, 44]);
    ctx.stroke();
  });
}
