import {
  baseIncomePerSecond,
  offlineCapSeconds,
  type EconomyState,
  type ResearchId,
} from './economy';

// Reminders scheduled on the phone when the game goes to the background (and cancelled when it
// comes back). This module only decides what to send and when; src/game/notifications.ts talks
// to the system. Few and useful on purpose: a game that nags gets its notifications turned off.

export type NotificationKind = 'lab' | 'offlineFull' | 'rushOver';

export interface PlannedNotification {
  kind: NotificationKind;
  // Local time in ms since the epoch.
  at: number;
  // The research that finishes (kind 'lab' only).
  research?: ResearchId;
}

export const NOTIFY = {
  // Nothing is sent in the first minutes after leaving: the player just saw the game.
  minDelaySeconds: 5 * 60,
  // Quiet hours (local time): a reminder due at night waits until the morning.
  quietStartHour: 22,
  quietEndHour: 9,
  // Reminders closer together than this are merged (the earlier one is kept).
  minGapSeconds: 60 * 60,
  // At most this many reminders per absence.
  maxCount: 2,
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
  return planned;
}
