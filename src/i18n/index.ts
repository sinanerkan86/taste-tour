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

// t('row.level', { level: 5 }) -> "Lv 5"
export function t(key: TranslationKey, params: Record<string, string | number> = {}): string {
  const template = LOCALES[current][key] ?? LOCALES.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
