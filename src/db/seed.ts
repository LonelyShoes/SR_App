import { db } from './client';
import { timer_presets } from './schema';
import { count } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';

export async function seedPresets(database: typeof db) {
  try {
    const [{ value }] = await database.select({ value: count() }).from(timer_presets);
    if (value === 0) {
      await database.insert(timer_presets).values([
        {
          id: Crypto.randomUUID(),
          kind: 'fokus',
          name: 'Fokus',
          duration_sec: 25 * 60,
          sort_order: 1,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: Crypto.randomUUID(),
          kind: 'rehat',
          name: 'Rehat Pendek',
          duration_sec: 5 * 60,
          sort_order: 2,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: Crypto.randomUUID(),
          kind: 'santai',
          name: 'Istirahat Panjang',
          duration_sec: 15 * 60,
          sort_order: 3,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ]);
    }
  } catch (err) {
    console.error('Seed error:', err);
  }
}
