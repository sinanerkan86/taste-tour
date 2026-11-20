import { CLEAN, DAY, type DayPhaseId } from './config';
import { boostMultiplier, incomeBreakdown, specialties, type EconomyState } from './state';

// The restaurant's day (GDD 6g). While the game is open the restaurant lives through a short day:
// morning, a lunch rush, afternoon, a dinner rush and the closed hours (09:00-22:00 open, GDD 6h).
// A rush brings more customers to the entrance, closing none. After closing the staff cleans; if it
// is not done at 09:00 the restaurant opens late. Offline earnings do not see the day: it only runs
// while the game is open, like the buses.

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
  return isRushPhase(id) ? DAY.rushArrivals : id === 'closed' ? 0 : 1;
}

// The entrance's arrival multiplier at a fraction of the day, by the clock alone. A phase's factor
// is reached over DAY.rampFraction from the previous phase's factor, so the rate changes smoothly;
// closing is sharp (nobody new comes in once the sign says closed).
export function arrivalFactorAt(fraction: number): number {
  const index = phaseIndexAt(fraction);
  const target = phaseFactor(DAY.phases[index].id);
  if (DAY.phases[index].id === 'closed') return 0;
  const previous = phaseFactor(DAY.phases[(index + DAY.phases.length - 1) % DAY.phases.length].id);
  const into = fraction - phaseStart(index);
  if (into >= DAY.rampFraction) return target;
  return previous + (target - previous) * (into / DAY.rampFraction);
}

export function dayPhase(state: EconomyState): DayPhaseId {
  return phaseAt(dayFraction(state.dayTime));
}

// The virtual clock as minutes since midnight: the open hours (09:00-22:00) take the first
// DAY.openShare of the day, the closed hours (22:00-09:00) the rest.
export function clockMinutes(fraction: number): number {
  const open = DAY.openHour * 60;
  const close = DAY.closeHour * 60;
  if (fraction < DAY.openShare) return open + (fraction / DAY.openShare) * (close - open);
  const closedSpan = 24 * 60 - close + open;
  return (close + ((fraction - DAY.openShare) / (1 - DAY.openShare)) * closedSpan) % (24 * 60);
}

// "HH:MM" for a fraction of the day.
export function clockText(fraction: number): string {
  const total = Math.floor(clockMinutes(fraction)) % (24 * 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Whether the doors are open: not in the closed hours, and the night's cleaning is done (otherwise
// the restaurant opens late, as soon as it is).
export function isOpen(state: EconomyState): boolean {
  return dayPhase(state) !== 'closed' && state.cleanProgress >= 1;
}

// The multiplier on the entrance's arrivals right now (0 while closed).
export function dayArrivalMultiplier(state: EconomyState): number {
  return isOpen(state) ? arrivalFactorAt(dayFraction(state.dayTime)) : 0;
}

// How much faster than the base the staff cleans: the dish pit's spare capacity (its Spotless
// bonus as a share of the cap) adds up to CLEAN.maxSpeedup.
export function cleanSpeed(state: EconomyState): number {
  const spotless = specialties(state).dishwashing;
  return 1 + (spotless.cap > 0 ? spotless.bonus / spotless.cap : 0) * CLEAN.maxSpeedup;
}

// Seconds of cleaning a whole night's work takes now.
export function cleanSeconds(state: EconomyState): number {
  return CLEAN.baseSeconds / cleanSpeed(state);
}

// Cleans for `seconds` (call it while the staff is working: the room is empty). Does nothing while open.
export function advanceCleaning(state: EconomyState, seconds: number): void {
  if (isOpen(state) || state.cleanProgress >= 1) return;
  state.cleanProgress = Math.min(1, state.cleanProgress + seconds / cleanSeconds(state));
}

// The night crew ad (once per day): it finishes the cleaning and opens the doors at once.
export function canCallNightCrew(state: EconomyState): boolean {
  return !isOpen(state) && state.nightCrewUsed !== state.dayIndex;
}

export function callNightCrew(state: EconomyState): void {
  if (!canCallNightCrew(state)) return;
  state.nightCrewUsed = state.dayIndex;
  state.cleanProgress = 1;
  // In the closed hours the clock jumps on to the opening time.
  if (dayPhase(state) === 'closed') state.dayTime = 0;
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

// Moves the day on. Only called while the game is open. Passing the closing time counts a day and
// leaves the restaurant dirty.
export function advanceDay(state: EconomyState, seconds: number): void {
  const length = dayLength();
  const closing = DAY.phases[DAY.phases.length - 2].end * length;
  const crossings = Math.floor((state.dayTime + seconds - closing) / length) - Math.floor((state.dayTime - closing) / length);
  if (crossings > 0) {
    state.dayIndex += crossings;
    state.cleanProgress = 0;
  }
  state.dayTime = (((state.dayTime + seconds) % length) + length) % length;
}

// Jumps to the middle of a phase (dev shortcut /?day=lunch).
export function setDayPhase(state: EconomyState, id: DayPhaseId): void {
  const index = DAY.phases.findIndex((phase) => phase.id === id);
  if (index < 0) return;
  // A little after the start, past the ramp, so the full factor applies.
  state.dayTime = (phaseStart(index) + DAY.rampFraction * 1.5) * dayLength();
  state.cleanProgress = id === 'closed' ? 0 : 1;
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
    if (phase.id === 'closed') {
      pieces.push({ weight: length, factor: 0 });
      return;
    }
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
