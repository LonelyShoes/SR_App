import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import { db } from '../../db/client';
import { timer_sessions } from '../../db/schema';
import * as Crypto from 'expo-crypto';

export type TimerKind = 'fokus' | 'rehat' | 'santai';
export type TimerStatus = 'idle' | 'running' | 'paused';

interface TimerState {
  status: TimerStatus;
  kind: TimerKind;
  plannedSec: number;
  endAt: number | null;       // epoch ms when timer finishes
  pausedRemaining: number;    // remaining ms when paused
  startedAt: number | null;   // epoch ms when session started
  presetId: string | null;
  alarmNotificationId: string | null;

  // Actions
  start: (kind: TimerKind, durationSec: number, presetId?: string | null) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  tick: () => number;         // returns remaining seconds
}

export const useTimerStore = create<TimerState>((set, get) => ({
  status: 'idle',
  kind: 'fokus',
  plannedSec: 25 * 60,
  endAt: null,
  pausedRemaining: 0,
  startedAt: null,
  presetId: null,
  alarmNotificationId: null,

  start: async (kind, durationSec, presetId = null) => {
    const now = Date.now();
    const endAt = now + durationSec * 1000;

    // Schedule alarm notification at endAt
    let notifId: string | null = null;
    try {
      notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: kind === 'fokus' ? '⏰ Waktu Fokus Selesai!' : kind === 'rehat' ? '☕ Rehat Selesai!' : '🌴 Santai Selesai!',
          body: `Sesi ${kind} ${Math.floor(durationSec / 60)} menit telah berakhir.`,
          data: { type: 'timer-alarm', url: '/timer' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(endAt),
          channelId: 'timer-alarm',
        },
      });
    } catch (e) {
      console.warn('Failed to schedule timer alarm:', e);
    }

    set({
      status: 'running',
      kind,
      plannedSec: durationSec,
      endAt,
      startedAt: now,
      pausedRemaining: 0,
      presetId,
      alarmNotificationId: notifId,
    });
  },

  pause: async () => {
    const { endAt, alarmNotificationId } = get();
    if (!endAt) return;

    const remaining = Math.max(0, endAt - Date.now());

    // Cancel scheduled alarm
    if (alarmNotificationId) {
      await Notifications.cancelScheduledNotificationAsync(alarmNotificationId);
    }

    set({
      status: 'paused',
      endAt: null,
      pausedRemaining: remaining,
      alarmNotificationId: null,
    });
  },

  resume: async () => {
    const { pausedRemaining, kind } = get();
    if (pausedRemaining <= 0) return;

    const now = Date.now();
    const endAt = now + pausedRemaining;

    // Re-schedule alarm notification
    let notifId: string | null = null;
    try {
      notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: kind === 'fokus' ? '⏰ Waktu Fokus Selesai!' : kind === 'rehat' ? '☕ Rehat Selesai!' : '🌴 Santai Selesai!',
          body: `Sesi ${kind} telah berakhir.`,
          data: { type: 'timer-alarm', url: '/timer' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(endAt),
          channelId: 'timer-alarm',
        },
      });
    } catch (e) {
      console.warn('Failed to schedule timer alarm:', e);
    }

    set({
      status: 'running',
      endAt,
      pausedRemaining: 0,
      alarmNotificationId: notifId,
    });
  },

  stop: async () => {
    const { startedAt, kind, plannedSec, endAt, alarmNotificationId, presetId, status } = get();

    // Cancel alarm notification if still pending
    if (alarmNotificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(alarmNotificationId);
      } catch {
        // Already fired or cancelled
      }
    }

    // Record session if timer was started
    if (startedAt) {
      const now = Date.now();
      const actualMs = now - startedAt;
      const actualSec = Math.round(actualMs / 1000);
      // completed = 1 if the timer ran out on its own (endAt <= now), 0 if manually stopped
      const completed = (endAt !== null && endAt <= now) || status === 'idle' ? 1 : 0;

      try {
        await db.insert(timer_sessions).values({
          id: Crypto.randomUUID(),
          kind,
          planned_sec: plannedSec,
          started_at: startedAt,
          ended_at: now,
          completed,
          actual_sec: actualSec,
          preset_id: presetId,
          created_at: now,
          updated_at: now,
          dirty: 1,
        });
      } catch (e) {
        console.error('Failed to record timer session:', e);
      }
    }

    set({
      status: 'idle',
      endAt: null,
      pausedRemaining: 0,
      startedAt: null,
      alarmNotificationId: null,
    });
  },

  tick: () => {
    const { status, endAt, pausedRemaining } = get();
    if (status === 'paused') {
      return Math.max(0, Math.ceil(pausedRemaining / 1000));
    }
    if (status === 'running' && endAt) {
      const remaining = Math.max(0, endAt - Date.now());
      return Math.ceil(remaining / 1000);
    }
    return get().plannedSec;
  },
}));
