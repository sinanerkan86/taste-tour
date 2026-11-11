import {
  baseIncomePerSecond,
  chefOfCity,
  type ChefId,
  dailyRewardReady,
  dayNumber,
  offlineCapSeconds,
  type EconomyState,
  type ResearchId,
} from './economy';

// Reminders scheduled on the phone when the game goes to the background (and cancelled when it
// comes back). This module only decides what to send and when; src/game/notifications.ts talks
// to the system. Few and useful on purpose: a game that nags gets its notifications turned off.

export type NotificationKind = 'lab' | 'offlineFull' | 'rushOver' | 'daily' | 'missYou';

export interface PlannedNotification {
  kind: NotificationKind;
  // Local time in ms since the epoch.
  at: number;
  // The research that finishes (kind 'lab' only).
  research?: ResearchId;
  // The city's chef, when recruited, who signs the "we miss you" reminder.
  chef?: ChefId;
}

export const NOTIFY = {
  // Nothing is sent in the first minutes after leaving: the player just saw the game.
  minDelaySeconds: 5 * 60,
  // Quiet hours (local time): a reminder due at night waits until the morning.
  quietStartHour: 22,
  quietEndHour: 9,
  // Reminders closer together than this are merged (the earlier one is kept).
  minGapSeconds: 60 * 60,
  // At most this many reminders per absence, plus the daily reward one.
  maxCount: 2,
  // Local hour of the "daily reward is waiting" reminder.
  dailyHour: 11,
  // "Your restaurant misses you": once, this many days after leaving, at this local hour
  // (dinner time, when people pick up their phone).
  missYouDays: 2,
  missYouHour: 18,
};

const SECOND = 1000;

// Moves a time out of the quiet hours to the next morning.
export function outsideQuietHours(at: number): number {
  const date = new Date(at);
  const hour = date.getHours();
  if (hour >= NOTIFY.quietStartHour) {
    date.setDate(date.getDate() + 1);
  } else if (hour >= NOTIFY.quietEndHour) {
    return at;
  }
  date.setHours(NOTIFY.quietEndHour, 0, 0, 0);
  return date.getTime();
}

// The next morning reminder of a daily reward the player has not collected yet: today if today's is
// still waiting and the hour is ahead, else tomorrow.
export function nextDailyReminder(state: EconomyState, now: number): number {
  const at = new Date(now);
  at.setHours(NOTIFY.dailyHour, 0, 0, 0);
  if (!dailyRewardReady(state.daily, dayNumber(now)) || at.getTime() <= now) at.setDate(at.getDate() + 1);
  return at.getTime();
}

// The "we miss you" reminder for an absence starting now.
export function missYouReminder(now: number): number {
  const at = new Date(now);
  at.setDate(at.getDate() + NOTIFY.missYouDays);
  at.setHours(NOTIFY.missYouHour, 0, 0, 0);
  return at.getTime();
}

// What to remind the player of if they leave the game now.
export function planNotifications(state: EconomyState, now: number): PlannedNotification[] {
  const candidates: PlannedNotification[] = [];

  // The first research project that finishes while the player is away.
  const running = state.lab.slots.filter((slot) => slot.remaining > 0);
  if (running.length > 0) {
    const next = running.reduce((a, b) => (b.remaining < a.remaining ? b : a));
    candidates.push({ kind: 'lab', at: now + next.remaining * SECOND, research: next.research });
  }

  // Offline earnings stop growing once the cap is reached.
  if (baseIncomePerSecond(state) > 0) {
    candidates.push({ kind: 'offlineFull', at: now + offlineCapSeconds(state) * SECOND });
  }

  if (state.rushSeconds > 0) {
    candidates.push({ kind: 'rushOver', at: now + state.rushSeconds * SECOND });
  }

  const planned: PlannedNotification[] = [];
  candidates
    .filter((n) => n.at >= now + NOTIFY.minDelaySeconds * SECOND)
    .map((n) => ({ ...n, at: outsideQuietHours(n.at) }))
    .sort((a, b) => a.at - b.at)
    .forEach((n) => {
      if (planned.length >= NOTIFY.maxCount) return;
      const last = planned[planned.length - 1];
      if (last && n.at - last.at < NOTIFY.minGapSeconds * SECOND) return;
      planned.push(n);
    });
  // The daily reward reminder comes on top, unless another one is due around the same time.
  const daily = nextDailyReminder(state, now);
  if (planned.every((n) => Math.abs(n.at - daily) >= NOTIFY.minGapSeconds * SECOND)) {
    planned.push({ kind: 'daily', at: daily });
  }
  // A player who stayed away for days gets one last, friendly nudge (it is cancelled as soon as
  // they open the game, so active players never see it).
  const miss: PlannedNotification = { kind: 'missYou', at: missYouReminder(now) };
  const chef = chefOfCity(state.city);
  if (state.chefs.levels[chef] > 0) miss.chef = chef;
  if (planned.every((n) => Math.abs(n.at - miss.at) >= NOTIFY.minGapSeconds * SECOND)) planned.push(miss);
  return planned;
}
