import en from './locales/en.json';
import fr from './locales/fr.json';
import tr from './locales/tr.json';
import zh from './locales/zh.json';

export type TranslationKey = keyof typeof en;
export type Locale = 'en' | 'tr' | 'fr' | 'zh';

// Every locale must define every key en defines (checked by the i18n test).
const LOCALES: Record<Locale, Record<TranslationKey, string>> = { en, tr, fr, zh };

// Languages offered in the settings, each named in its own language.
export const LANGUAGES: { id: Locale; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'tr', name: 'Türkçe' },
  { id: 'fr', name: 'Français' },
  { id: 'zh', name: '中文' },
];

export function isLocale(value: unknown): value is Locale {
  return LANGUAGES.some((language) => language.id === value);
}

// The device language when the game supports it, else English.
export function deviceLocale(): Locale {
  const lang = typeof navigator === 'undefined' ? 'en' : navigator.language.toLowerCase();
  const short = lang.slice(0, 2);
  return isLocale(short) ? short : 'en';
}

let current: Locale = deviceLocale();

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

// Localized duration: 3725 -> "1h 2m" / "1sa 2dk"
export function tDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return t('time.hm', { h, m });
  if (m > 0) return t('time.ms', { m, s });
  return t('time.s', { s });
}

// Rounded duration for fixed lengths: 10800 -> "3h", 5400 -> "1h 30m", 180 -> "3m".
export function tDurationShort(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h > 0) return m > 0 ? t('time.hm', { h, m }) : t('time.h', { h });
  if (m > 0) return t('time.m', { m });
  return t('time.s', { s: total });
}

// t('row.level', { level: 5 }) -> "Lv 5"
export function t(key: TranslationKey, params: Record<string, string | number> = {}): string {
  const template = LOCALES[current][key] ?? LOCALES.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
