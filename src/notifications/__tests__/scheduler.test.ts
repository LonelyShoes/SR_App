import { beforeEach, describe, expect, jest, test } from '@jest/globals';
// jest.mock calls below are hoisted above this import
import { reconcileMeetingReminders, getEffectiveOffset } from '../scheduler';

// ---- Fakes: mockScheduled notifications, meetings table, mockSettings ----
type Scheduled = {
  identifier: string;
  content: { title?: string; body?: string; data: Record<string, unknown> };
  date: number;
};
let mockScheduled: Scheduled[] = [];
let mockNextId = 0;
let mockMeetingRows: Record<string, unknown>[] = [];
let mockSettings: Record<string, string> = {};

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  scheduleNotificationAsync: jest.fn(
    async ({ content, trigger }: { content: Scheduled['content']; trigger: { date: Date } }) => {
      // Yield like the native call does, so concurrent reconciles can interleave
      await Promise.resolve();
      const identifier = `n${++mockNextId}`;
      mockScheduled.push({ identifier, content, date: trigger.date.getTime() });
      return identifier;
    },
  ),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    await Promise.resolve();
    mockScheduled = mockScheduled.filter((n) => n.identifier !== id);
  }),
  getAllScheduledNotificationsAsync: jest.fn(async () => {
    await Promise.resolve();
    return mockScheduled.map((n) => ({ identifier: n.identifier, content: n.content }));
  }),
}));

jest.mock('../../db/client', () => ({
  db: {
    // The scheduler's query already filters upcoming, active, non-deleted meetings
    select: () => ({
      from: () => ({
        where: async () => {
          const now = Date.now();
          return mockMeetingRows.filter(
            (m) =>
              m.deleted_at == null &&
              (m.start_at as number) > now &&
              ['rencana', 'terkonfirmasi'].includes(m.status as string),
          );
        },
      }),
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  },
}));

jest.mock('../../features/settings/repository', () => ({
  getSetting: async (key: string) => mockSettings[key] ?? null,
}));

const MIN = 60 * 1000;
const meeting = (id: string, startInMin: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Rapat ${id}`,
  start_at: Date.now() + startInMin * MIN,
  location: null,
  status: 'rencana',
  reminder_offset_min: null,
  reminder_notification_id: null,
  deleted_at: null,
  ...extra,
});

const reminders = () => mockScheduled.filter((n) => n.content.data.type === 'meeting-reminder');

beforeEach(() => {
  mockScheduled = [];
  mockNextId = 0;
  mockMeetingRows = [];
  mockSettings = {};
});

describe('reconcileMeetingReminders', () => {
  test('menjadwalkan H-30 secara default', async () => {
    mockMeetingRows = [meeting('a', 120)];
    await reconcileMeetingReminders();
    expect(reminders()).toHaveLength(1);
    expect(reminders()[0].date).toBe((mockMeetingRows[0].start_at as number) - 30 * MIN);
  });

  test('offset global dari Pengaturan dan offset per rapat', async () => {
    mockSettings.default_reminder_offset_min = '15';
    mockMeetingRows = [meeting('global', 120), meeting('custom', 120, { reminder_offset_min: 60 })];
    await reconcileMeetingReminders();
    const byId = Object.fromEntries(reminders().map((n) => [n.content.data.meetingId, n.date]));
    expect(byId.global).toBe((mockMeetingRows[0].start_at as number) - 15 * MIN);
    expect(byId.custom).toBe((mockMeetingRows[1].start_at as number) - 60 * MIN);
  });

  test('tidak ada pengingat jika sisa waktu kurang dari offset (tidak bunyi seketika)', async () => {
    mockMeetingRows = [meeting('soon', 20)];
    await reconcileMeetingReminders();
    expect(reminders()).toHaveLength(0);
  });

  test('rapat batal, selesai, atau terhapus tidak diingatkan', async () => {
    mockMeetingRows = [
      meeting('batal', 120, { status: 'batal' }),
      meeting('selesai', 120, { status: 'selesai' }),
      meeting('hapus', 120, { deleted_at: 1 }),
    ];
    await reconcileMeetingReminders();
    expect(reminders()).toHaveLength(0);
  });

  test('edit jam rapat menggeser pengingat; alarm timer tidak tersentuh', async () => {
    mockScheduled.push({ identifier: 'timer', content: { data: { type: 'timer-alarm' } }, date: 0 });
    mockMeetingRows = [meeting('a', 120)];
    await reconcileMeetingReminders();

    mockMeetingRows[0].start_at = Date.now() + 240 * MIN;
    await reconcileMeetingReminders();

    expect(reminders()).toHaveLength(1);
    expect(reminders()[0].date).toBe((mockMeetingRows[0].start_at as number) - 30 * MIN);
    expect(mockScheduled.some((n) => n.identifier === 'timer')).toBe(true);
  });

  test('panggilan bersamaan tidak menghasilkan notifikasi ganda', async () => {
    mockMeetingRows = [meeting('a', 120), meeting('b', 180)];
    await Promise.all([reconcileMeetingReminders(), reconcileMeetingReminders(), reconcileMeetingReminders()]);
    // Let the coalesced follow-up run finish (without starting a new one, which would hide duplicates)
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reminders()).toHaveLength(2);
  });

  test('isi notifikasi memuat jam dan lokasi, ketuk membuka rapatnya', async () => {
    mockMeetingRows = [meeting('a', 120, { location: 'Ruang 2' })];
    await reconcileMeetingReminders();
    const n = reminders()[0];
    expect(n.content.title).toBe('Pengingat: Rapat a');
    expect(n.content.body).toMatch(/^Mulai pukul \d{2}:\d{2} \(30 menit lagi\) · Ruang 2$/);
    expect(n.content.data.url).toBe('/matrix?rapat=a');
  });
});

describe('getEffectiveOffset', () => {
  test('offset per rapat menang atas default', () => {
    expect(getEffectiveOffset(null, 15)).toBe(15);
    expect(getEffectiveOffset(60, 15)).toBe(60);
  });
});
