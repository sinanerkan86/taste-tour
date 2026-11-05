import { describe, expect, it } from 'vitest';
import { CITIES } from '../core/economy';
import en from './locales/en.json';
import fr from './locales/fr.json';
import tr from './locales/tr.json';
import zh from './locales/zh.json';

const OTHERS = { tr, fr, zh };
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('locales', () => {
  it.each(Object.entries(OTHERS))('%s translates the same keys as en', (_, locale) => {
    expect(Object.keys(locale).sort()).toEqual(Object.keys(en).sort());
  });

  // A translation may leave a value out (a short button label), but never use one that is not passed.
  it.each(Object.entries(OTHERS))('%s only uses placeholders that en uses', (_, locale) => {
    for (const [key, text] of Object.entries(en)) {
      const known = placeholders(text);
      for (const name of placeholders((locale as Record<string, string>)[key])) expect(known, key).toContain(name);
    }
  });

  it('name every city and dish', () => {
    for (const city of CITIES) {
      expect(en).toHaveProperty([`city.${city.id}`]);
      for (const dish of city.dishes) expect(en).toHaveProperty([`dish.${dish}`]);
    }
  });
});
