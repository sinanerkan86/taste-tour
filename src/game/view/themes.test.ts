import { describe, expect, it } from 'vitest';
import { CITIES } from '../../core/economy';
import { CITY_THEMES } from './themes';

describe('city themes', () => {
  it('give every city its own look', () => {
    for (const city of CITIES) expect(CITY_THEMES).toHaveProperty([city.id]);
  });
});
