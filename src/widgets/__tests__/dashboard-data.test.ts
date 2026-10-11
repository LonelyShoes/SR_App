import { describe, expect, jest, test } from '@jest/globals';
import { summarizeDashboard } from '../dashboard-data';
import type { Task } from '../../features/tasks/repository';
import type { Meeting } from '../../features/meetings/repository';

// jest.mock is hoisted above the imports. summarizeDashboard is pure; stub the repositories so the SQLite client is never opened
jest.mock('../../features/tasks/repository', () => ({ getTasksQuery: jest.fn() }));
jest.mock('../../features/meetings/repository', () => ({ getMeetingsQuery: jest.fn() }));

const NOW = new Date(2026, 9, 12, 10, 0).getTime();
const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0).getTime();

const meeting = (title: string, start: number, status = 'rencana') =>
  ({ id: title, title, start_at: start, end_at: start + 3600000, status }) as Meeting;

const task = (quadrant: string, status = 'todo', due_at: number | null = null) =>
  ({ id: `${quadrant}-${status}-${due_at}`, quadrant, status, due_at }) as Task;

describe('summarizeDashboard', () => {
  test('menghitung agenda hari ini dan yang terkonfirmasi', () => {
    const s = summarizeDashboard(
      [],
      [meeting('A', at(12, 8), 'terkonfirmasi'), meeting('B', at(12, 14)), meeting('C', at(13, 9), 'terkonfirmasi')],
      NOW,
    );
    expect(s.agendaToday).toBe(2);
    expect(s.confirmedToday).toBe(1);
  });

  test('tugas mendesak = todo Q1 atau tenggat hari ini', () => {
    const s = summarizeDashboard(
      [task('Q1'), task('Q2', 'todo', at(12, 23)), task('Q2', 'todo', at(13, 23)), task('Q1', 'done')],
      [],
      NOW,
    );
    expect(s.urgentTasks).toBe(2);
  });

  test('agenda terdekat: maksimal 3, belum lewat, tidak batal/selesai', () => {
    const s = summarizeDashboard(
      [],
      [
        meeting('Lewat', at(12, 8)),
        meeting('Satu', at(12, 14)),
        meeting('Batal', at(12, 15), 'batal'),
        meeting('Dua', at(13, 9), 'terkonfirmasi'),
        meeting('Selesai', at(13, 10), 'selesai'),
        meeting('Tiga', at(14, 9)),
        meeting('Empat', at(15, 9)),
      ],
      NOW,
    );
    expect(s.upcoming.map((m) => m.title)).toEqual(['Satu', 'Dua', 'Tiga']);
  });
});
