import { db, sqliteDb } from '../../db/client';
import { settings } from '../../db/schema';

/** Local-only key-value settings (never synced). */
export type SettingKey =
  | 'theme_mode'
  | 'default_reminder_offset_min'
  | 'reminders_enabled'
  | 'sync_enabled'
  | 'sync_user_id'
  | 'sync_cursors'
  | 'last_synced_at';

/** Synchronous read, for values needed before the first render (e.g. theme). */
export const getSettingSync = (key: SettingKey): string | null => {
  try {
    const row = sqliteDb.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? null;
  } catch {
    return null;
  }
};

export const getSetting = async (key: SettingKey): Promise<string | null> => {
  const row = await sqliteDb.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
};

export const setSetting = async (key: SettingKey, value: string) => {
  const now = Date.now();
  await db
    .insert(settings)
    .values({ key, value, updated_at: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updated_at: now } });
};
