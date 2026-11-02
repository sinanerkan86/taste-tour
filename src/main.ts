import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE, fitHeight } from './game/config';
import { setUpNativeApp } from './game/native';
import { BootScene } from './game/scenes/BootScene';
import { RestaurantScene } from './game/scenes/RestaurantScene';

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
  scene: [BootScene, RestaurantScene],
});

// Keep filling the screen when its usable height changes; the camera follows the new size.
window.addEventListener('resize', () => {
  const height = fitHeight();
  if (height !== game.scale.gameSize.height) game.scale.setGameSize(GAME_WIDTH, height);
});

setUpNativeApp();

// Dev-only handle for debugging from the browser console.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
