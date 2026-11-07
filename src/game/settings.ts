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
  // Phone reminders (lab done, till full, Rush over), and whether the system permission was asked for.
  notifications: boolean;
  notificationsAsked: boolean;
}

const SETTINGS_KEY = 'taste-tour.settings';

export const settings: Settings = { buyAmount: 1, sound: true, music: true, language: null, notifications: true, notificationsAsked: false };

export async function loadSettings(): Promise<void> {
  const json = await saves.store.get(SETTINGS_KEY);
  if (json === null) return;
  try {
    const raw = JSON.parse(json) as Partial<Settings>;
    if (BUY_AMOUNTS.includes(raw.buyAmount as BuyAmount)) settings.buyAmount = raw.buyAmount as BuyAmount;
    if (typeof raw.sound === 'boolean') settings.sound = raw.sound;
    if (typeof raw.music === 'boolean') settings.music = raw.music;
    if (isLocale(raw.language)) settings.language = raw.language;
    if (typeof raw.notifications === 'boolean') settings.notifications = raw.notifications;
    if (typeof raw.notificationsAsked === 'boolean') settings.notificationsAsked = raw.notificationsAsked;
  } catch {
    // Broken settings: keep the defaults.
  }
  if (settings.language) setLocale(settings.language);
}

export function saveSettings(): void {
  void saves.store.set(SETTINGS_KEY, JSON.stringify(settings));
}
