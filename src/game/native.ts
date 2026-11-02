import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ads } from './ads/AdService';

// Android-only behavior.
export function setUpNativeApp(): void {
  if (!Capacitor.isNativePlatform()) return;
  // Full screen (system bars hidden in capacitor.config.ts): any band left around the canvas
  // takes the HUD color on top and the panel color at the bottom.
  document.documentElement.classList.add('native');
  // The back button would otherwise close the app (and the game would start over from the
  // save); an idle game should go to the background instead, like Home.
  void App.addListener('backButton', () => void App.minimizeApp());
  void ads.init();
}
