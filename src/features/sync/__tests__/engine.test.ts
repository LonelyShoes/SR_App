/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, test } from '@jest/globals';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseSync } from 'node:sqlite';
import {
  Cursor,
  Cursors,
  PAGE_SIZE,
  RemoteRow,
  SqlExecutor,
  SqlParam,
  SyncRemote,
  markAllDirty,
  pullTable,
  pushTable,
  syncAll,
} from '../engine';
import { SYNC_TABLES } from '../tables';

const USER = '00000000-0000-0000-0000-000000000001';
const MIGRATIONS_DIR = join(__dirname, '../../../db/migrations');
const table = (name: string) => SYNC_TABLES.find((t) => t.name === name)!;

/** A device: real SQLite schema from the Drizzle migrations. */
const createDevice = (): SqlExecutor & { raw: DatabaseSync } => {
  const raw = new DatabaseSync(':memory:');
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    for (const statement of readFileSync(join(MIGRATIONS_DIR, file), 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) raw.exec(statement);
    }
  }
  return {
    raw,
    all: async <T>(sql: string, params: SqlParam[] = []) => raw.prepare(sql).all(...params) as T[],
    run: async (sql: string, params: SqlParam[] = []) => ({ changes: Number(raw.prepare(sql).run(...params).changes) }),
  };
};

/** In-memory server mimicking the Postgres trigger (LWW guard + server_updated_at). */
class FakeServer implements SyncRemote {
  tables = new Map<string, Map<string, RemoteRow>>();
  private clock = 0;
  pushCalls = 0;

  private store(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }

  // Zero-padded so string order == time order, like ISO timestamps
  private tick = () => String(++this.clock).padStart(10, '0');

  async push(name: string, rows: RemoteRow[]) {
    this.pushCalls++;
    const store = this.store(name);
    return rows.map((row) => {
      const existing = store.get(row.id);
      if (existing && row.updated_at < existing.updated_at) return existing;
      const saved = { ...row, server_updated_at: this.tick() };
      store.set(row.id, saved);
      return saved;
    });
  }

