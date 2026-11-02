import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { EconomyState } from '../core/economy';
import { createSave, parseSave, serializeSave, type SaveData } from '../core/save';

// Async on purpose: on Android the store is Capacitor Preferences, which is async.
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

// Browser storage. Can throw in private windows or when storage is blocked; the game then
// simply runs without saving.
export const localStore: KeyValueStore = {
  async get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage full or blocked.
    }
  },
  async remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked.
    }
  },
};

// Android app storage (SharedPreferences): unlike WebView localStorage, it is not cleared
// together with the WebView cache.
export const preferencesStore: KeyValueStore = {
  async get(key) {
    return (await Preferences.get({ key })).value;
  },
  async set(key, value) {
    await Preferences.set({ key, value });
  },
  async remove(key) {
    await Preferences.remove({ key });
  },
};

const SAVE_KEY = 'taste-tour.save';

export class SaveManager {
  constructor(private readonly store: KeyValueStore = localStore) {}

  async load(): Promise<SaveData | null> {
    const json = await this.store.get(SAVE_KEY);
    return json === null ? null : parseSave(json);
  }

  save(economy: EconomyState, seenHints: string[] = []): Promise<void> {
    return this.store.set(SAVE_KEY, serializeSave(createSave(economy, Date.now(), seenHints)));
  }

  clear(): Promise<void> {
    return this.store.remove(SAVE_KEY);
  }
}

export const saves = new SaveManager(Capacitor.isNativePlatform() ? preferencesStore : localStore);
