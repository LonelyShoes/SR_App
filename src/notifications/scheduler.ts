import * as Notifications from 'expo-notifications';
import { db } from '../db/client';
import { meetings } from '../db/schema';
import { eq, and, isNull, gt, inArray } from 'drizzle-orm';

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
      body: `Rapat dimulai dalam ${offsetMinutes} menit${location ? ` di ${location}` : ''}`,
      data: { type: 'meeting-reminder', meetingId, url: `/matrix` },
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
  globalDefaultMin: number = 30,
): number {
  return meetingOffsetMin ?? globalDefaultMin;
}

/**
 * Reconcile all meeting reminders.
 * Called on app startup, after sync, after reboot, etc.
 * - Cancel all existing scheduled meeting reminders
 * - Re-schedule reminders for all upcoming active meetings
 */
export async function reconcileMeetingReminders(globalDefaultMin: number = 30): Promise<void> {
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

    // Update the meeting's reminder_notification_id
    if (notifId) {
      await db
        .update(meetings)
        .set({ reminder_notification_id: notifId })
        .where(eq(meetings.id, meeting.id));
    }
  }
}
