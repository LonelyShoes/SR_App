import { db } from '../../db/client';
import { timer_sessions, timer_presets } from '../../db/schema';
import { eq, isNull, desc } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';

export type TimerPreset = typeof timer_presets.$inferSelect;
export type TimerSession = typeof timer_sessions.$inferSelect;

export const getPresetsQuery = () => {
  return db
    .select()
    .from(timer_presets)
    .where(isNull(timer_presets.deleted_at))
    .orderBy(timer_presets.sort_order);
};

export const getSessionsQuery = () => {
  return db
    .select()
    .from(timer_sessions)
    .where(isNull(timer_sessions.deleted_at))
    .orderBy(desc(timer_sessions.started_at));
};

export const createPreset = async (
  kind: string,
  name: string,
  durationSec: number,
  sortOrder: number = 0,
) => {
  const now = Date.now();
  await db.insert(timer_presets).values({
    id: Crypto.randomUUID(),
    kind,
    name,
    duration_sec: durationSec,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
    dirty: 1,
  });
};

export const updatePreset = async (
  id: string,
  data: Partial<{
    kind: string;
    name: string;
    duration_sec: number;
    sort_order: number;
  }>,
) => {
  const now = Date.now();
  await db
    .update(timer_presets)
    .set({ ...data, updated_at: now, dirty: 1 })
    .where(eq(timer_presets.id, id));
};

export const softDeletePreset = async (id: string) => {
  const now = Date.now();
  await db
    .update(timer_presets)
    .set({ deleted_at: now, updated_at: now, dirty: 1 })
    .where(eq(timer_presets.id, id));
};
