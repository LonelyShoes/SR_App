import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sqliteDb } from '../../db/client';
import { secureSessionStorage } from './secure-storage';
import type { Cursor, RemoteRow, SqlExecutor, SyncRemote } from './engine';

// Public client values only (publishable key + RLS). Never put the secret /
// service_role key in the app. Set them in .env.local (see docs/supabase-setup.md).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSyncConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;

/** Lazily created so the app works fully offline/unconfigured (sync is optional). */
export const getSupabase = (): SupabaseClient | null => {
  if (!isSyncConfigured) return null;
  client ??= createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
};

/** expo-sqlite implementation of the engine's executor. */
export const expoExecutor: SqlExecutor = {
  all: (sql, params = []) => sqliteDb.getAllAsync(sql, params),
  run: async (sql, params = []) => {
    const { changes } = await sqliteDb.runAsync(sql, params);
    return { changes };
  },
};

// PostgREST filter values containing ':' '+' '.' must be double-quoted
const quote = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

export const supabaseRemote = (supabase: SupabaseClient, userId: string): SyncRemote => ({
  async push(table, rows) {
    const { data, error } = await supabase.from(table).upsert(rows, { onConflict: 'user_id,id' }).select();
    if (error) throw error;
    return (data ?? []) as RemoteRow[];
  },

  async pull(table, cursor: Cursor | null, limit) {
    let query = supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('server_updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit);
    if (cursor) {
      const at = quote(cursor.at);
      query = query.or(`server_updated_at.gt.${at},and(server_updated_at.eq.${at},id.gt.${quote(cursor.id)})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as RemoteRow[];
  },
});
