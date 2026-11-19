import { DAY, type DayPhaseId } from './config';
import { boostMultiplier, incomeBreakdown, type EconomyState } from './state';

// The restaurant's day (GDD 6g). While the game is open the restaurant lives through a short day:
// morning, a lunch rush, afternoon, a dinner rush and night. A rush brings more customers to the
// entrance, the night fewer. Offline earnings do not see it: the day only runs while the game is
// open, like the buses.

export const RUSH_PHASES: DayPhaseId[] = ['lunch', 'dinner'];

export function isRushPhase(phase: DayPhaseId): boolean {
  return RUSH_PHASES.includes(phase);
}

// Dev override (/?daylen=60) so a whole day can be watched quickly.
let lengthOverride: number | null = null;

export function setDayLength(seconds: number | null): void {
  lengthOverride = seconds !== null && seconds > 0 ? seconds : null;
}

export function dayLength(): number {
  return lengthOverride ?? DAY.lengthSeconds;
}

// Fraction of the day (0 to 1, exclusive) a time in seconds falls on.
export function dayFraction(dayTime: number): number {
  const length = dayLength();
  const wrapped = ((dayTime % length) + length) % length;
  return wrapped / length;
}

function phaseIndexAt(fraction: number): number {
  const index = DAY.phases.findIndex((phase) => fraction < phase.end);
  return index < 0 ? DAY.phases.length - 1 : index;
}

function phaseStart(index: number): number {
  return index === 0 ? 0 : DAY.phases[index - 1].end;
}

export function phaseAt(fraction: number): DayPhaseId {
  return DAY.phases[phaseIndexAt(fraction)].id;
}

function phaseFactor(id: DayPhaseId): number {
  return isRushPhase(id) ? DAY.rushArrivals : id === 'night' ? DAY.nightArrivals : 1;
}

// The entrance's arrival multiplier at a fraction of the day. A phase's factor is reached over
// DAY.rampFraction from the previous phase's factor, so the rate changes smoothly.
export function arrivalFactorAt(fraction: number): number {
  const index = phaseIndexAt(fraction);
  const target = phaseFactor(DAY.phases[index].id);
  const previous = phaseFactor(DAY.phases[(index + DAY.phases.length - 1) % DAY.phases.length].id);
  const into = fraction - phaseStart(index);
  if (into >= DAY.rampFraction) return target;
  return previous + (target - previous) * (into / DAY.rampFraction);
}

export function dayPhase(state: EconomyState): DayPhaseId {
  return phaseAt(dayFraction(state.dayTime));
}

// The multiplier on the entrance's arrivals right now.
export function dayArrivalMultiplier(state: EconomyState): number {
  return arrivalFactorAt(dayFraction(state.dayTime));
}

export interface DayInfo {
  phase: DayPhaseId;
  fraction: number;
  // Seconds until the phase ends.
  secondsLeft: number;
  // The next rush to come (the current one while it lasts) and the seconds until it starts (0 during it).
  nextRush: 'lunch' | 'dinner';
  secondsToRush: number;
}

export function dayInfo(state: EconomyState): DayInfo {
  const length = dayLength();
  const fraction = dayFraction(state.dayTime);
  const index = phaseIndexAt(fraction);
  const phase = DAY.phases[index].id;
  const secondsLeft = (DAY.phases[index].end - fraction) * length;
  // Walk forward through the phases to the next lunch or dinner.
  let nextRush: 'lunch' | 'dinner' = 'lunch';
  let secondsToRush = 0;
  if (!isRushPhase(phase)) {
    let seconds = secondsLeft;
    for (let step = 1; step <= DAY.phases.length; step++) {
      const next = DAY.phases[(index + step) % DAY.phases.length];
      if (isRushPhase(next.id)) {
        nextRush = next.id as 'lunch' | 'dinner';
        break;
      }
      seconds += (next.end - phaseStart((index + step) % DAY.phases.length)) * length;
    }
    secondsToRush = seconds;
  } else {
    nextRush = phase as 'lunch' | 'dinner';
  }
  return { phase, fraction, secondsLeft, nextRush, secondsToRush };
}

// Moves the day on. Only called while the game is open.
export function advanceDay(state: EconomyState, seconds: number): void {
  const length = dayLength();
  state.dayTime = (((state.dayTime + seconds) % length) + length) % length;
}

// Jumps to the middle of a phase (dev shortcut /?day=lunch).
export function setDayPhase(state: EconomyState, id: DayPhaseId): void {
  const index = DAY.phases.findIndex((phase) => phase.id === id);
  if (index < 0) return;
  // A little after the start, past the ramp, so the full factor applies.
  state.dayTime = (phaseStart(index) + DAY.rampFraction * 1.5) * dayLength();
}

// What the time of day adds to (or takes from) the income per second right now: the income at the
// day's arrival rate minus the plain income, with the timed boosts on top like everywhere else.
export function dayBonusPerSecond(state: EconomyState, factor = dayArrivalMultiplier(state)): number {
  if (factor === 1) return 0;
  const plain = incomeBreakdown(state);
  const now = incomeBreakdown(state, factor);
  return (now.dineIn + now.delivery - plain.dineIn - plain.delivery) * boostMultiplier(state);
}

// The day as (share of the day, arrival factor) pieces: each phase's steady part, and the middle of
// the ramp into it.
function factorPieces(): { weight: number; factor: number }[] {
  const pieces: { weight: number; factor: number }[] = [];
  DAY.phases.forEach((phase, index) => {
    const length = phase.end - phaseStart(index);
    const ramp = Math.min(DAY.rampFraction, length);
    const target = phaseFactor(phase.id);
    const previous = phaseFactor(DAY.phases[(index + DAY.phases.length - 1) % DAY.phases.length].id);
    pieces.push({ weight: ramp, factor: (previous + target) / 2 }, { weight: length - ramp, factor: target });
  });
  return pieces;
}

// The day's average effect on income per second (without timed boosts): what a player who keeps
// the game open gets on average. The balance simulation adds it to the steady income.
export function dayAverageBonusPerSecond(state: EconomyState): number {
  const plain = incomeBreakdown(state);
  const base = plain.dineIn + plain.delivery;
  let sum = 0;
  for (const { weight, factor } of factorPieces()) {
    if (factor === 1) continue;
    const now = incomeBreakdown(state, factor);
    sum += weight * (now.dineIn + now.delivery - base);
  }
  return sum;
}
