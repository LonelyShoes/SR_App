import { combineDateTime, toDateText, toTimeText } from '../../lib/date-input';
import { QuickPlanDraft, QuickPlanKind } from '../../lib/date-parser-id';
import { createTask } from '../tasks/repository';
import { createMeeting } from '../meetings/repository';

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
  dateText: toDateText(draft.date?.getTime()),
  timeText: draft.hasTime ? toTimeText(draft.date?.getTime()) : '',
  // Due within a day reads as urgent; importance is the user's call on the form
  quadrant: draft.date && draft.date.getTime() - now.getTime() <= DAY_MS ? 'Q1' : 'Q2',
});

/** Validates the form and saves it. Returns an error message, or null on success. */
export const saveQuickPlan = async (form: QuickPlanForm): Promise<string | null> => {
  const title = form.title.trim();
  if (!title) return 'Judul tidak boleh kosong.';

  if (form.kind === 'meeting') {
    if (!form.dateText.trim()) return 'Rapat butuh tanggal (hh/bb/tttt).';
    const start = combineDateTime(form.dateText, form.timeText, MEETING_DEFAULT_TIME);
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
    const due = combineDateTime(form.dateText, form.timeText, TASK_DEFAULT_TIME);
    if (!due) return 'Tanggal atau jam tenggat tidak valid.';
    dueAt = due.getTime();
  }
  await createTask({ title, quadrant: form.quadrant, due_at: dueAt, source: 'voice' });
  return null;
};
