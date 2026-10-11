/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, test } from '@jest/globals';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseSync } from 'node:sqlite';
import type { SqlExecutor, SqlParam } from '../../sync/engine';
import {
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  backupsToPrune,
  createSnapshot,
  parseSnapshot,
  restoreSnapshot,
} from '../snapshot';

const MIGRATIONS_DIR = join(__dirname, '../../../db/migrations');

let raw: DatabaseSync;
let db: SqlExecutor;

beforeEach(() => {
  raw = new DatabaseSync(':memory:');
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    for (const statement of readFileSync(join(MIGRATIONS_DIR, file), 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) raw.exec(statement);
    }
  }
  db = {
    all: async <T>(sql: string, params: SqlParam[] = []) => raw.prepare(sql).all(...params) as T[],
    run: async (sql: string, params: SqlParam[] = []) => ({ changes: Number(raw.prepare(sql).run(...params).changes) }),
  };
});

const addTask = (id: string, title: string, extra = '') =>
  raw.exec(
    `INSERT INTO tasks (id, title, quadrant, status, source, created_at, updated_at, dirty${extra ? ', deleted_at' : ''})
     VALUES ('${id}', '${title}', 'Q1', 'todo', 'manual', 1, 10, 0${extra ? `, ${extra}` : ''})`,
  );

const task = (id: string) => raw.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, SqlParam>;

describe('createSnapshot', () => {
  test('berisi schema_version, semua tabel sinkron, dan JSON sebagai objek', async () => {
    addTask('a', 'Satu');
    raw.exec(
      `INSERT INTO meetings (id, title, start_at, end_at, participants, status, source, reminder_notification_id, created_at, updated_at, dirty)
       VALUES ('m1', 'Rapat', 1, 2, '["Ani"]', 'rencana', 'manual', 'notif-1', 1, 10, 0)`,
    );
    raw.exec(`INSERT INTO settings (key, value, updated_at) VALUES ('theme_mode', 'dark', 1)`);

    const snap = await createSnapshot(db, 999);
    expect(snap.schema_version).toBe(BACKUP_SCHEMA_VERSION);
    expect(snap.created_at).toBe(999);
    expect(Object.keys(snap.tables).sort()).toEqual([
      'meetings',
      'minutes',
      'tasks',
      'timer_presets',
      'timer_sessions',
    ]);
    expect(snap.tables.tasks).toHaveLength(1);
    expect(snap.tables.meetings[0].participants).toEqual(['Ani']);
    // Device-only data stays out
    expect(snap.tables.meetings[0]).not.toHaveProperty('reminder_notification_id');
    expect(snap.tables.meetings[0]).not.toHaveProperty('dirty');
    expect(snap).not.toHaveProperty('tables.settings');
  });
});

describe('restoreSnapshot', () => {
  test('memulihkan data, menandai dirty, dan updated_at baru agar menang saat sync', async () => {
    addTask('a', 'Asli');
    const snap = await createSnapshot(db);
    raw.exec(`UPDATE tasks SET title = 'Rusak' WHERE id = 'a'`);

    const restored = await restoreSnapshot(db, snap, 5000);
    expect(restored).toBe(1);
    expect(task('a')).toMatchObject({ title: 'Asli', updated_at: 5000, dirty: 1, deleted_at: null });
  });

  test('baris yang dihapus tidak sengaja kembali', async () => {
    addTask('a', 'Penting');
    const snap = await createSnapshot(db);
    raw.exec(`UPDATE tasks SET deleted_at = 20 WHERE id = 'a'`);
    await restoreSnapshot(db, snap, 5000);
    expect(task('a').deleted_at).toBeNull();
  });

  test('baris yang tidak ada di backup di-soft-delete (bukan dihapus fisik)', async () => {
    addTask('a', 'Lama');
    const snap = await createSnapshot(db);
    addTask('b', 'Dibuat setelah backup');

    await restoreSnapshot(db, snap, 5000);
    expect(task('b')).toMatchObject({ deleted_at: 5000, updated_at: 5000, dirty: 1 });
    expect(raw.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: 2 });
  });

  test('kolom JSON dipulihkan sebagai teks dan reminder_notification_id lokal dibiarkan', async () => {
    raw.exec(
      `INSERT INTO minutes (id, meeting_id, action_items, created_at, updated_at, dirty)
       VALUES ('n1', 'm1', '[{"text":"Kirim laporan","assignee":null,"due_at":null}]', 1, 10, 0)`,
    );
    const snap = await createSnapshot(db);
    raw.exec(`UPDATE minutes SET action_items = '[]' WHERE id = 'n1'`);
    await restoreSnapshot(db, snap, 5000);
    const row = raw.prepare('SELECT action_items FROM minutes WHERE id = ?').get('n1') as { action_items: string };
    expect(JSON.parse(row.action_items)).toEqual([{ text: 'Kirim laporan', assignee: null, due_at: null }]);
  });

  test('restore yang gagal di tengah dibatalkan seluruhnya', async () => {
    addTask('a', 'Asli');
    const snap = await createSnapshot(db);
    snap.tables.tasks.push({ id: 'broken', title: null, quadrant: 'Q1' }); // title NOT NULL → error
    raw.exec(`UPDATE tasks SET title = 'Diubah' WHERE id = 'a'`);

    await expect(restoreSnapshot(db, snap, 5000)).rejects.toThrow();
    expect(task('a').title).toBe('Diubah');
  });
});

describe('parseSnapshot', () => {
  test('menerima backup valid hasil JSON round-trip', async () => {
    addTask('a', 'Satu');
    const snap = await createSnapshot(db);
    expect(parseSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
  });

  test('menolak file yang bukan backup', () => {
    expect(() => parseSnapshot({ hello: 'world' })).toThrow('bukan backup SR App');
  });

  test('menolak backup dari versi app yang lebih baru', () => {
    expect(() =>
      parseSnapshot({ schema_version: BACKUP_SCHEMA_VERSION + 1, app: 'sr-app', created_at: 1, tables: {} }),
    ).toThrow('versi app yang lebih baru');
  });
});

describe('retensi dan nama file', () => {
  test('menyimpan 7 backup terbaru', () => {
    const names = Array.from({ length: 10 }, (_, i) => backupFileName(Date.UTC(2026, 9, i + 1)));
    expect(backupsToPrune(names)).toEqual(names.slice(0, 3).reverse());
  });

  test('nama file bisa diurutkan dan aman untuk path', () => {
    expect(backupFileName(Date.UTC(2026, 9, 11, 8, 30))).toBe('2026-10-11T08-30-00-000Z.json');
  });
});
