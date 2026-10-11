import { db } from '../../db/client';
import { meetings } from '../../db/schema';
import { eq, isNull, asc } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { reconcileMeetingReminders } from '../../notifications/scheduler';

export type MeetingInsert = typeof meetings.$inferInsert;
export type Meeting = typeof meetings.$inferSelect;

export const getMeetingsQuery = () => {
  return db.select().from(meetings).where(isNull(meetings.deleted_at)).orderBy(asc(meetings.start_at));
};

// Re-sync H-30 reminders after any meeting change (see docs/decisions.md #3)
const refreshReminders = () =>
  reconcileMeetingReminders().catch((e) => console.warn('Failed to reconcile meeting reminders:', e));

export const createMeeting = async (data: Omit<MeetingInsert, 'id' | 'created_at' | 'updated_at' | 'dirty' | 'status'> & { status?: string }) => {
  const now = Date.now();
  await db.insert(meetings).values({
    ...data,
    status: data.status || 'rencana',
    id: Crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    dirty: 1,
  });
  await refreshReminders();
};

export const updateMeeting = async (id: string, data: Partial<Omit<MeetingInsert, 'id' | 'created_at' | 'updated_at' | 'dirty'>>) => {
  const now = Date.now();
  await db
    .update(meetings)
    .set({
      ...data,
      updated_at: now,
      dirty: 1,
    })
    .where(eq(meetings.id, id));
  await refreshReminders();
};

export const updateMeetingStatus = async (id: string, status: string) => {
  const now = Date.now();
  await db
    .update(meetings)
    .set({
      status,
      updated_at: now,
      dirty: 1,
    })
    .where(eq(meetings.id, id));
  await refreshReminders();
};

export const softDeleteMeeting = async (id: string) => {
  const now = Date.now();
  await db
    .update(meetings)
    .set({
      deleted_at: now,
      updated_at: now,
      dirty: 1,
    })
    .where(eq(meetings.id, id));
  await refreshReminders();
};

export const getMeetingById = async (id: string): Promise<Meeting | null> => {
  const rows = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  return rows[0] ?? null;
};
