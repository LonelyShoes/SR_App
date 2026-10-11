import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cursor, RemoteRow, SyncRemote } from './engine';

// Kept free of Expo imports so it can be exercised against a real Supabase
// project from Node (see __tests__/supabase.e2e.test.ts).

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
