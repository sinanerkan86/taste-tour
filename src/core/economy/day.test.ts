import { afterEach, describe, expect, it } from 'vitest';
import {
  DAY,
  SECTION_IDS,
  advanceDay,
  arrivalFactorAt,
  baseIncomePerSecond,
  dayArrivalMultiplier,
  dayAverageBonusPerSecond,
  dayBonusPerSecond,
  dayInfo,
  dayLength,
  dayPhase,
  newEconomy,
  phaseAt,
  prestige,
  setDayLength,
  setDayPhase,
  sectionRates,
  throughput,
  type EconomyState,
} from '.';
import { createSave, parseSave, serializeSave } from '../save';

afterEach(() => setDayLength(null));

// A restaurant whose entrance is the weakest section, so arrivals set the income.
function entranceLimited(): EconomyState {
  const state = newEconomy();
  for (const id of SECTION_IDS) state.sectionLevels[id] = 40;
  state.sectionLevels.entrance = 10;
  return state;
}

describe('restaurant day', () => {
  it('starts in the morning and the phases follow the config', () => {
    const state = newEconomy();
    expect(state.dayTime).toBe(0);
    expect(dayPhase(state)).toBe('morning');
    expect(phaseAt(0.2)).toBe('lunch');
    expect(phaseAt(0.4)).toBe('afternoon');
    expect(phaseAt(0.6)).toBe('dinner');
    expect(phaseAt(0.9)).toBe('night');
  });

  it('runs through the day and wraps around', () => {
    const state = newEconomy();
    advanceDay(state, DAY.lengthSeconds * 0.25);
    expect(dayPhase(state)).toBe('lunch');
    advanceDay(state, DAY.lengthSeconds * 0.8);
    expect(state.dayTime).toBeCloseTo(DAY.lengthSeconds * 0.05);
    expect(dayPhase(state)).toBe('morning');
  });

  it('changes arrivals smoothly: rushes up, night down, morning and afternoon plain', () => {
    expect(arrivalFactorAt(0.1)).toBe(1);
    expect(arrivalFactorAt(0.25)).toBe(DAY.rushArrivals);
    expect(arrivalFactorAt(0.45)).toBe(1);
    expect(arrivalFactorAt(0.7)).toBe(DAY.rushArrivals);
    expect(arrivalFactorAt(0.9)).toBe(DAY.nightArrivals);
    // Halfway through the ramp into lunch.
    const start = DAY.phases[0].end;
    expect(arrivalFactorAt(start + DAY.rampFraction / 2)).toBeCloseTo((1 + DAY.rushArrivals) / 2);
    // No jump anywhere: neighbouring points differ by a small step.
    for (let i = 0; i < 999; i++) expect(Math.abs(arrivalFactorAt((i + 1) / 1000) - arrivalFactorAt(i / 1000))).toBeLessThan(0.1);
  });

  it('reports the next rush and the time left', () => {
    const state = newEconomy();
    let info = dayInfo(state);
    expect(info.phase).toBe('morning');
    expect(info.nextRush).toBe('lunch');
    expect(info.secondsToRush).toBeCloseTo(DAY.phases[0].end * DAY.lengthSeconds);
    setDayPhase(state, 'lunch');
    info = dayInfo(state);
    expect(info.phase).toBe('lunch');
    expect(info.secondsToRush).toBe(0);
    setDayPhase(state, 'afternoon');
    info = dayInfo(state);
    expect(info.nextRush).toBe('dinner');
    setDayPhase(state, 'night');
    info = dayInfo(state);
    expect(info.nextRush).toBe('lunch');
    expect(info.secondsToRush).toBeGreaterThan(info.secondsLeft);
  });

  it('jumps to a phase', () => {
    const state = newEconomy();
    for (const id of ['morning', 'lunch', 'afternoon', 'dinner', 'night'] as const) {
      setDayPhase(state, id);
      expect(dayPhase(state)).toBe(id);
    }
    setDayPhase(state, 'dinner');
    expect(dayArrivalMultiplier(state)).toBe(DAY.rushArrivals);
  });

  it('a short dev day keeps the proportions', () => {
    setDayLength(60);
    expect(dayLength()).toBe(60);
    const state = newEconomy();
    advanceDay(state, 15);
    expect(dayPhase(state)).toBe('lunch');
  });

  it('a rush pays more, the night less, and morning is plain', () => {
    const state = entranceLimited();
    expect(dayBonusPerSecond(state, 1)).toBe(0);
    expect(dayBonusPerSecond(state, DAY.rushArrivals)).toBeGreaterThan(0);
    expect(dayBonusPerSecond(state, DAY.nightArrivals)).toBeLessThan(0);
    // The entrance sets the flow, so a rush raises customers per second.
    expect(throughput(state, DAY.rushArrivals).customersPerSecond).toBeGreaterThan(throughput(state).customersPerSecond);
    expect(sectionRates(state, DAY.rushArrivals).entrance).toBeCloseTo(sectionRates(state).entrance * DAY.rushArrivals);
  });

  it('adds a modest net bonus over the day', () => {
    const state = entranceLimited();
    const share = dayAverageBonusPerSecond(state) / baseIncomePerSecond(state);
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.15);
  });

  it('saves the day and keeps it through a franchise', () => {
    const state = newEconomy();
    setDayPhase(state, 'dinner');
    const loaded = parseSave(serializeSave(createSave(state, 0)));
    expect(loaded?.economy.dayTime).toBeCloseTo(state.dayTime);
    expect(prestige(state).dayTime).toBe(state.dayTime);
  });

  it('repairs a broken day in a save', () => {
    const state = newEconomy();
    const raw = JSON.parse(serializeSave(createSave(state, 0)));
    raw.economy.dayTime = 'noon';
    expect(parseSave(JSON.stringify(raw))?.economy.dayTime).toBe(0);
    raw.economy.dayTime = DAY.lengthSeconds * 3 + 30;
    expect(parseSave(JSON.stringify(raw))?.economy.dayTime).toBeCloseTo(30);
    delete raw.economy.dayTime;
    expect(parseSave(JSON.stringify(raw))?.economy.dayTime).toBe(0);
  });
});
