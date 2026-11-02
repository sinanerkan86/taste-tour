import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Android-only behavior. The Android back button would otherwise close the app (and the game
// would start over from the save); an idle game should go to the background instead, like Home.
export function setUpNativeApp(): void {
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener('backButton', () => void App.minimizeApp());
}
