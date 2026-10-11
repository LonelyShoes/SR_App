import { create } from 'zustand';
import { db } from '../../db/client';
import { timer_sessions } from '../../db/schema';
import * as Crypto from 'expo-crypto';
import { cancelTimerAlarm, dismissTimerAlarm, scheduleTimerAlarm } from './alarm';

export type TimerKind = 'fokus' | 'rehat' | 'santai';
export type TimerStatus = 'idle' | 'running' | 'paused';

interface TimerState {
  status: TimerStatus;
  kind: TimerKind;
  plannedSec: number;
  endAt: number | null; // epoch ms when timer finishes
  pausedRemaining: number; // remaining ms when paused
  startedAt: number | null; // epoch ms when session started
  presetId: string | null;
  alarmId: string | null;
  /** The last session ended on its own and its alarm is (or may be) ringing */
  ringing: boolean;

  // Actions
  start: (kind: TimerKind, durationSec: number, presetId?: string | null) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Stop early (manual); cancels the pending alarm */
  stop: () => Promise<void>;
  /** The countdown reached zero; the alarm keeps ringing until dismissed */
  complete: () => Promise<void>;
  /** Silence the alarm */
  dismissAlarm: () => void;
  tick: () => number; // returns remaining seconds
}

const recordSession = async (
  state: Pick<TimerState, 'startedAt' | 'kind' | 'plannedSec' | 'presetId'>,
  completed: boolean,
) => {
  if (!state.startedAt) return;
  const now = Date.now();
  try {
    await db.insert(timer_sessions).values({
      id: Crypto.randomUUID(),
      kind: state.kind,
      planned_sec: state.plannedSec,
      started_at: state.startedAt,
      ended_at: now,
      completed: completed ? 1 : 0,
      actual_sec: Math.round((now - state.startedAt) / 1000),
      preset_id: state.presetId,
      created_at: now,
      updated_at: now,
      dirty: 1,
    });
  } catch (e) {
    console.error('Failed to record timer session:', e);
  }
};

const IDLE = {
  status: 'idle' as const,
  endAt: null,
  pausedRemaining: 0,
  startedAt: null,
  alarmId: null,
};

export const useTimerStore = create<TimerState>((set, get) => ({
  status: 'idle',
  kind: 'fokus',
  plannedSec: 25 * 60,
  endAt: null,
  pausedRemaining: 0,
  startedAt: null,
  presetId: null,
  alarmId: null,
  ringing: false,

  start: async (kind, durationSec, presetId = null) => {
    // A new session silences the previous alarm
    if (get().ringing) get().dismissAlarm();
    const now = Date.now();
    const endAt = now + durationSec * 1000;
    const alarmId = await scheduleTimerAlarm(kind, endAt, durationSec);

    set({
      status: 'running',
      kind,
      plannedSec: durationSec,
      endAt,
      startedAt: now,
      pausedRemaining: 0,
      presetId,
      alarmId,
    });
  },

  pause: async () => {
    const { endAt, alarmId } = get();
    if (!endAt) return;
    await cancelTimerAlarm(alarmId);
    set({ status: 'paused', endAt: null, pausedRemaining: Math.max(0, endAt - Date.now()), alarmId: null });
  },

  resume: async () => {
    const { pausedRemaining, kind, plannedSec } = get();
    if (pausedRemaining <= 0) return;
    const endAt = Date.now() + pausedRemaining;
    const alarmId = await scheduleTimerAlarm(kind, endAt, plannedSec);
    set({ status: 'running', endAt, pausedRemaining: 0, alarmId });
  },

  stop: async () => {
    const state = get();
    await cancelTimerAlarm(state.alarmId);
    const finished = state.endAt !== null && state.endAt <= Date.now();
    await recordSession(state, finished);
    set(IDLE);
  },

  complete: async () => {
    const state = get();
    if (state.status !== 'running') return;
    set({ ...IDLE, ringing: true });
    await recordSession(state, true);
  },

  dismissAlarm: () => {
    dismissTimerAlarm();
    set({ ringing: false });
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
