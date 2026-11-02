import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber } from './format';

describe('formatNumber', () => {
  it('keeps small numbers readable', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(2.5)).toBe('2.5');
    expect(formatNumber(999)).toBe('999');
  });

  it('uses short suffixes up to trillions', () => {
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatNumber(45_600_000)).toBe('45.6M');
    expect(formatNumber(7.8e9)).toBe('7.80B');
    expect(formatNumber(1e12)).toBe('1.00T');
  });

  it('switches to letter suffixes after trillions', () => {
    expect(formatNumber(1e15)).toBe('1.00aa');
    expect(formatNumber(1e18)).toBe('1.00ab');
    expect(formatNumber(1e15 * 1000 ** 26)).toBe('1.00ba');
  });

  it('never shows 1000 before a suffix', () => {
    expect(formatNumber(999_999)).toBe('1.00M');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(42)).toBe('42s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3725)).toBe('1h 2m');
  });
});
