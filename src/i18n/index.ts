import en from './locales/en.json';
import tr from './locales/tr.json';

export type TranslationKey = keyof typeof en;
type Locale = 'en' | 'tr';

// tr must define every key en defines.
const LOCALES: Record<Locale, Record<TranslationKey, string>> = { en, tr };

function detectLocale(): Locale {
  const lang = typeof navigator === 'undefined' ? 'en' : navigator.language.toLowerCase();
  return lang.startsWith('tr') ? 'tr' : 'en';
}

let current: Locale = detectLocale();

export function setLocale(locale: Locale): void {
  current = locale;
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

// t('row.level', { level: 5 }) -> "Lv 5"
export function t(key: TranslationKey, params: Record<string, string | number> = {}): string {
  const template = LOCALES[current][key] ?? LOCALES.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
