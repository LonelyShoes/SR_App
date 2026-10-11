/**
 * Rule-based parser that turns an Indonesian sentence (from voice or typing)
 * into a draft task or meeting. Pure function: pass `now` for deterministic tests.
 *
 * Rules (see docs/decisions.md #6 for the ambiguous ones):
 * - Day: hari ini, nanti (= today), besok, lusa, Senin–Minggu (next occurrence after today),
 *   "<hari> depan" (that weekday in next calendar week), "minggu depan" (Monday next week),
 *   tanggal/tgl N [bulan] [tahun].
 * - Time: jam/pukul N, N.MM / N:MM, setengah N (= N-1:30), with pagi/siang/sore/malam.
 *   Without a period word, jam 1–5 is read as afternoon (13–17).
 *   "besok pagi" etc. without a time uses a default hour for the period.
 * - Time without a day that has already passed today rolls over to tomorrow.
 * - Keyword rapat/meeting/pertemuan → meeting, otherwise task.
 */

export type QuickPlanKind = 'task' | 'meeting';

export type QuickPlanDraft = {
  kind: QuickPlanKind;
  title: string;
  date: Date | null;
  hasTime: boolean;
};

type Period = 'pagi' | 'siang' | 'sore' | 'malam';

const WEEKDAYS: Record<string, number> = {
  minggu: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  "jum'at": 5,
  sabtu: 6,
};

const MONTHS: Record<string, number> = {
  januari: 0,
  jan: 0,
  februari: 1,
  feb: 1,
  maret: 2,
  mar: 2,
  april: 3,
  apr: 3,
  mei: 4,
  juni: 5,
  jun: 5,
  juli: 6,
  jul: 6,
  agustus: 7,
  agu: 7,
  agt: 7,
  september: 8,
  sept: 8,
  sep: 8,
  oktober: 9,
  okt: 9,
  november: 10,
  nov: 10,
  desember: 11,
  des: 11,
};

// Speech recognizers sometimes spell out small numbers
const NUMBER_WORDS: Record<string, number> = {
  'dua belas': 12,
  sebelas: 11,
  sepuluh: 10,
  sembilan: 9,
  delapan: 8,
  tujuh: 7,
  enam: 6,
  lima: 5,
  empat: 4,
  tiga: 3,
  dua: 2,
  satu: 1,
};

const PERIOD_DEFAULT_HOUR: Record<Period, number> = { pagi: 8, siang: 12, sore: 15, malam: 19 };

const NUM = `(\\d{1,2}|${Object.keys(NUMBER_WORDS).join('|')})`;
const PERIOD = '(pagi|siang|sore|malam)';
const MEETING_KEYWORDS = /\b(rapat|meeting|pertemuan)\b/i;

type Span = [number, number];

const toNumber = (value: string) => NUMBER_WORDS[value] ?? Number(value);

const atStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Build a date only if day/month exist (rejects e.g. 31 November). */
const safeDate = (year: number, month: number, day: number): Date | null => {
  const d = new Date(year, month, day);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null;
};

const applyPeriod = (hour: number, period: Period | null): number => {
  switch (period) {
    case 'pagi':
      return hour === 12 ? 0 : hour;
    case 'siang':
      return hour < 11 ? hour + 12 : hour;
    case 'sore':
      return hour < 12 ? hour + 12 : hour;
    case 'malam':
      if (hour === 12) return 0;
      return hour >= 6 && hour < 12 ? hour + 12 : hour;
    default:
      // Working-hours bias: "jam 3" means 15:00
      return hour >= 1 && hour <= 5 ? hour + 12 : hour;
  }
};

