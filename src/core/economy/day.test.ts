import { afterEach, describe, expect, it } from 'vitest';
import {
  DAY,
  SECTION_IDS,
  advanceCleaning,
  advanceDay,
  arrivalFactorAt,
  baseIncomePerSecond,
  callNightCrew,
  canCallNightCrew,
  cleanSeconds,
  cleanSpeed,
  clockText,
  deliveryFlow,
  incomeBreakdown,
  isOpen,
  CLEAN,
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
    expect(phaseAt(0.25)).toBe('lunch');
    expect(phaseAt(0.5)).toBe('afternoon');
    expect(phaseAt(0.7)).toBe('dinner');
    expect(phaseAt(0.9)).toBe('closed');
  });

  it('runs through the day and wraps around', () => {
    const state = newEconomy();
    advanceDay(state, DAY.lengthSeconds * 0.25);
    expect(dayPhase(state)).toBe('lunch');
    advanceDay(state, DAY.lengthSeconds * 0.8);
    expect(state.dayTime).toBeCloseTo(DAY.lengthSeconds * 0.05);
    expect(dayPhase(state)).toBe('morning');
  });

  it('changes arrivals smoothly: rushes up, closed none, morning and afternoon plain', () => {
    expect(arrivalFactorAt(0.1)).toBe(1);
    expect(arrivalFactorAt(0.25)).toBe(DAY.rushArrivals);
    expect(arrivalFactorAt(0.5)).toBe(1);
    expect(arrivalFactorAt(0.7)).toBe(DAY.rushArrivals);
    expect(arrivalFactorAt(0.9)).toBe(0);
    // Halfway through the ramp into lunch.
    const start = DAY.phases[0].end;
    expect(arrivalFactorAt(start + DAY.rampFraction / 2)).toBeCloseTo((1 + DAY.rushArrivals) / 2);
    // No jump anywhere except the sharp closing: neighbouring points differ by a small step.
    const closing = DAY.phases[DAY.phases.length - 2].end;
    for (let i = 0; i < 999; i++) {
      if (i / 1000 < closing && (i + 1) / 1000 >= closing) continue;
      expect(Math.abs(arrivalFactorAt((i + 1) / 1000) - arrivalFactorAt(i / 1000))).toBeLessThan(0.2);
    }
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
    setDayPhase(state, 'closed');
    info = dayInfo(state);
    expect(info.nextRush).toBe('lunch');
    expect(info.secondsToRush).toBeGreaterThan(info.secondsLeft);
  });

  it('jumps to a phase', () => {
    const state = newEconomy();
    for (const id of ['morning', 'lunch', 'afternoon', 'dinner', 'closed'] as const) {
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

  it('a rush pays more, closed hours less, and morning is plain', () => {
    const state = entranceLimited();
    expect(dayBonusPerSecond(state, 1)).toBe(0);
    expect(dayBonusPerSecond(state, DAY.rushArrivals)).toBeGreaterThan(0);
    expect(dayBonusPerSecond(state, 0)).toBeLessThan(0);
    // The entrance sets the flow, so a rush raises customers per second.
    expect(throughput(state, DAY.rushArrivals).customersPerSecond).toBeGreaterThan(throughput(state).customersPerSecond);
    expect(sectionRates(state, DAY.rushArrivals).entrance).toBeCloseTo(sectionRates(state).entrance * DAY.rushArrivals);
  });

  it('keeps the net effect of the day small: rushes roughly make up for the closed hours', () => {
    const state = entranceLimited();
    const share = dayAverageBonusPerSecond(state) / baseIncomePerSecond(state);
    expect(share).toBeGreaterThan(-0.05);
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

describe('opening hours and night cleaning', () => {
  it('maps the day to a clock from 09:00 to 22:00 and on through the night', () => {
    expect(clockText(0)).toBe('09:00');
    expect(clockText(DAY.openShare / 2)).toBe('15:30');
    expect(clockText(DAY.openShare)).toBe('22:00');
    expect(clockText(DAY.openShare + (1 - DAY.openShare) / 2)).toBe('03:30');
    expect(clockText(0.9999)).toBe('08:59');
  });

  it('closing leaves the restaurant dirty and closed, cleaning opens it at 09:00', () => {
    const state = newEconomy();
    expect(isOpen(state)).toBe(true);
    setDayPhase(state, 'dinner');
    advanceDay(state, DAY.lengthSeconds * 0.2);
    expect(dayPhase(state)).toBe('closed');
    expect(isOpen(state)).toBe(false);
    expect(state.cleanProgress).toBe(0);
    expect(state.dayIndex).toBe(1);
    expect(dayArrivalMultiplier(state)).toBe(0);
    // Cleaned in time: opens exactly with the morning.
    advanceCleaning(state, cleanSeconds(state));
    expect(state.cleanProgress).toBe(1);
    expect(isOpen(state)).toBe(false);
    advanceDay(state, DAY.lengthSeconds * 0.15);
    expect(dayPhase(state)).toBe('morning');
    expect(isOpen(state)).toBe(true);
  });

  it('opens late when the cleaning is not done at 09:00', () => {
    const state = newEconomy();
    setDayPhase(state, 'closed');
    advanceCleaning(state, cleanSeconds(state) * 0.7);
    advanceDay(state, DAY.lengthSeconds * 0.3);
    expect(dayPhase(state)).toBe('morning');
    expect(isOpen(state)).toBe(false);
    expect(dayArrivalMultiplier(state)).toBe(0);
    advanceCleaning(state, cleanSeconds(state) * 0.3);
    expect(isOpen(state)).toBe(true);
    expect(dayArrivalMultiplier(state)).toBeGreaterThan(0);
  });

  it('cleans nothing once the restaurant is clean and open', () => {
    const state = newEconomy();
    advanceCleaning(state, 10);
    expect(state.cleanProgress).toBe(1);
    expect(isOpen(state)).toBe(true);
  });

  it('a dish pit with spare capacity cleans faster', () => {
    const slow = newEconomy();
    for (const id of SECTION_IDS) slow.sectionLevels[id] = 40;
    slow.sectionLevels.dishwashing = 5;
    const fast = newEconomy();
    for (const id of SECTION_IDS) fast.sectionLevels[id] = 40;
    fast.sectionLevels.dishwashing = 200;
    expect(cleanSpeed(slow)).toBe(1);
    expect(cleanSeconds(slow)).toBe(CLEAN.baseSeconds);
    expect(cleanSpeed(fast)).toBeGreaterThan(1.2);
    expect(cleanSpeed(fast)).toBeLessThanOrEqual(1 + CLEAN.maxSpeedup);
    expect(cleanSeconds(fast)).toBeLessThan(CLEAN.baseSeconds * 0.85);
  });

  it('the night crew finishes the cleaning once per day', () => {
    const state = newEconomy();
    expect(canCallNightCrew(state)).toBe(false);
    setDayPhase(state, 'closed');
    expect(canCallNightCrew(state)).toBe(true);
    callNightCrew(state);
    expect(isOpen(state)).toBe(true);
    expect(dayPhase(state)).toBe('morning');
    expect(state.cleanProgress).toBe(1);
    // The next night it is available again, but only once.
    advanceDay(state, DAY.lengthSeconds * 0.9);
    expect(dayPhase(state)).toBe('closed');
    expect(canCallNightCrew(state)).toBe(true);
    callNightCrew(state);
    expect(canCallNightCrew(state)).toBe(false);
  });

  it('the night crew also works for a late opening, once for that night', () => {
    const state = newEconomy();
    setDayPhase(state, 'closed');
    advanceDay(state, DAY.lengthSeconds * 0.2);
    expect(isOpen(state)).toBe(false);
    expect(canCallNightCrew(state)).toBe(true);
    callNightCrew(state);
    expect(isOpen(state)).toBe(true);
    expect(canCallNightCrew(state)).toBe(false);
  });

  it('couriers get the whole kitchen while the dining room is closed', () => {
    const state = entranceLimited();
    state.deliveryLevel = 500;
    const open = deliveryFlow(state, 1);
    const closed = deliveryFlow(state, 0);
    expect(closed.kitchenSpare).toBeCloseTo(sectionRates(state).kitchen);
    expect(closed.kitchenSpare).toBeGreaterThan(open.kitchenSpare);
    expect(closed.ordersPerSecond).toBeGreaterThan(open.ordersPerSecond);
    expect(incomeBreakdown(state, 0).dineIn).toBe(0);
    expect(incomeBreakdown(state, 0).delivery).toBeGreaterThan(incomeBreakdown(state, 1).delivery);
  });

  it('repairs the cleaning fields in a save', () => {
    const state = newEconomy();
    const raw = JSON.parse(serializeSave(createSave(state, 0)));
    delete raw.economy.cleanProgress;
    delete raw.economy.dayIndex;
    delete raw.economy.nightCrewUsed;
    let loaded = parseSave(JSON.stringify(raw))!.economy;
    expect(loaded.cleanProgress).toBe(1);
    expect(loaded.dayIndex).toBe(0);
    expect(loaded.nightCrewUsed).toBe(-1);
    raw.economy.cleanProgress = 7;
    raw.economy.dayIndex = 'x';
    expect(parseSave(JSON.stringify(raw))!.economy.cleanProgress).toBe(1);
    raw.economy.cleanProgress = 0.4;
    raw.economy.dayIndex = 3;
    raw.economy.nightCrewUsed = 2;
    loaded = parseSave(JSON.stringify(raw))!.economy;
    expect(loaded.cleanProgress).toBe(0.4);
    expect(loaded.dayIndex).toBe(3);
    expect(loaded.nightCrewUsed).toBe(2);
    expect(prestige(loaded).cleanProgress).toBe(0.4);
  });
});
