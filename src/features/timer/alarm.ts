import * as Notifications from 'expo-notifications';
import { SrAlarm } from '../../../modules/sr-alarm';
import type { TimerKind } from './store';

const TITLES: Record<TimerKind, string> = {
  fokus: 'Waktu fokus selesai!',
  rehat: 'Rehat selesai!',
  santai: 'Santai selesai!',
};

const NATIVE_ID = 'native';

/**
 * Schedule the end-of-session alarm. On Android the native module rings like a
 * real alarm (looping alarm tone + full-screen screen over the lock screen);
 * elsewhere it falls back to a high-priority notification.
 * Returns an id for {@link cancelTimerAlarm}.
 */
export async function scheduleTimerAlarm(kind: TimerKind, endAt: number, durationSec: number): Promise<string | null> {
  const title = TITLES[kind];
  const body = `Sesi ${kind} ${Math.round(durationSec / 60)} menit telah berakhir.`;

  if (SrAlarm) {
    try {
      SrAlarm.schedule(endAt, title, body);
      return NATIVE_ID;
    } catch (e) {
      console.warn('Native alarm failed, falling back to notification:', e);
    }
  }

  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { type: 'timer-alarm', url: '/timer' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endAt),
        channelId: 'timer-alarm',
      },
    });
  } catch (e) {
    console.warn('Failed to schedule timer alarm:', e);
    return null;
  }
}

/** Cancel an alarm that has not fired yet. */
export async function cancelTimerAlarm(id: string | null): Promise<void> {
  if (!id) return;
  try {
    if (id === NATIVE_ID) SrAlarm?.cancelScheduled();
    else await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or cancelled
  }
}

/** Stop an alarm that is ringing now. */
export function dismissTimerAlarm(): void {
  SrAlarm?.dismiss();
}

export function isTimerAlarmRinging(): boolean {
  return SrAlarm?.isRinging() ?? false;
}
