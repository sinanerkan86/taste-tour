import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { EconomyState } from '../core/economy';
import { planNotifications, type NotificationKind, type PlannedNotification } from '../core/notifications';
import { t } from '../i18n';
import { researchName } from './ui/progressText';
import { saveSettings, settings } from './settings';

// Phone reminders: scheduled when the game goes to the background, cancelled when it comes back
// (the player is in the game then). What to send is decided in src/core/notifications.ts.

const CHANNEL_ID = 'restaurant';
// One fixed id per kind, so scheduling again replaces instead of piling up.
const IDS: Record<NotificationKind, number> = { lab: 1, offlineFull: 2, rushOver: 3 };
const ALL_IDS = Object.values(IDS).map((id) => ({ id }));

const native = Capacitor.isNativePlatform();
// Dev: /?notify=1 logs the plan in the browser console when the tab is hidden.
const logPlan = !native && new URLSearchParams(window.location.search).has('notify');

function text(n: PlannedNotification): { title: string; body: string } {
  if (n.kind === 'lab') {
    return { title: t('notify.lab.title'), body: t('notify.lab.body', { name: n.research ? researchName(n.research) : '' }) };
  }
  return { title: t(`notify.${n.kind}.title`), body: t(`notify.${n.kind}.body`) };
}

async function granted(): Promise<boolean> {
  return (await LocalNotifications.checkPermissions()).display === 'granted';
}

export const notifications = {
  // Schedules the reminders for an absence starting now.
  async schedule(state: EconomyState): Promise<void> {
    const plan = planNotifications(state, Date.now());
    if (logPlan) console.info('[notify]', JSON.stringify(plan.map((n) => ({ ...n, at: new Date(n.at).toString(), ...text(n) })), null, 1));
    if (!native || !settings.notifications) return;
    try {
      if (!(await granted())) return;
      // Created here rather than at start-up so its name follows the chosen language.
      await LocalNotifications.createChannel({ id: CHANNEL_ID, name: t('notify.channel'), importance: 3 });
      await LocalNotifications.cancel({ notifications: ALL_IDS });
      if (plan.length === 0) return;
      await LocalNotifications.schedule({
        notifications: plan.map((n) => ({
          id: IDS[n.kind],
          ...text(n),
          channelId: CHANNEL_ID,
          schedule: { at: new Date(n.at), allowWhileIdle: true },
        })),
      });
    } catch (error) {
      console.warn('Scheduling notifications failed', error);
    }
  },

  // The player is back: drop what is still pending and clear what was shown.
  async cancel(): Promise<void> {
    if (!native) return;
    try {
      await LocalNotifications.cancel({ notifications: ALL_IDS });
      await LocalNotifications.removeAllDeliveredNotifications();
    } catch (error) {
      console.warn('Cancelling notifications failed', error);
    }
  },

  // Asks for the permission (Android 13+ shows a system dialog). Returns whether reminders can be shown.
  async requestPermission(): Promise<boolean> {
    if (!native) return true;
    try {
      if (await granted()) return true;
      return (await LocalNotifications.requestPermissions()).display === 'granted';
    } catch {
      return false;
    }
  },

  // Asked once, at a moment where it makes sense (the first research project): the system
  // dialog can only be shown a couple of times before Android stops asking.
  async askOnce(): Promise<void> {
    if (settings.notificationsAsked || !settings.notifications) return;
    settings.notificationsAsked = true;
    settings.notifications = await this.requestPermission();
    saveSettings();
  },
};
