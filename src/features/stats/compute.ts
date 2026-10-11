/** Pure helpers for the Statistik screen; they work on already-aggregated rows. */

export type DayValue = { day: string; value: number }; // day = 'YYYY-MM-DD' (local)

const DAY_MS = 24 * 60 * 60 * 1000;

/** Device UTC offset in seconds (WIB = +25200). */
export const deviceTzSec = (date: Date = new Date()) => -date.getTimezoneOffset() * 60;

/** Local 'YYYY-MM-DD' for an epoch ms, matching the SQL `date(ms/1000 + tz, 'unixepoch')`. */
export const dayKey = (ms: number, tzSec: number) => new Date(ms + tzSec * 1000).toISOString().slice(0, 10);

/** [from, to) covering the last `days` local days, today included. */
export const rangeForDays = (days: number, now: Date) => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return { from: startOfToday - (days - 1) * DAY_MS, to: startOfToday + DAY_MS };
};

/** One entry per day in [from, from + days), zero where the query returned nothing. */
export const fillDays = (rows: DayValue[], from: number, days: number, tzSec: number): DayValue[] => {
  const byDay = new Map(rows.map((r) => [r.day, r.value]));
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(from + i * DAY_MS, tzSec);
    return { day, value: byDay.get(day) ?? 0 };
  });
};

/** Sum consecutive days into buckets of `size` (e.g. weeks for the 90-day view). */
export const bucket = (series: DayValue[], size: number): DayValue[] => {
  const out: DayValue[] = [];
  for (let i = 0; i < series.length; i += size) {
    const chunk = series.slice(i, i + size);
    out.push({ day: chunk[0].day, value: chunk.reduce((sum, d) => sum + d.value, 0) });
  }
  return out;
};

const previousDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);

/**
 * Streaks from distinct active days sorted newest first.
 * The current streak survives until the end of today: if today has no session
 * yet, a streak ending yesterday still counts.
 */
export const computeStreaks = (daysDesc: string[], today: string) => {
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of daysDesc) {
    run = prev !== null && previousDay(prev) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }

  let current = 0;
  if (daysDesc.length > 0 && (daysDesc[0] === today || daysDesc[0] === previousDay(today))) {
    current = 1;
    for (let i = 1; i < daysDesc.length && previousDay(daysDesc[i - 1]) === daysDesc[i]; i++) current++;
  }
  return { current, longest };
};

export const completionRate = (total: number, completed: number) =>
  total === 0 ? 0 : Math.round((completed / total) * 100);

/** 24 entries (0–23) from sparse hour rows; plus the busiest hour, or null if none. */
export const fillHours = (rows: { hour: number; value: number }[]) => {
  const hours = Array.from({ length: 24 }, (_, hour) => rows.find((r) => r.hour === hour)?.value ?? 0);
  const max = Math.max(...hours);
  return { hours, peakHour: max > 0 ? hours.indexOf(max) : null };
};

export const formatDuration = (sec: number) => {
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} mnt`;
  return m === 0 ? `${h} j` : `${h} j ${m} mnt`;
};
