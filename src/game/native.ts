import { App } from '@capacitor/app';
import type Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { ads } from './ads/AdService';
import { notifications } from './notifications';

// Android-only behavior.
export function setUpNativeApp(game: Phaser.Game): void {
  if (!Capacitor.isNativePlatform()) return;
  // Full screen (system bars hidden in capacitor.config.ts): any band left around the canvas
  // takes the HUD color on top and the panel color at the bottom.
  document.documentElement.classList.add('native');
  // The back button would otherwise close the app (and the game would start over from the
  // save); an idle game should go to the background instead, like Home.
  // An open world map or upgrade drawer closes first.
  void App.addListener('backButton', () => {
    const restaurant = game.scene.getScene('Restaurant') as { closeDrawer?: () => boolean } | null;
    if (game.scene.isActive('WorldMap')) game.scene.stop('WorldMap');
    else if (game.scene.isActive('Restaurant') && restaurant?.closeDrawer?.()) return;
    else void App.minimizeApp();
  });
  void ads.init();
  // Reminders from the last absence are of no use once the game is open.
  void notifications.cancel();
}

export const PRIVACY_POLICY_URL = 'https://sinanerkan86.github.io/taste-tour-privacy/';

// Opens a web page outside the game. On Android, Capacitor hands any address that is not the
// game itself to the system browser; in the browser build it opens a new tab.
export function openExternal(url: string): void {
  if (Capacitor.isNativePlatform()) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}
