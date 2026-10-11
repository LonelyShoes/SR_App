import { isSameDay } from 'date-fns';
import { getTasksQuery, Task } from '../features/tasks/repository';
import { getMeetingsQuery, Meeting } from '../features/meetings/repository';

export type DashboardSummary = {
  agendaToday: number;
  confirmedToday: number;
  /** Todo tasks that are Q1 or due today (same rule as the Dashboard briefing) */
  urgentTasks: number;
  upcoming: { title: string; startAt: number }[];
};

const UPCOMING_LIMIT = 3;

export const summarizeDashboard = (tasks: Task[], meetings: Meeting[], now: number): DashboardSummary => {
  const today = meetings.filter((m) => isSameDay(m.start_at, now));
  return {
    agendaToday: today.length,
    confirmedToday: today.filter((m) => m.status === 'terkonfirmasi').length,
    urgentTasks: tasks.filter(
      (t) => t.status === 'todo' && (t.quadrant === 'Q1' || (t.due_at != null && isSameDay(t.due_at, now))),
    ).length,
    upcoming: meetings
      .filter((m) => m.start_at >= now && (m.status === 'rencana' || m.status === 'terkonfirmasi'))
      .slice(0, UPCOMING_LIMIT) // already sorted by start_at
      .map((m) => ({ title: m.title, startAt: m.start_at })),
  };
};

export const EMPTY_SUMMARY: DashboardSummary = { agendaToday: 0, confirmedToday: 0, urgentTasks: 0, upcoming: [] };

/**
 * Runs in the widget's headless task too, where the app (and its migrations)
 * may never have run yet, so fall back to an empty summary.
 */
export const loadDashboardSummary = async (): Promise<DashboardSummary> => {
  try {
    const [tasks, meetings] = await Promise.all([getTasksQuery(), getMeetingsQuery()]);
    return summarizeDashboard(tasks, meetings, Date.now());
  } catch (e) {
    console.warn('Widget: failed to load dashboard data', e);
    return EMPTY_SUMMARY;
  }
};
