/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, test } from '@jest/globals';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseSync } from 'node:sqlite';
import {
  focusDaysSql,
  focusPerDaySql,
  focusPerHourSql,
  kindDistributionSql,
  sessionSummarySql,
  tasksDonePerDaySql,
  StatsQuery,
} from '../sql';
import { bucket, completionRate, computeStreaks, fillDays, fillHours, formatDuration } from '../compute';

// Fixed WIB offset so results don't depend on the machine running the tests
const WIB = 7 * 3600;
// Local WIB wall-clock time → epoch ms
const wib = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour, minute) - WIB * 1000;
const FROM = wib(6, 0);
const TO = wib(13, 0); // 7 local days: 6–12 Oct

const MIGRATIONS_DIR = join(__dirname, '../../../db/migrations');

let db: DatabaseSync;

const run = <T>(q: StatsQuery) => db.prepare(q.sql).all(...q.params) as T[];

let seq = 0;
const session = (kind: string, start: number, actualMin: number, completed = 1, deleted = false) => {
  seq++;
  db.prepare(
    `INSERT INTO timer_sessions (id, kind, planned_sec, started_at, ended_at, completed, actual_sec, created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  ).run(
    `s${seq}`,
    kind,
    actualMin * 60,
    start,
    start + actualMin * 60000,
    completed,
    actualMin * 60,
    start,
    start,
    deleted ? start : null,
  );
};

const doneTask = (completedAt: number, deleted = false) => {
  seq++;
  db.prepare(
    `INSERT INTO tasks (id, title, quadrant, status, completed_at, source, created_at, updated_at, deleted_at, dirty)
     VALUES (?, 'T', 'Q1', 'done', ?, 'manual', ?, ?, ?, 1)`,
  ).run(`t${seq}`, completedAt, completedAt, completedAt, deleted ? completedAt : null);
};

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  // Apply the real Drizzle migrations
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    for (const statement of readFileSync(join(MIGRATIONS_DIR, file), 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) db.exec(statement);
    }
  }
});

describe('query SQL statistik', () => {
  test('fokus per hari memakai hari lokal WIB, bukan UTC', () => {
    session('fokus', wib(10, 6, 30), 25); // 06.30 WIB = 23.30 UTC hari sebelumnya
    session('fokus', wib(10, 20), 25);
    session('fokus', wib(11, 9), 50);
    session('rehat', wib(11, 10), 5); // bukan fokus
    session('fokus', wib(11, 11), 25, 1, true); // terhapus
    session('fokus', wib(5, 9), 25); // di luar rentang

    expect(run(focusPerDaySql(FROM, TO, WIB))).toEqual([
      { day: '2026-10-10', value: 50 * 60 },
      { day: '2026-10-11', value: 50 * 60 },
    ]);
  });

  test('ringkasan sesi: selesai vs dibatalkan dan rata-rata fokus', () => {
    session('fokus', wib(8, 9), 25);
    session('fokus', wib(8, 10), 15, 0);
    session('rehat', wib(8, 11), 5);
    const [summary] = run<Record<string, number>>(sessionSummarySql(FROM, TO));
    expect(summary).toEqual({ total: 3, completed: 2, focus_sec: 40 * 60, avg_focus_sec: 20 * 60 });
  });

  test('ringkasan kosong mengembalikan nol, bukan null', () => {
    const [summary] = run<Record<string, number>>(sessionSummarySql(FROM, TO));
    expect(summary).toEqual({ total: 0, completed: 0, focus_sec: 0, avg_focus_sec: 0 });
  });

  test('distribusi per jenis', () => {
    session('fokus', wib(8, 9), 25);
    session('fokus', wib(9, 9), 25);
    session('santai', wib(9, 12), 15);
    const rows = run<{ kind: string; total_sec: number; sessions: number }>(kindDistributionSql(FROM, TO));
    expect(rows.sort((a, b) => a.kind.localeCompare(b.kind))).toEqual([
      { kind: 'fokus', total_sec: 50 * 60, sessions: 2 },
      { kind: 'santai', total_sec: 15 * 60, sessions: 1 },
    ]);
  });

  test('fokus per jam lokal', () => {
    session('fokus', wib(8, 9, 10), 25);
    session('fokus', wib(9, 9, 40), 25);
    session('fokus', wib(9, 23, 30), 10);
    expect(run(focusPerHourSql(FROM, TO, WIB))).toEqual([
      { hour: 9, value: 50 * 60 },
      { hour: 23, value: 10 * 60 },
    ]);
  });

  test('tugas selesai per hari lokal', () => {
    doneTask(wib(7, 8));
    doneTask(wib(7, 22));
    doneTask(wib(12, 1));
    doneTask(wib(12, 2), true);
    expect(run(tasksDonePerDaySql(FROM, TO, WIB))).toEqual([
      { day: '2026-10-07', value: 2 },
      { day: '2026-10-12', value: 1 },
    ]);
  });

  test('hari aktif untuk streak: hanya fokus selesai, unik, terbaru dulu', () => {
    session('fokus', wib(10, 9), 25);
    session('fokus', wib(10, 15), 25);
    session('fokus', wib(11, 9), 10, 0); // dibatalkan
    session('fokus', wib(12, 9), 25);
    session('rehat', wib(11, 9), 5);
    expect(run<{ day: string }>(focusDaysSql(WIB)).map((r) => r.day)).toEqual(['2026-10-12', '2026-10-10']);
  });
});

describe('perhitungan statistik', () => {
  test('streak berjalan sampai hari ini', () => {
    expect(computeStreaks(['2026-10-12', '2026-10-11', '2026-10-10', '2026-10-07'], '2026-10-12')).toEqual({
      current: 3,
      longest: 3,
    });
  });

  test('streak tetap dihitung jika hari ini belum ada sesi', () => {
    expect(computeStreaks(['2026-10-11', '2026-10-10'], '2026-10-12').current).toBe(2);
  });

  test('streak putus jika kemarin kosong', () => {
    expect(computeStreaks(['2026-10-10', '2026-10-09', '2026-10-08', '2026-10-07'], '2026-10-12')).toEqual({
      current: 0,
      longest: 4,
    });
  });

  test('streak melewati pergantian bulan', () => {
    expect(computeStreaks(['2026-10-01', '2026-09-30', '2026-09-29'], '2026-10-01').current).toBe(3);
  });

  test('tanpa riwayat', () => {
    expect(computeStreaks([], '2026-10-12')).toEqual({ current: 0, longest: 0 });
  });

  test('tingkat penyelesaian', () => {
    expect(completionRate(0, 0)).toBe(0);
    expect(completionRate(3, 2)).toBe(67);
  });

  test('fillDays mengisi hari kosong dengan nol', () => {
    const series = fillDays([{ day: '2026-10-08', value: 5 }], FROM, 7, WIB);
    expect(series).toHaveLength(7);
    expect(series[0]).toEqual({ day: '2026-10-06', value: 0 });
    expect(series[2]).toEqual({ day: '2026-10-08', value: 5 });
    expect(series[6].day).toBe('2026-10-12');
  });

  test('bucket mingguan', () => {
    const series = fillDays(
      [
        { day: '2026-10-06', value: 1 },
        { day: '2026-10-13', value: 2 },
      ],
      FROM,
      14,
      WIB,
    );
    expect(bucket(series, 7)).toEqual([
      { day: '2026-10-06', value: 1 },
      { day: '2026-10-13', value: 2 },
    ]);
  });

  test('jam paling produktif', () => {
    const { hours, peakHour } = fillHours([
      { hour: 9, value: 300 },
      { hour: 14, value: 900 },
    ]);
    expect(hours).toHaveLength(24);
    expect(peakHour).toBe(14);
    expect(fillHours([]).peakHour).toBeNull();
  });

  test('format durasi', () => {
    expect(formatDuration(25 * 60)).toBe('25 mnt');
    expect(formatDuration(120 * 60)).toBe('2 j');
    expect(formatDuration(95 * 60)).toBe('1 j 35 mnt');
  });
});
