/**
 * Aggregated SQL for the Statistik screen. Kept as plain strings (no expo
 * imports) so the exact same queries run in unit tests against node:sqlite.
 *
 * Every query takes `[fromMs, toMs]` as positional params. Local day/hour
 * grouping shifts epoch seconds by the device UTC offset (`tzSec`), which is
 * inlined as an integer literal (it is computed, never user input).
 */

export type StatsQuery = { sql: string; params: number[] };

const localSec = (column: string, tzSec: number) => `(${column} / 1000 + ${Math.trunc(tzSec)})`;

const sessionsInRange = `deleted_at IS NULL AND started_at >= ? AND started_at < ?`;

export const focusPerDaySql = (from: number, to: number, tzSec: number): StatsQuery => ({
  sql: `SELECT date(${localSec('started_at', tzSec)}, 'unixepoch') AS day, SUM(actual_sec) AS value
        FROM timer_sessions
        WHERE ${sessionsInRange} AND kind = 'fokus'
        GROUP BY day ORDER BY day`,
  params: [from, to],
});

export const sessionSummarySql = (from: number, to: number): StatsQuery => ({
  sql: `SELECT COUNT(*) AS total,
               COALESCE(SUM(completed), 0) AS completed,
               COALESCE(SUM(CASE WHEN kind = 'fokus' THEN actual_sec END), 0) AS focus_sec,
               COALESCE(AVG(CASE WHEN kind = 'fokus' THEN actual_sec END), 0) AS avg_focus_sec
        FROM timer_sessions
        WHERE ${sessionsInRange}`,
  params: [from, to],
});

export const kindDistributionSql = (from: number, to: number): StatsQuery => ({
  sql: `SELECT kind, SUM(actual_sec) AS total_sec, COUNT(*) AS sessions
        FROM timer_sessions
        WHERE ${sessionsInRange}
        GROUP BY kind`,
  params: [from, to],
});

export const focusPerHourSql = (from: number, to: number, tzSec: number): StatsQuery => ({
  sql: `SELECT CAST(strftime('%H', ${localSec('started_at', tzSec)}, 'unixepoch') AS INTEGER) AS hour,
               SUM(actual_sec) AS value
        FROM timer_sessions
        WHERE ${sessionsInRange} AND kind = 'fokus'
        GROUP BY hour ORDER BY hour`,
  params: [from, to],
});

export const tasksDonePerDaySql = (from: number, to: number, tzSec: number): StatsQuery => ({
  sql: `SELECT date(${localSec('completed_at', tzSec)}, 'unixepoch') AS day, COUNT(*) AS value
        FROM tasks
        WHERE deleted_at IS NULL AND status = 'done' AND completed_at >= ? AND completed_at < ?
        GROUP BY day ORDER BY day`,
  params: [from, to],
});

/** Distinct local days with a completed focus session, newest first (whole history, for streaks). */
export const focusDaysSql = (tzSec: number, limit = 1000): StatsQuery => ({
  sql: `SELECT DISTINCT date(${localSec('started_at', tzSec)}, 'unixepoch') AS day
        FROM timer_sessions
        WHERE deleted_at IS NULL AND kind = 'fokus' AND completed = 1
        ORDER BY day DESC
        LIMIT ${Math.trunc(limit)}`,
  params: [],
});
