import { BUY_AMOUNTS, type BuyAmount } from '../core/economy';
import { type Locale, isLocale, setLocale } from '../i18n';
import { saves } from './persistence';

// Player preferences, kept apart from the game save so a franchise or a reset never touches them.
export interface Settings {
  buyAmount: BuyAmount;
  sound: boolean;
  music: boolean;
  // Chosen language; null follows the device language.
  language: Locale | null;
}

const SETTINGS_KEY = 'taste-tour.settings';

export const settings: Settings = { buyAmount: 1, sound: true, music: true, language: null };

export async function loadSettings(): Promise<void> {
  const json = await saves.store.get(SETTINGS_KEY);
  if (json === null) return;
  try {
    const raw = JSON.parse(json) as Partial<Settings>;
    if (BUY_AMOUNTS.includes(raw.buyAmount as BuyAmount)) settings.buyAmount = raw.buyAmount as BuyAmount;
    if (typeof raw.sound === 'boolean') settings.sound = raw.sound;
    if (typeof raw.music === 'boolean') settings.music = raw.music;
    if (isLocale(raw.language)) settings.language = raw.language;
  } catch {
    // Broken settings: keep the defaults.
  }
  if (settings.language) setLocale(settings.language);
}

export function saveSettings(): void {
  void saves.store.set(SETTINGS_KEY, JSON.stringify(settings));
}
