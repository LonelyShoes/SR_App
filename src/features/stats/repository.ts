import { sqliteDb } from '../../db/client';
import {
  StatsQuery,
  focusDaysSql,
  focusPerDaySql,
  focusPerHourSql,
  kindDistributionSql,
  sessionSummarySql,
  tasksDonePerDaySql,
} from './sql';
import {
  DayValue,
  bucket,
  completionRate,
  computeStreaks,
  dayKey,
  deviceTzSec,
  fillDays,
  fillHours,
  rangeForDays,
} from './compute';

export type StatsRange = 7 | 30 | 90;

export type Stats = {
  /** Bars per day (7/30) or per week (90) */
  focusSeries: DayValue[];
  tasksSeries: DayValue[];
  seriesUnit: 'hari' | 'minggu';
  totalFocusSec: number;
  avgFocusSec: number;
  sessionsTotal: number;
  sessionsCompleted: number;
  completionPct: number;
  streak: { current: number; longest: number };
  kinds: { kind: string; totalSec: number; sessions: number }[];
  hours: number[];
  peakHour: number | null;
};

const all = <T>(q: StatsQuery) => sqliteDb.getAllAsync<T>(q.sql, q.params);

export const loadStats = async (days: StatsRange, now: Date = new Date()): Promise<Stats> => {
  const tz = deviceTzSec(now);
  const { from, to } = rangeForDays(days, now);

  const [focusRows, summary, kindRows, hourRows, taskRows, focusDays] = await Promise.all([
    all<DayValue>(focusPerDaySql(from, to, tz)),
    sqliteDb.getFirstAsync<{ total: number; completed: number; focus_sec: number; avg_focus_sec: number }>(
      sessionSummarySql(from, to).sql,
      sessionSummarySql(from, to).params,
    ),
    all<{ kind: string; total_sec: number; sessions: number }>(kindDistributionSql(from, to)),
    all<{ hour: number; value: number }>(focusPerHourSql(from, to, tz)),
    all<DayValue>(tasksDonePerDaySql(from, to, tz)),
    all<{ day: string }>(focusDaysSql(tz)),
  ]);

  const weekly = days === 90;
  const shape = (rows: DayValue[]) => {
    const daily = fillDays(rows, from, days, tz);
    return weekly ? bucket(daily, 7) : daily;
  };
  const { hours, peakHour } = fillHours(hourRows);
  const total = summary?.total ?? 0;
  const completed = summary?.completed ?? 0;

  return {
    focusSeries: shape(focusRows),
    tasksSeries: shape(taskRows),
    seriesUnit: weekly ? 'minggu' : 'hari',
    totalFocusSec: summary?.focus_sec ?? 0,
    avgFocusSec: summary?.avg_focus_sec ?? 0,
    sessionsTotal: total,
    sessionsCompleted: completed,
    completionPct: completionRate(total, completed),
    streak: computeStreaks(
      focusDays.map((d) => d.day),
      dayKey(now.getTime(), tz),
    ),
    kinds: kindRows.map((k) => ({ kind: k.kind, totalSec: k.total_sec, sessions: k.sessions })),
    hours,
    peakHour,
  };
};
