import { App } from '@capacitor/app';
import type Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { ads } from './ads/AdService';

// Android-only behavior.
export function setUpNativeApp(game: Phaser.Game): void {
  if (!Capacitor.isNativePlatform()) return;
  // Full screen (system bars hidden in capacitor.config.ts): any band left around the canvas
  // takes the HUD color on top and the panel color at the bottom.
  document.documentElement.classList.add('native');
  // The back button would otherwise close the app (and the game would start over from the
  // save); an idle game should go to the background instead, like Home.
  // An open world map closes first.
  void App.addListener('backButton', () => {
    if (game.scene.isActive('WorldMap')) game.scene.stop('WorldMap');
    else void App.minimizeApp();
  });
  void ads.init();
}

export const PRIVACY_POLICY_URL = 'https://sinanerkan86.github.io/taste-tour-privacy/';

// Opens a web page outside the game. On Android, Capacitor hands any address that is not the
// game itself to the system browser; in the browser build it opens a new tab.
export function openExternal(url: string): void {
  if (Capacitor.isNativePlatform()) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}
