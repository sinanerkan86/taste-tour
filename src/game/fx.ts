import Phaser from 'phaser';
import { FONT, GAME_WIDTH, PALETTE, toCss } from './config';

// Objects at or above this depth are screen UI (HUD, panel, banners, dialogs) and ignore the
// restaurant camera's zoom and scroll; everything below lives in the restaurant world.
export const UI_LAYER_DEPTH = 8000;
// Effects inside the restaurant world (tap sparkles, payment popups), above the people.
export const ROOM_FX_DEPTH = 7000;
// Screen effects draw above the restaurant but below the HUD and panel.
export const FX_DEPTH = 9000;

const CONFETTI_TINTS = [PALETTE.pomegranate, PALETTE.saffron, PALETTE.tileBlue, PALETTE.success, 0xffffff];

// One-shot particle explosion that cleans itself up.
function explode(
  scene: Phaser.Scene,
  x: number,
  y: number,
  texture: string,
  count: number,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  depth: number,
): void {
  const lifespan = typeof config.lifespan === 'number' ? config.lifespan : 1000;
  const emitter = scene.add.particles(x, y, texture, { ...config, emitting: false }).setDepth(depth);
  emitter.explode(count);
  scene.time.delayedCall(lifespan + 200, () => emitter.destroy());
}

export function sparkle(scene: Phaser.Scene, x: number, y: number, tint: number = PALETTE.saffron, depth = FX_DEPTH): void {
  const config = { speed: { min: 150, max: 380 }, scale: { start: 1, end: 0 }, lifespan: 450, tint };
  explode(scene, x, y, 'spark', 10, config, depth);
}

export function confetti(scene: Phaser.Scene, x: number, y: number): void {
  explode(scene, x, y, 'confetti', 36, {
    speed: { min: 500, max: 1000 },
    angle: { min: 220, max: 320 },
    rotate: { min: 0, max: 360 },
    gravityY: 1600,
    scale: { start: 1.6, end: 1 },
    lifespan: 1400,
    tint: CONFETTI_TINTS,
  }, FX_DEPTH);
}

export function floatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number = PALETTE.saffron,
  size = 42,
  depth = FX_DEPTH,
): void {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: toCss(color),
      stroke: toCss(PALETTE.ink),
      strokeThickness: 8,
    })
    .setOrigin(0.5)
    .setDepth(depth);
  scene.tweens.add({
    targets: label,
    y: y - 120,
    alpha: 0,
    duration: 900,
    ease: 'Quad.easeOut',
    onComplete: () => label.destroy(),
  });
}

// Big celebratory message across the restaurant; a new one replaces the current one.
let activeBanner: Phaser.GameObjects.Container | null = null;

export function banner(scene: Phaser.Scene, y: number, text: string, color: number = PALETTE.pomegranate): void {
  activeBanner?.destroy();
  const label = scene.add
    .text(0, 0, text, { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: toCss(PALETTE.cream) })
    .setOrigin(0.5);
  const width = Math.min(label.width + 100, GAME_WIDTH - 40);
  const bg = scene.add.graphics();
  bg.fillStyle(PALETTE.ink, 0.35).fillRoundedRect(-width / 2, -46 + 8, width, 92, 28);
  bg.fillStyle(color, 1).fillRoundedRect(-width / 2, -46, width, 92, 28);
  bg.lineStyle(5, PALETTE.saffron, 1).strokeRoundedRect(-width / 2, -46, width, 92, 28);
  const container = scene.add.container(GAME_WIDTH / 2, y, [bg, label]).setDepth(FX_DEPTH + 1).setScale(0);
  activeBanner = container;
  scene.tweens.chain({
    targets: container,
    tweens: [
      { scale: 1, duration: 280, ease: 'Back.easeOut' },
      { scale: 1, duration: 1300 },
      { y: y - 60, alpha: 0, duration: 350, ease: 'Quad.easeIn' },
    ],
    onComplete: () => {
      if (activeBanner === container) activeBanner = null;
      container.destroy();
    },
  });
}
