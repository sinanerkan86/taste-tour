import { describe, expect, it } from 'vitest';
import { CITIES } from '../core/economy';
import en from './locales/en.json';
import tr from './locales/tr.json';

describe('locales', () => {
  it('translate the same keys', () => {
    expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
  });

  it('name every city and dish', () => {
    for (const city of CITIES) {
      expect(en).toHaveProperty([`city.${city.id}`]);
      for (const dish of city.dishes) expect(en).toHaveProperty([`dish.${dish}`]);
    }
  });
});
