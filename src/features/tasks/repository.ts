import { db } from '../../db/client';
import { tasks } from '../../db/schema';
import { eq, isNull, desc } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';

export type TaskInsert = typeof tasks.$inferInsert;
export type Task = typeof tasks.$inferSelect;

export const getTasksQuery = () => {
  return db.select().from(tasks).where(isNull(tasks.deleted_at)).orderBy(desc(tasks.created_at));
};

export const createTask = async (
  data: Omit<TaskInsert, 'id' | 'created_at' | 'updated_at' | 'dirty' | 'status'> & { status?: string },
) => {
  const now = Date.now();
  const id = Crypto.randomUUID();
  await db.insert(tasks).values({
    ...data,
    status: data.status || 'todo',
    id,
    created_at: now,
    updated_at: now,
    dirty: 1,
  });
  return id;
};

export const updateTask = async (
  id: string,
  data: Partial<Omit<TaskInsert, 'id' | 'created_at' | 'updated_at' | 'dirty'>>,
) => {
  const now = Date.now();
  await db
    .update(tasks)
    .set({
      ...data,
      updated_at: now,
      dirty: 1,
    })
    .where(eq(tasks.id, id));
};

export const toggleTaskStatus = async (id: string, currentStatus: string) => {
  const now = Date.now();
  const newStatus = currentStatus === 'todo' ? 'done' : 'todo';
  const completedAt = newStatus === 'done' ? now : null;
  await db
    .update(tasks)
    .set({
      status: newStatus,
      completed_at: completedAt,
      updated_at: now,
      dirty: 1,
    })
    .where(eq(tasks.id, id));
};

export const softDeleteTask = async (id: string) => {
  const now = Date.now();
  await db
    .update(tasks)
    .set({
      deleted_at: now,
      updated_at: now,
      dirty: 1,
    })
    .where(eq(tasks.id, id));
};
