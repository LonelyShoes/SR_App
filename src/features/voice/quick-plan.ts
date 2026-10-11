import { format, isValid, parse } from 'date-fns';
import { QuickPlanDraft, QuickPlanKind } from '../../lib/date-parser-id';
import { createTask } from '../tasks/repository';
import { createMeeting } from '../meetings/repository';

export const DATE_FORMAT = 'dd/MM/yyyy';
export const TIME_FORMAT = 'HH:mm';
const MEETING_DEFAULT_TIME = { hour: 9, minute: 0 };
// A task due "on a day" without a time is due at the end of that day
const TASK_DEFAULT_TIME = { hour: 23, minute: 59 };
const MEETING_DURATION_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';

/** Editable form shown on the confirmation screen. */
export type QuickPlanForm = {
  kind: QuickPlanKind;
  title: string;
  dateText: string;
  timeText: string;
  quadrant: Quadrant;
};

export const draftToForm = (draft: QuickPlanDraft, now: Date = new Date()): QuickPlanForm => ({
  kind: draft.kind,
  title: draft.title,
  dateText: draft.date ? format(draft.date, DATE_FORMAT) : '',
  timeText: draft.date && draft.hasTime ? format(draft.date, TIME_FORMAT) : '',
  // Due within a day reads as urgent; importance is the user's call on the form
  quadrant: draft.date && draft.date.getTime() - now.getTime() <= DAY_MS ? 'Q1' : 'Q2',
});

const parseDateTime = (dateText: string, timeText: string, defaultTime: { hour: number; minute: number }) => {
  const date = parse(dateText.trim(), DATE_FORMAT, new Date());
  if (!isValid(date)) return null;
  if (!timeText.trim()) {
    date.setHours(defaultTime.hour, defaultTime.minute, 0, 0);
    return date;
  }
  const time = parse(timeText.trim(), TIME_FORMAT, date);
  return isValid(time) ? time : null;
};

/** Validates the form and saves it. Returns an error message, or null on success. */
export const saveQuickPlan = async (form: QuickPlanForm): Promise<string | null> => {
  const title = form.title.trim();
  if (!title) return 'Judul tidak boleh kosong.';

  if (form.kind === 'meeting') {
    if (!form.dateText.trim()) return 'Rapat butuh tanggal (hh/bb/tttt).';
    const start = parseDateTime(form.dateText, form.timeText, MEETING_DEFAULT_TIME);
    if (!start) return 'Tanggal atau jam rapat tidak valid.';
    await createMeeting({
      title,
      start_at: start.getTime(),
      end_at: start.getTime() + MEETING_DURATION_MS,
      source: 'voice',
    });
    return null;
  }

  let dueAt: number | null = null;
  if (form.dateText.trim()) {
    const due = parseDateTime(form.dateText, form.timeText, TASK_DEFAULT_TIME);
    if (!due) return 'Tanggal atau jam tenggat tidak valid.';
    dueAt = due.getTime();
  }
  await createTask({ title, quadrant: form.quadrant, due_at: dueAt, source: 'voice' });
  return null;
};
