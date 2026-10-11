/**
 * End-to-end check against the real Supabase project (tables, RLS, LWW trigger,
 * pull cursor, storage bucket). Skipped unless SR_E2E=1:
 *
 *   SR_E2E=1 npx jest supabase.e2e
 *
 * Creates two throwaway users (needs "Confirm email" off), cleans up their rows
 * and files afterwards. The auth users themselves can only be deleted from the
 * Supabase dashboard (Authentication → Users).
 *
 * @jest-environment node
 */
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseSync } from 'node:sqlite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Cursors, SqlExecutor, SqlParam, syncAll } from '../engine';
import { supabaseRemote } from '../remote';
import { SYNC_TABLES } from '../tables';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const run = process.env.SR_E2E === '1' && URL && KEY ? describe : describe.skip;

jest.setTimeout(60000);

const MIGRATIONS_DIR = join(__dirname, '../../../db/migrations');

const createDevice = () => {
  const raw = new DatabaseSync(':memory:');
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    for (const statement of readFileSync(join(MIGRATIONS_DIR, file), 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) raw.exec(statement);
    }
  }
  const db: SqlExecutor = {
    all: async <T>(sql: string, params: SqlParam[] = []) => raw.prepare(sql).all(...params) as T[],
    run: async (sql: string, params: SqlParam[] = []) => ({ changes: Number(raw.prepare(sql).run(...params).changes) }),
  };
  return { raw, db };
};

const newUser = async (label: string) => {
  const client = createClient(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `sr-e2e-${label}-${Date.now()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: `E2e-${Date.now()}-pass!` });
  if (error) throw error;
  if (!data.session) throw new Error('No session after sign-up: is "Confirm email" still on?');
  return { client, userId: data.user!.id, email };
};

run('Supabase end-to-end', () => {
  let a: { client: SupabaseClient; userId: string; email: string };
  let b: { client: SupabaseClient; userId: string; email: string };

  beforeAll(async () => {
    a = await newUser('a');
    b = await newUser('b');
  });

  afterAll(async () => {
    for (const user of [a, b]) {
      if (!user) continue;
      for (const t of SYNC_TABLES) await user.client.from(t.name).delete().eq('user_id', user.userId);
      const { data } = await user.client.storage.from('backups').list(user.userId);
      if (data?.length) await user.client.storage.from('backups').remove(data.map((f) => `${user.userId}/${f.name}`));
      await user.client.auth.signOut();
    }
    console.log(`E2E users to delete in the dashboard: ${a?.email}, ${b?.email}`);
  });

  test('dua perangkat satu akun: kirim, terima, dan konflik last-write-wins', async () => {
    const phone = createDevice();
    const tablet = createDevice();
    const remote = supabaseRemote(a.client, a.userId);

    phone.raw.exec(`INSERT INTO tasks (id, title, quadrant, status, source, created_at, updated_at, dirty)
                    VALUES ('task-1', 'Dari HP', 'Q1', 'todo', 'manual', 1, 100, 1)`);
    phone.raw
      .exec(`INSERT INTO meetings (id, title, start_at, end_at, participants, status, source, created_at, updated_at, dirty)
                    VALUES ('meet-1', 'Rapat', 1, 2, '["Ani","Budi"]', 'rencana', 'manual', 1, 100, 1)`);

    let phoneCursors: Cursors = (await syncAll(phone.db, remote, a.userId, {})).cursors;
    let tabletCursors: Cursors = (await syncAll(tablet.db, remote, a.userId, {})).cursors;

    expect(tablet.raw.prepare('SELECT title, dirty FROM tasks WHERE id = ?').get('task-1')).toEqual({
      title: 'Dari HP',
      dirty: 0,
    });
    expect(tablet.raw.prepare('SELECT participants FROM meetings WHERE id = ?').get('meet-1')).toEqual({
      participants: '["Ani","Budi"]',
    });

    // Cursor uses the real server timestamp (with '+00:00'): a second pull must return nothing
    const again = await syncAll(tablet.db, remote, a.userId, tabletCursors);
    expect(again.pulled).toBe(0);

    // Offline edits on both; the later updated_at wins on the server and both devices
    phone.raw.exec(`UPDATE tasks SET title = 'Edit HP', updated_at = 300, dirty = 1 WHERE id = 'task-1'`);
    tablet.raw.exec(`UPDATE tasks SET title = 'Edit tablet', updated_at = 200, dirty = 1 WHERE id = 'task-1'`);
    phoneCursors = (await syncAll(phone.db, remote, a.userId, phoneCursors)).cursors;
    tabletCursors = (await syncAll(tablet.db, remote, a.userId, tabletCursors)).cursors;
    await syncAll(phone.db, remote, a.userId, phoneCursors);

    const { data } = await a.client.from('tasks').select('title, updated_at').eq('id', 'task-1').single();
    expect(data).toEqual({ title: 'Edit HP', updated_at: 300 });
    expect(tablet.raw.prepare('SELECT title, dirty FROM tasks WHERE id = ?').get('task-1')).toEqual({
      title: 'Edit HP',
      dirty: 0,
    });
  });

  test('trigger server menolak versi yang lebih lama', async () => {
    const remote = supabaseRemote(a.client, a.userId);
    const row = {
      user_id: a.userId,
      id: 'task-lww',
      title: 'Baru',
      quadrant: 'Q1',
      status: 'todo',
      source: 'manual',
      created_at: 1,
      updated_at: 500,
    };
    await remote.push('tasks', [row]);
    const [stored] = await remote.push('tasks', [{ ...row, title: 'Lama', updated_at: 400 }]);
    expect(stored).toMatchObject({ title: 'Baru', updated_at: 500 });
  });

  test('RLS: akun lain tidak bisa membaca atau menulis data akun ini', async () => {
    const asB = supabaseRemote(b.client, a.userId);
    expect(await asB.pull('tasks', null, 100)).toEqual([]);
    await expect(
      asB.push('tasks', [{ user_id: a.userId, id: 'hack', title: 'x', quadrant: 'Q1', created_at: 1, updated_at: 1 }]),
    ).rejects.toMatchObject({ code: '42501' });
  });

  test('bucket backup: unggah, daftar, unduh lewat signed URL, hapus; folder akun lain ditolak', async () => {
    const bucket = a.client.storage.from('backups');
    const path = `${a.userId}/2026-01-01T00-00-00-000Z.json`;
    const upload = await bucket.upload(path, JSON.stringify({ hello: 'backup' }), {
      contentType: 'application/json',
      upsert: true,
    });
    expect(upload.error).toBeNull();

    const { data: list } = await bucket.list(a.userId);
    expect(list?.map((f) => f.name)).toContain('2026-01-01T00-00-00-000Z.json');

    const { data: signed } = await bucket.createSignedUrl(path, 60);
    expect(await (await fetch(signed!.signedUrl)).json()).toEqual({ hello: 'backup' });

    const intrusion = await b.client.storage
      .from('backups')
      .upload(`${a.userId}/hack.json`, '{}', { contentType: 'application/json' });
    expect(intrusion.error).not.toBeNull();

    expect((await bucket.remove([path])).error).toBeNull();
  });
});