const parseDay = (text: string, now: Date, spans: Span[]): { date: Date | null; period: Period | null } => {
  const today = atStartOfDay(now);

  // 1. tanggal N [bulan] [tahun]
  const tanggal = new RegExp(
    `\\b(?:tanggal|tgl\\.?)\\s+(\\d{1,2})(?:\\s+(${Object.keys(MONTHS).join('|')})\\b(?:\\s+(\\d{4}))?)?`,
  ).exec(text);
  if (tanggal) {
    const day = Number(tanggal[1]);
    const monthGiven = tanggal[2] !== undefined;
    const yearGiven = tanggal[3] !== undefined;
    let month = monthGiven ? MONTHS[tanggal[2]] : today.getMonth();
    let year = yearGiven ? Number(tanggal[3]) : today.getFullYear();
    let date = safeDate(year, month, day);
    if (date && date < today && !yearGiven) {
      // Already passed: next month (no month given) or next year (month given)
      if (monthGiven) year += 1;
      else if (++month > 11) [month, year] = [0, year + 1];
      date = safeDate(year, month, day);
    }
    spans.push([tanggal.index, tanggal.index + tanggal[0].length]);
    return { date, period: null };
  }

  // 2. "minggu depan" without "hari" = next week (Monday)
  const nextWeek = /\b(hari\s+)?minggu\s+depan\b/.exec(text);
  if (nextWeek && !nextWeek[1]) {
    spans.push([nextWeek.index, nextWeek.index + nextWeek[0].length]);
    const daysSinceMonday = (today.getDay() + 6) % 7;
    return { date: addDays(today, 7 - daysSinceMonday), period: null };
  }

  // 3. [hari] <weekday> [depan]
  const weekday = new RegExp(`\\b(?:hari\\s+)?(${Object.keys(WEEKDAYS).join('|')})(\\s+depan)?\\b`).exec(text);
  if (weekday) {
    const target = WEEKDAYS[weekday[1]];
    let date: Date;
    if (weekday[2]) {
      // That weekday in the next calendar week (weeks start on Monday)
      const daysSinceMonday = (today.getDay() + 6) % 7;
      const nextMonday = addDays(today, 7 - daysSinceMonday);
      date = addDays(nextMonday, (target + 6) % 7);
    } else {
      const diff = (target - today.getDay() + 7) % 7 || 7;
      date = addDays(today, diff);
    }
    spans.push([weekday.index, weekday.index + weekday[0].length]);
    return { date, period: null };
  }

  // 4. hari ini / nanti / besok / lusa, optionally followed by a period word
  const relative = new RegExp(`\\b(hari ini|nanti|besok|lusa)\\b(?:\\s+${PERIOD}\\b)?`).exec(text);
  if (relative) {
    const offset = relative[1] === 'besok' ? 1 : relative[1] === 'lusa' ? 2 : 0;
    spans.push([relative.index, relative.index + relative[0].length]);
    return { date: addDays(today, offset), period: (relative[2] as Period | undefined) ?? null };
  }

  return { date: null, period: null };
};

const parseTime = (text: string, dayPeriod: Period | null, spans: Span[]): { hour: number; minute: number } | null => {
  // setengah N → (N-1):30
  const half = new RegExp(`\\b(?:(?:jam|pukul|pkl\\.?)\\s+)?setengah\\s+${NUM}\\b(?:\\s+${PERIOD}\\b)?`).exec(text);
  if (half) {
    const n = toNumber(half[1]);
    if (n >= 1 && n <= 24) {
      const period = (half[2] as Period | undefined) ?? dayPeriod;
      spans.push([half.index, half.index + half[0].length]);
      // "setengah 1" without a period word means 12:30, not 00:30
      const hour = n - 1 === 0 && !period ? 12 : applyPeriod(n - 1, period);
      return { hour: hour % 24, minute: 30 };
    }
  }

  const clock = new RegExp(`\\b(?:jam|pukul|pkl\\.?)\\s+${NUM}(?:[.:](\\d{2}))?\\b(?:\\s+${PERIOD}\\b)?`).exec(text);
  if (clock) {
    const rawHour = toNumber(clock[1]);
    const minute = clock[2] ? Number(clock[2]) : 0;
    if (rawHour <= 23 && minute <= 59) {
      const period = (clock[3] as Period | undefined) ?? dayPeriod;
      // 24-hour input like 14.30 needs no period adjustment
      const hour = rawHour > 12 ? rawHour : applyPeriod(rawHour, period);
      spans.push([clock.index, clock.index + clock[0].length]);
      return { hour, minute };
    }
  }

  if (dayPeriod) return { hour: PERIOD_DEFAULT_HOUR[dayPeriod], minute: 0 };
  return null;
};

const LEADING_FILLERS = /^(?:tolong\s+)?(?:ingatkan(?:\s+saya)?(?:\s+untuk)?\s+)?/i;
const EDGE_CONNECTORS = /^(?:(?:pada|pas|di|hari|untuk|dan)\s+)+|(?:\s+(?:pada|pas|di|hari|untuk|dan))+$/i;

const buildTitle = (original: string, spans: Span[]): string => {
  let title = original;
  // Remove from the end so earlier indices stay valid
  for (const [start, end] of [...spans].sort((a, b) => b[0] - a[0])) {
    title = `${title.slice(0, start)} ${title.slice(end)}`;
  }
  title = title
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
    .trim()
    .replace(LEADING_FILLERS, '')
    .replace(EDGE_CONNECTORS, '')
    .trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
};

export const parseQuickPlan = (input: string, now: Date = new Date()): QuickPlanDraft => {
  const original = input.trim();
  // Lowercasing keeps string length, so match indices map back onto `original`
  const text = original.toLowerCase();
  const spans: Span[] = [];

  const { date: day, period } = parseDay(text, now, spans);
  const time = parseTime(text, period, spans);

  let date: Date | null = null;
  if (day && time) {
    date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hour, time.minute);
  } else if (day) {
    date = day;
  } else if (time) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.hour, time.minute);
    if (date < now) {
      date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, time.hour, time.minute);
    }
  }

  return {
    kind: MEETING_KEYWORDS.test(text) ? 'meeting' : 'task',
    title: buildTitle(original, spans),
    date,
    hasTime: time !== null && date !== null,
  };
};
