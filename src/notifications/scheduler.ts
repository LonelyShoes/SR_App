import * as Notifications from 'expo-notifications';
import { db } from '../db/client';
import { meetings } from '../db/schema';
import { eq, and, isNull, gt, inArray } from 'drizzle-orm';
import { format } from 'date-fns';
import { getSetting } from '../features/settings/repository';

/** Spec 6.6: H-30 unless changed in Pengaturan (10/15/30/60) or per meeting. */
export const DEFAULT_REMINDER_OFFSET_MIN = 30;
export const REMINDER_OFFSET_CHOICES = [10, 15, 30, 60] as const;

export const getDefaultReminderOffset = async () =>
  Number(await getSetting('default_reminder_offset_min')) || DEFAULT_REMINDER_OFFSET_MIN;

/**
 * Schedule a reminder notification for a meeting.
 * Reminder fires at (start_at - offsetMinutes).
 * If the time has already passed, no notification is scheduled.
 */
export async function scheduleMeetingReminder(
  meetingId: string,
  title: string,
  startAt: number,
  location: string | null,
  offsetMinutes: number,
): Promise<string | null> {
  const reminderTime = startAt - offsetMinutes * 60 * 1000;

  // Don't schedule if reminder time has already passed
  if (reminderTime <= Date.now()) {
    return null;
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Pengingat: ${title}`,
      // Spec: title, time, location. Tapping opens the meeting in Matrix.
      body: `Mulai pukul ${format(startAt, 'HH:mm')} (${offsetMinutes} menit lagi)${location ? ` · ${location}` : ''}`,
      data: { type: 'meeting-reminder', meetingId, url: `/matrix?rapat=${meetingId}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(reminderTime),
      channelId: 'meeting-reminder',
    },
  });

  return notificationId;
}

/**
 * Cancel a previously scheduled meeting reminder.
 */
export async function cancelMeetingReminder(notificationId: string | null): Promise<void> {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
}

/**
 * Get the effective reminder offset for a meeting.
 * Returns per-meeting offset if set, otherwise the global default.
 */
export function getEffectiveOffset(
  meetingOffsetMin: number | null,
  globalDefaultMin: number = DEFAULT_REMINDER_OFFSET_MIN,
): number {
  return meetingOffsetMin ?? globalDefaultMin;
}

let reconciling: Promise<void> | null = null;
let reconcileAgain = false;

/**
 * Reconcile all meeting reminders (cancel-all, then reschedule from the DB).
 * Calls never overlap: two interleaved runs could both cancel and then both
 * schedule, producing duplicate notifications. Calls made while a run is in
 * progress are coalesced into one more run afterwards.
 */
export function reconcileMeetingReminders(): Promise<void> {
  if (reconciling) {
    reconcileAgain = true;
    return reconciling;
  }
  reconciling = reconcileOnce().finally(() => {
    reconciling = null;
    if (reconcileAgain) {
      reconcileAgain = false;
      reconcileMeetingReminders();
    }
  });
  return reconciling;
}

async function reconcileOnce(): Promise<void> {
  const globalDefaultMin = await getDefaultReminderOffset();

  // 1. Cancel all currently scheduled notifications for meeting reminders
  const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of allScheduled) {
    if (notif.content.data?.type === 'meeting-reminder') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  // 2. Get all active upcoming meetings
  const now = Date.now();
  const upcomingMeetings = await db
    .select()
    .from(meetings)
    .where(
      and(
        isNull(meetings.deleted_at),
        gt(meetings.start_at, now),
        inArray(meetings.status, ['rencana', 'terkonfirmasi']),
      ),
    );

  // 3. Re-schedule reminders for each meeting
  for (const meeting of upcomingMeetings) {
    const offset = getEffectiveOffset(meeting.reminder_offset_min, globalDefaultMin);
    const notifId = await scheduleMeetingReminder(
      meeting.id,
      meeting.title,
      meeting.start_at,
      meeting.location,
      offset,
    );

    // Local-only column (not synced, does not mark the row dirty); null when no reminder is due
    if (notifId !== meeting.reminder_notification_id) {
      await db.update(meetings).set({ reminder_notification_id: notifId }).where(eq(meetings.id, meeting.id));
    }
  }
}
