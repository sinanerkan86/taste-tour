import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE, fitHeight } from './game/config';
import { setUpNativeApp } from './game/native';
import { BootScene } from './game/scenes/BootScene';
import { RestaurantScene } from './game/scenes/RestaurantScene';
import { WorldMapScene } from './game/scenes/WorldMapScene';

// Canvas text is drawn once with whatever font is ready, so the game font loads first.
await Promise.all(['500', '600', '700'].map((weight) => document.fonts.load(`${weight} 40px Fredoka`))).catch(() => undefined);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: PALETTE.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, RestaurantScene, WorldMapScene],
});

// Keep filling the screen when its usable height changes; the camera follows the new size.
window.addEventListener('resize', () => {
  const height = fitHeight();
  if (height !== game.scale.gameSize.height) game.scale.setGameSize(GAME_WIDTH, height);
});

setUpNativeApp(game);

// Dev-only handle for debugging from the browser console.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
