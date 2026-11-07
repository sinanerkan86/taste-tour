import { describe, expect, it } from 'vitest';
import { OFFLINE, claimDailyReward, dayNumber, newEconomy, startResearch } from './economy';
import { NOTIFY, nextDailyReminder, outsideQuietHours, planNotifications } from './notifications';

// The daily reward reminder is checked on its own; the other tests leave it out.
const others = (plan: ReturnType<typeof planNotifications>) => plan.filter((n) => n.kind !== 'daily');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
// Local times, so the quiet hours apply the same in every time zone.
const at = (hour: number, minute = 0, day = 7) => new Date(2026, 10, day, hour, minute).getTime();

describe('outsideQuietHours', () => {
  it('keeps daytime and moves night times to the next morning', () => {
    expect(outsideQuietHours(at(14, 30))).toBe(at(14, 30));
    expect(outsideQuietHours(at(23, 15))).toBe(at(NOTIFY.quietEndHour, 0, 8));
    expect(outsideQuietHours(at(3))).toBe(at(NOTIFY.quietEndHour));
    expect(outsideQuietHours(at(NOTIFY.quietStartHour))).toBe(at(NOTIFY.quietEndHour, 0, 8));
  });
});

describe('planNotifications', () => {
  it('reminds of the full till when nothing else runs', () => {
    const plan = others(planNotifications(newEconomy(), at(10)));
    expect(plan).toEqual([{ kind: 'offlineFull', at: at(10) + OFFLINE.baseCapSeconds * 1000 }]);
  });

  it('announces the first research to finish, then the full till', () => {
    const state = newEconomy();
    startResearch(state, 'nightShift');
    state.lab.slots[0].remaining = 30 * 60;
    const plan = others(planNotifications(state, at(10)));
    expect(plan.map((n) => n.kind)).toEqual(['lab', 'offlineFull']);
    expect(plan[0]).toMatchObject({ research: 'nightShift', at: at(10, 30) });
  });

  it('skips reminders due right away', () => {
    const state = newEconomy();
    startResearch(state, 'spices');
    state.lab.slots[0].remaining = 60;
    expect(others(planNotifications(state, at(10))).map((n) => n.kind)).toEqual(['offlineFull']);
  });

  it('merges reminders that come close together and sends at most two', () => {
    const state = newEconomy();
    startResearch(state, 'spices');
    state.lab.slots[0].remaining = 2 * 60 * 60 - 10 * 60;
    state.rushSeconds = 5 * 60 * 60;
    const plan = others(planNotifications(state, at(10)));
    // Lab at 11:50, till full at 12:00 (merged into the lab one), Rush over at 15:00.
    expect(plan.map((n) => n.kind)).toEqual(['lab', 'rushOver']);
    expect(plan.length).toBeLessThanOrEqual(NOTIFY.maxCount);
  });

  it('waits for the morning at night', () => {
    const plan = others(planNotifications(newEconomy(), at(21, 30)));
    expect(plan[0].at).toBe(at(NOTIFY.quietEndHour, 0, 8));
    expect(plan[0].at - at(21, 30)).toBeGreaterThan(OFFLINE.baseCapSeconds * 1000 + HOUR);
  });
});

describe('daily reward reminder', () => {
  it('comes the same morning while the reward waits, else the next morning', () => {
    const state = newEconomy();
    expect(nextDailyReminder(state, at(8))).toBe(at(NOTIFY.dailyHour));
    expect(nextDailyReminder(state, at(15))).toBe(at(NOTIFY.dailyHour, 0, 8));
    claimDailyReward(state, dayNumber(at(8)));
    expect(nextDailyReminder(state, at(8))).toBe(at(NOTIFY.dailyHour, 0, 8));
  });

  it('is added on top of the others unless one is due close to it', () => {
    const state = newEconomy();
    claimDailyReward(state, dayNumber(at(15)));
    expect(planNotifications(state, at(15)).map((n) => n.kind)).toEqual(['offlineFull', 'daily']);
    // Leaving at 9:30 with today's reward waiting: the till is full at 11:30, half an hour after
    // the daily reminder would come, so that one is left out.
    expect(planNotifications(newEconomy(), at(9, 30)).map((n) => n.kind)).toEqual(['offlineFull']);
  });
});
