import { format, isValid, parse } from 'date-fns';

/**
 * Text-based date/time inputs shared by the forms (no native picker dependency).
 * Users type dd/MM/yyyy and HH:mm; parsing is strict.
 */
export const DATE_FORMAT = 'dd/MM/yyyy';
export const TIME_FORMAT = 'HH:mm';

export type TimeOfDay = { hour: number; minute: number };

export const toDateText = (ms: number | null | undefined) => (ms == null ? '' : format(ms, DATE_FORMAT));
export const toTimeText = (ms: number | null | undefined) => (ms == null ? '' : format(ms, TIME_FORMAT));

/**
 * Combine a typed date and optional time into a Date.
 * Empty time uses `defaultTime`. Returns null when either part is invalid.
 */
export const combineDateTime = (dateText: string, timeText: string, defaultTime: TimeOfDay): Date | null => {
  const date = parse(dateText.trim(), DATE_FORMAT, new Date());
  if (!isValid(date)) return null;
  if (!timeText.trim()) {
    date.setHours(defaultTime.hour, defaultTime.minute, 0, 0);
    return date;
  }
  // Accept 9.30 as well as 09:30
  const time = parse(timeText.trim().replace('.', ':'), TIME_FORMAT, date);
  return isValid(time) ? time : null;
};
