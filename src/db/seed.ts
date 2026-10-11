import { db } from './client';
import { timer_presets } from './schema';
import { count } from 'drizzle-orm';

/**
 * Default presets use fixed ids and updated_at = 0 so every device seeds the
 * *same* rows: sync then never duplicates them, and any user edit (newer
 * updated_at) wins. They start clean (dirty = 0); edits mark them dirty.
 * See docs/decisions.md #10.
 */
const DEFAULT_PRESETS = [
  { id: 'default-fokus', kind: 'fokus', name: 'Fokus', duration_sec: 25 * 60, sort_order: 1 },
  { id: 'default-rehat', kind: 'rehat', name: 'Rehat Pendek', duration_sec: 5 * 60, sort_order: 2 },
  { id: 'default-santai', kind: 'santai', name: 'Istirahat Panjang', duration_sec: 15 * 60, sort_order: 3 },
];

export async function seedPresets(database: typeof db) {
  try {
    const [{ value }] = await database.select({ value: count() }).from(timer_presets);
    if (value === 0) {
      await database
        .insert(timer_presets)
        .values(DEFAULT_PRESETS.map((p) => ({ ...p, created_at: 0, updated_at: 0, dirty: 0 })))
        .onConflictDoNothing();
    }
  } catch (err) {
    console.error('Seed error:', err);
  }
}
