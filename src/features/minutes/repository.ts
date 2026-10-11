import { db } from '../../db/client';
import { minutes, meetings } from '../../db/schema';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { createTask } from '../tasks/repository';
import type { Attachment } from './attachments';

export type ActionItem = {
  text: string;
  assignee: string | null;
  due_at: number | null;
  task_id?: string;
};

export type Minute = typeof minutes.$inferSelect;

export type MinuteInput = {
  discussion: string;
  decisions: string;
  attendees: string[];
  action_items: ActionItem[];
  attachments: Attachment[];
};

/** Notula list joined with its meeting, newest meeting first. */
export const getMinutesWithMeetingQuery = () => {
  return db
    .select({
      id: minutes.id,
      meeting_id: minutes.meeting_id,
      updated_at: minutes.updated_at,
      title: meetings.title,
      start_at: meetings.start_at,
    })
    .from(minutes)
    .innerJoin(meetings, eq(minutes.meeting_id, meetings.id))
    .where(and(isNull(minutes.deleted_at), isNull(meetings.deleted_at)))
    .orderBy(desc(meetings.start_at));
};

/** Meetings (not cancelled) that don't have an active notula yet. */
export const getMeetingsWithoutMinutesQuery = () => {
  return db
    .select({
      id: meetings.id,
      title: meetings.title,
      start_at: meetings.start_at,
      status: meetings.status,
    })
    .from(meetings)
    .leftJoin(minutes, and(eq(minutes.meeting_id, meetings.id), isNull(minutes.deleted_at)))
    .where(and(isNull(meetings.deleted_at), ne(meetings.status, 'batal'), isNull(minutes.id)))
    .orderBy(desc(meetings.start_at));
};

export const getMinuteByMeetingId = async (meetingId: string): Promise<Minute | null> => {
  const rows = await db
    .select()
    .from(minutes)
    .where(and(eq(minutes.meeting_id, meetingId), isNull(minutes.deleted_at)))
    .limit(1);
  return rows[0] ?? null;
};

/** Create or update the notula for a meeting. Returns the notula id. */
export const saveMinute = async (meetingId: string, input: MinuteInput): Promise<string> => {
  const now = Date.now();
  const existing = await getMinuteByMeetingId(meetingId);

  if (existing) {
    await db
      .update(minutes)
      .set({ ...input, updated_at: now, dirty: 1 })
      .where(eq(minutes.id, existing.id));
    return existing.id;
  }

  const id = Crypto.randomUUID();
  await db.insert(minutes).values({
    ...input,
    id,
    meeting_id: meetingId,
    created_at: now,
    updated_at: now,
    dirty: 1,
  });
  return id;
};

export const softDeleteMinute = async (id: string) => {
  const now = Date.now();
  await db.update(minutes).set({ deleted_at: now, updated_at: now, dirty: 1 }).where(eq(minutes.id, id));
};

/**
 * Turn an action item into a Matrix task linked to the meeting.
 * Returns the action item with its new task_id.
 */
export const convertActionItemToTask = async (meetingId: string, item: ActionItem): Promise<ActionItem> => {
  if (item.task_id) return item;
  const taskId = await createTask({
    title: item.text,
    notes: item.assignee ? `PJ: ${item.assignee}` : null,
    quadrant: 'Q2',
    due_at: item.due_at,
    meeting_id: meetingId,
  });
  return { ...item, task_id: taskId };
};
