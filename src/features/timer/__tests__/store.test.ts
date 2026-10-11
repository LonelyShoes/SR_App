import { beforeEach, describe, expect, jest, test } from '@jest/globals';
// jest.mock calls below are hoisted above this import
import { useTimerStore } from '../store';

// ---- Fakes: native alarm module, notifications fallback, timer_sessions table ----
let mockSessions: Record<string, unknown>[] = [];

// Built inside the factory: it runs while the store is imported, before this file's consts exist
jest.mock('../../../../modules/sr-alarm', () => ({
  SrAlarm: {
    schedule: jest.fn(),
    cancelScheduled: jest.fn(),
    dismiss: jest.fn(),
    isRinging: jest.fn(() => false),
  },
}));
type AlarmMock = Record<'schedule' | 'cancelScheduled' | 'dismiss' | 'isRinging', jest.Mock>;
const mockAlarm = jest.requireMock<{ SrAlarm: AlarmMock }>('../../../../modules/sr-alarm').SrAlarm;

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  scheduleNotificationAsync: jest.fn(async () => 'fallback-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${mockSessions.length + 1}` }));

jest.mock('../../../db/client', () => ({
  db: {
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        mockSessions.push(row);
      },
    }),
  },
}));

const initial = useTimerStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  mockSessions = [];
  useTimerStore.setState(initial, true);
});

describe('timer alarm', () => {
  test('start schedules the native alarm at the end of the session', async () => {
    const before = Date.now();
    await useTimerStore.getState().start('fokus', 25 * 60, 'default-fokus');

    expect(mockAlarm.schedule).toHaveBeenCalledTimes(1);
    const [endAt, title, body] = mockAlarm.schedule.mock.calls[0] as [number, string, string];
    expect(endAt).toBeGreaterThanOrEqual(before + 25 * 60 * 1000);
    expect(title).toBe('Waktu fokus selesai!');
    expect(body).toContain('25 menit');
    expect(useTimerStore.getState().status).toBe('running');
  });

  test('pause cancels the alarm and resume reschedules it', async () => {
    await useTimerStore.getState().start('rehat', 300);
    await useTimerStore.getState().pause();
    expect(mockAlarm.cancelScheduled).toHaveBeenCalledTimes(1);
    expect(useTimerStore.getState().status).toBe('paused');

    await useTimerStore.getState().resume();
    expect(mockAlarm.schedule).toHaveBeenCalledTimes(2);
    expect(useTimerStore.getState().status).toBe('running');
  });

  test('stopping early cancels the alarm and records an incomplete session', async () => {
    await useTimerStore.getState().start('fokus', 1500);
    await useTimerStore.getState().stop();

    expect(mockAlarm.cancelScheduled).toHaveBeenCalledTimes(1);
    expect(mockAlarm.dismiss).not.toHaveBeenCalled();
    expect(mockSessions).toHaveLength(1);
    expect(mockSessions[0]).toMatchObject({ kind: 'fokus', completed: 0, planned_sec: 1500 });
    expect(useTimerStore.getState()).toMatchObject({ status: 'idle', ringing: false });
  });

  test('finishing keeps the alarm ringing and records a completed session', async () => {
    await useTimerStore.getState().start('fokus', 1500, 'default-fokus');
    await useTimerStore.getState().complete();

    // The alarm already fired: nothing may cancel or silence it
    expect(mockAlarm.cancelScheduled).not.toHaveBeenCalled();
    expect(mockAlarm.dismiss).not.toHaveBeenCalled();
    expect(mockSessions).toHaveLength(1);
    expect(mockSessions[0]).toMatchObject({ completed: 1, preset_id: 'default-fokus' });
    expect(useTimerStore.getState()).toMatchObject({ status: 'idle', ringing: true, kind: 'fokus' });
  });

  test('complete runs once even if called twice', async () => {
    await useTimerStore.getState().start('santai', 600);
    await Promise.all([useTimerStore.getState().complete(), useTimerStore.getState().complete()]);
    expect(mockSessions).toHaveLength(1);
  });

  test('dismissAlarm silences the native alarm', async () => {
    await useTimerStore.getState().start('fokus', 60);
    await useTimerStore.getState().complete();
    useTimerStore.getState().dismissAlarm();

    expect(mockAlarm.dismiss).toHaveBeenCalledTimes(1);
    expect(useTimerStore.getState().ringing).toBe(false);
  });

  test('starting a new session silences a ringing alarm', async () => {
    await useTimerStore.getState().start('fokus', 60);
    await useTimerStore.getState().complete();
    await useTimerStore.getState().start('rehat', 300);

    expect(mockAlarm.dismiss).toHaveBeenCalledTimes(1);
    expect(useTimerStore.getState()).toMatchObject({ status: 'running', ringing: false, kind: 'rehat' });
  });
});