  async pull(name: string, cursor: Cursor | null, limit: number) {
    return [...this.store(name).values()]
      .filter(
        (r) => !cursor || r.server_updated_at! > cursor.at || (r.server_updated_at === cursor.at && r.id > cursor.id),
      )
      .sort((a, b) => a.server_updated_at!.localeCompare(b.server_updated_at!) || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  /** Simulate another device writing directly to the server */
  write(name: string, row: Record<string, unknown>) {
    this.store(name).set(String(row.id), { ...(row as RemoteRow), server_updated_at: this.tick() });
  }
}

const insertTask = (
  db: ReturnType<typeof createDevice>,
  id: string,
  updatedAt: number,
  extra: Record<string, SqlParam> = {},
) => {
  const row = {
    id,
    title: `Tugas ${id}`,
    quadrant: 'Q1',
    status: 'todo',
    source: 'manual',
    created_at: 1,
    updated_at: updatedAt,
    dirty: 1,
    ...extra,
  };
  const cols = Object.keys(row);
  db.raw
    .prepare(`INSERT INTO tasks (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...(Object.values(row) as SqlParam[]));
};

const getTask = (db: ReturnType<typeof createDevice>, id: string) =>
  db.raw.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, SqlParam> | undefined;

const remoteTask = (id: string, updatedAt: number, extra: Record<string, unknown> = {}) => ({
  user_id: USER,
  id,
  title: `Remote ${id}`,
  notes: null,
  quadrant: 'Q2',
  due_at: null,
  status: 'todo',
  completed_at: null,
  source: 'manual',
  meeting_id: null,
  created_at: 1,
  updated_at: updatedAt,
  deleted_at: null,
  ...extra,
});

let device: ReturnType<typeof createDevice>;
let server: FakeServer;

beforeEach(() => {
  device = createDevice();
  server = new FakeServer();
});

describe('push', () => {
  test('mengirim baris dirty dengan user_id lalu menandainya bersih', async () => {
    insertTask(device, 'a', 100);
    insertTask(device, 'b', 100, { dirty: 0 });
    const res = await pushTable(device, server, table('tasks'), USER);

    expect(res.pushed).toBe(1);
    expect(server.tables.get('tasks')!.get('a')).toMatchObject({ user_id: USER, title: 'Tugas a', updated_at: 100 });
    expect(server.tables.get('tasks')!.has('b')).toBe(false);
    expect(getTask(device, 'a')!.dirty).toBe(0);
  });

  test('kolom JSON dikirim sebagai objek dan kolom lokal-saja tidak ikut', async () => {
    device.raw
      .prepare(
        `INSERT INTO meetings (id, title, start_at, end_at, participants, status, source, reminder_notification_id, created_at, updated_at, dirty)
         VALUES ('m1', 'Rapat', 1, 2, '["Ani","Budi"]', 'rencana', 'manual', 'notif-123', 1, 100, 1)`,
      )
      .run();
    await pushTable(device, server, table('meetings'), USER);
    const sent = server.tables.get('meetings')!.get('m1')!;
    expect(sent.participants).toEqual(['Ani', 'Budi']);
    expect(sent).not.toHaveProperty('reminder_notification_id');
    expect(sent).not.toHaveProperty('dirty');
  });

  test('baris yang diedit selama push tetap dirty', async () => {
    insertTask(device, 'a', 100);
    const slowServer: SyncRemote = {
      pull: server.pull.bind(server),
      push: async (name, rows) => {
        // User edits the row while the request is in flight
        device.raw.prepare('UPDATE tasks SET title = ?, updated_at = 200, dirty = 1 WHERE id = ?').run('Baru', 'a');
        return server.push(name, rows);
      },
    };
    await pushTable(device, slowServer, table('tasks'), USER);
    expect(getTask(device, 'a')).toMatchObject({ title: 'Baru', dirty: 1 });
  });

  test('server menolak versi lama: lokal mengambil versi server', async () => {
    server.write('tasks', remoteTask('a', 300, { title: 'Dari HP lain' }));
    insertTask(device, 'a', 100, { title: 'Versi lama' });
    const res = await pushTable(device, server, table('tasks'), USER);

    expect(res.changed).toBe(1);
    expect(getTask(device, 'a')).toMatchObject({ title: 'Dari HP lain', updated_at: 300, dirty: 0 });
    expect(server.tables.get('tasks')!.get('a')!.title).toBe('Dari HP lain');
  });

  test('push dalam beberapa halaman', async () => {
    for (let i = 0; i < PAGE_SIZE + 3; i++) insertTask(device, `t${String(i).padStart(4, '0')}`, 100);
    const res = await pushTable(device, server, table('tasks'), USER);
    expect(res.pushed).toBe(PAGE_SIZE + 3);
    expect(server.pushCalls).toBe(2);
    expect(device.raw.prepare('SELECT COUNT(*) AS n FROM tasks WHERE dirty = 1').get()).toEqual({ n: 0 });
  });
});

describe('pull', () => {
  test('menyisipkan baris baru sebagai bersih dan memajukan kursor', async () => {
    server.write('tasks', remoteTask('a', 100));
    server.write('tasks', remoteTask('b', 100));
    const res = await pullTable(device, server, table('tasks'), null);

    expect(res.pulled).toBe(2);
    expect(getTask(device, 'a')).toMatchObject({ title: 'Remote a', dirty: 0 });
    expect(res.cursor).toEqual({ at: '0000000002', id: 'b' });

    const again = await pullTable(device, server, table('tasks'), res.cursor);
    expect(again.pulled).toBe(0);
  });

  test('konflik: versi lokal lebih baru tetap dipakai dan tetap dirty', async () => {
    insertTask(device, 'a', 500, { title: 'Lokal baru' });
    server.write('tasks', remoteTask('a', 400, { title: 'Remote lama' }));
    await pullTable(device, server, table('tasks'), null);
    expect(getTask(device, 'a')).toMatchObject({ title: 'Lokal baru', dirty: 1 });
  });

  test('konflik: versi remote lebih baru menimpa lokal', async () => {
    insertTask(device, 'a', 400, { title: 'Lokal lama' });
    server.write('tasks', remoteTask('a', 500, { title: 'Remote baru' }));
    await pullTable(device, server, table('tasks'), null);
    expect(getTask(device, 'a')).toMatchObject({ title: 'Remote baru', updated_at: 500, dirty: 0 });
  });

  test('soft delete dari server ikut tersinkron', async () => {
    insertTask(device, 'a', 100, { dirty: 0 });
    server.write('tasks', remoteTask('a', 200, { deleted_at: 200 }));
    await pullTable(device, server, table('tasks'), null);
    expect(getTask(device, 'a')!.deleted_at).toBe(200);
  });

  test('kolom JSON disimpan sebagai teks dan reminder_notification_id lokal tidak tertimpa', async () => {
    device.raw
      .prepare(
        `INSERT INTO meetings (id, title, start_at, end_at, status, source, reminder_notification_id, created_at, updated_at, dirty)
         VALUES ('m1', 'Lama', 1, 2, 'rencana', 'manual', 'notif-123', 1, 100, 0)`,
      )
      .run();
    server.write('meetings', {
      user_id: USER,
      id: 'm1',
      title: 'Baru',
      start_at: 1,
      end_at: 2,
      location: null,
      participants: ['Ani'],
      agenda: null,
      status: 'terkonfirmasi',
      source: 'manual',
      reminder_offset_min: null,
      created_at: 1,
      updated_at: 200,
      deleted_at: null,
    });
    await pullTable(device, server, table('meetings'), null);
    const row = device.raw.prepare('SELECT * FROM meetings WHERE id = ?').get('m1') as Record<string, SqlParam>;
    expect(row).toMatchObject({ title: 'Baru', participants: '["Ani"]', reminder_notification_id: 'notif-123' });
  });

  test('paginasi dengan server_updated_at kembar tidak melewatkan baris', async () => {
    // Several rows sharing one server timestamp across a page boundary
    const store = new Map<string, RemoteRow>();
    for (let i = 0; i < PAGE_SIZE + 2; i++) {
      const id = `t${String(i).padStart(4, '0')}`;
      store.set(id, { ...remoteTask(id, 100), server_updated_at: '0000000001' } as RemoteRow);
    }
    server.tables.set('tasks', store);
    const res = await pullTable(device, server, table('tasks'), null);
    expect(res.pulled).toBe(PAGE_SIZE + 2);
    expect(device.raw.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: PAGE_SIZE + 2 });
  });
});

describe('syncAll', () => {
  test('dua perangkat menyatu ke data yang sama', async () => {
    const phone = createDevice();
    const tablet = createDevice();
    let phoneCursors: Cursors = {};
    let tabletCursors: Cursors = {};

    insertTask(phone, 'p1', 100, { title: 'Dari HP' });
    insertTask(tablet, 't1', 100, { title: 'Dari tablet' });

    phoneCursors = (await syncAll(phone, server, USER, phoneCursors)).cursors;
    tabletCursors = (await syncAll(tablet, server, USER, tabletCursors)).cursors;
    phoneCursors = (await syncAll(phone, server, USER, phoneCursors)).cursors;

    for (const d of [phone, tablet]) {
      expect(getTask(d, 'p1')).toMatchObject({ title: 'Dari HP', dirty: 0 });
      expect(getTask(d, 't1')).toMatchObject({ title: 'Dari tablet', dirty: 0 });
    }

    // Both edit the same task offline; the later edit (updated_at) wins everywhere
    phone.raw.prepare('UPDATE tasks SET title = ?, updated_at = 300, dirty = 1 WHERE id = ?').run('Edit HP', 'p1');
    tablet.raw.prepare('UPDATE tasks SET title = ?, updated_at = 200, dirty = 1 WHERE id = ?').run('Edit tablet', 'p1');

    await syncAll(phone, server, USER, phoneCursors);
    const tabletResult = await syncAll(tablet, server, USER, tabletCursors);
    expect(tabletResult.changedTables.has('tasks')).toBe(true);

    expect(getTask(phone, 'p1')!.title).toBe('Edit HP');
    expect(getTask(tablet, 'p1')).toMatchObject({ title: 'Edit HP', dirty: 0 });
    expect(server.tables.get('tasks')!.get('p1')!.title).toBe('Edit HP');
  });

  test('melaporkan tabel yang berubah karena data remote (untuk rekonsiliasi notifikasi)', async () => {
    server.write('meetings', {
      user_id: USER,
      id: 'm1',
      title: 'Rapat',
      start_at: 1,
      end_at: 2,
      location: null,
      participants: null,
      agenda: null,
      status: 'rencana',
      source: 'manual',
      reminder_offset_min: null,
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
    });
    const res = await syncAll(device, server, USER, {});
    expect([...res.changedTables]).toEqual(['meetings']);
  });

  test('preset bawaan dengan id tetap tidak terduplikasi antar perangkat', async () => {
    const seed = (d: ReturnType<typeof createDevice>) =>
      d.raw
        .prepare(
          `INSERT INTO timer_presets (id, kind, name, duration_sec, sort_order, created_at, updated_at, dirty)
           VALUES ('default-fokus', 'fokus', 'Fokus', 1500, 1, 0, 0, 0)`,
        )
        .run();
    const a = createDevice();
    const b = createDevice();
    seed(a);
    seed(b);
    a.raw.prepare('UPDATE timer_presets SET duration_sec = 3000, updated_at = 50, dirty = 1').run();

    await syncAll(a, server, USER, {});
    await syncAll(b, server, USER, {});
    expect(b.raw.prepare('SELECT COUNT(*) AS n, MAX(duration_sec) AS d FROM timer_presets').get()).toEqual({
      n: 1,
      d: 3000,
    });
  });

  test('markAllDirty menandai semua baris untuk diunggah ulang', async () => {
    insertTask(device, 'a', 100, { dirty: 0 });
    await markAllDirty(device);
    expect(getTask(device, 'a')!.dirty).toBe(1);
  });
});
