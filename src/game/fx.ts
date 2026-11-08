import Phaser from 'phaser';
import { glossyButton, outlined } from './ui/style';
import { ART_RES } from './view/paint';
import { GAME_WIDTH, PALETTE } from './config';

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

export function confetti(scene: Phaser.Scene, x: number, y: number, depth = FX_DEPTH): void {
  explode(scene, x, y, 'confetti', 36, {
    speed: { min: 500, max: 1000 },
    angle: { min: 220, max: 320 },
    rotate: { min: 0, max: 360 },
    gravityY: 1600,
    scale: { start: 1.6, end: 1 },
    lifespan: 1400,
    tint: CONFETTI_TINTS,
  }, depth);
}

// Fireworks: [x, y] as a fraction of the screen, and when each rocket launches (ms).
const FIREWORKS = [
  { x: 0.26, y: 0.2, delay: 0 },
  { x: 0.76, y: 0.28, delay: 170 },
  { x: 0.5, y: 0.12, delay: 360 },
  { x: 0.16, y: 0.44, delay: 540 },
  { x: 0.84, y: 0.5, delay: 720 },
  { x: 0.5, y: 0.36, delay: 920 },
];
const FIREWORK_TINTS = [PALETTE.pomegranate, PALETTE.saffron, PALETTE.tileBlue, PALETTE.success, 0xff7ac6, 0xffffff];
const ROCKET_MS = 300;
const CONFETTI_RAIN_MS = 1000;
const CONFETTI_RAIN_LIFE_MS = 2300;

function launchFirework(scene: Phaser.Scene, x: number, y: number, tint: number, depth: number, onBurst: () => void): void {
  const rocket = scene.add.image(x, scene.scale.height + 20, 'spark').setTint(tint).setDepth(depth).setScale(1.1);
  scene.tweens.add({
    targets: rocket,
    y,
    scale: 0.5,
    duration: ROCKET_MS,
    ease: 'Quad.easeOut',
    onComplete: () => {
      rocket.destroy();
      onBurst();
      explode(scene, x, y, 'spark', 48, {
        speed: { min: 140, max: 640 },
        gravityY: 420,
        scale: { start: 1.5, end: 0 },
        lifespan: 950,
        tint,
      }, depth);
      explode(scene, x, y, 'spark', 14, { speed: { min: 40, max: 200 }, scale: { start: 1.3, end: 0 }, lifespan: 500, tint: 0xffffff }, depth);
    },
  });
}

// The biggest celebration, across the whole screen for about 3 seconds: a warm flash, fireworks,
// confetti cannons from both sides and confetti raining from the top. It never blocks taps.
export function fireworksShow(scene: Phaser.Scene, depth: number, onBurst: () => void): void {
  const { width, height } = scene.scale;
  const flash = scene.add.rectangle(width / 2, height / 2, width, height, 0xfff1c2).setDepth(depth).setAlpha(0.55);
  scene.tweens.add({ targets: flash, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });

  FIREWORKS.forEach(({ x, y, delay }, i) => {
    const tint = FIREWORK_TINTS[i % FIREWORK_TINTS.length];
    scene.time.delayedCall(delay, () => launchFirework(scene, x * width, y * height, tint, depth, onBurst));
  });

  const cannon = { speed: { min: 900, max: 1700 }, rotate: { min: 0, max: 360 }, gravityY: 1500, scale: { start: 1.7, end: 1 }, lifespan: 1500, tint: CONFETTI_TINTS };
  explode(scene, 0, height * 0.72, 'confetti', 44, { ...cannon, angle: { min: 285, max: 335 } }, depth);
  explode(scene, width, height * 0.72, 'confetti', 44, { ...cannon, angle: { min: 205, max: 255 } }, depth);

  const rain = scene.add
    .particles(0, -30, 'confetti', {
      x: { min: 0, max: width },
      speedY: { min: 450, max: 900 },
      speedX: { min: -140, max: 140 },
      rotate: { start: 0, end: 540 },
      gravityY: 500,
      scale: { min: 1.1, max: 1.8 },
      lifespan: CONFETTI_RAIN_LIFE_MS,
      frequency: 14,
      quantity: 2,
      tint: CONFETTI_TINTS,
    })
    .setDepth(depth);
  scene.time.delayedCall(CONFETTI_RAIN_MS, () => rain.stop());
  scene.time.delayedCall(CONFETTI_RAIN_MS + CONFETTI_RAIN_LIFE_MS + 200, () => rain.destroy());
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
    .text(x, y, text, outlined(size, { color }))
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

export function banner(scene: Phaser.Scene, y: number, text: string, color: number = PALETTE.pomegranate, depth = FX_DEPTH + 1): void {
  activeBanner?.destroy();
  const label = scene.add.text(0, -4, text, outlined(54)).setOrigin(0.5);
  const width = Math.round(Math.min(label.width + 110, GAME_WIDTH - 40));
  label.setScale(Math.min(1, (width - 80) / label.width));
  const bg = scene.add.image(0, 0, glossyButton(scene, width, 110, { face: color, rim: 0xffe9a8 })).setScale(1 / ART_RES);
  const container = scene.add.container(GAME_WIDTH / 2, y, [bg, label]).setDepth(depth).setScale(0);
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
