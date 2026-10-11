/**
 * Backup snapshots (spec section 8). Platform-free like the sync engine: runs
 * against any `SqlExecutor`, so tests use node:sqlite with the real schema.
 */
import { z } from 'zod';
import type { SqlExecutor, SqlParam } from '../sync/engine';
import { SYNC_TABLES, SyncTable } from '../sync/tables';

/** Bump when the snapshot shape changes, and add a step to MIGRATIONS. */
export const BACKUP_SCHEMA_VERSION = 1;

type Row = Record<string, unknown>;

export type Snapshot = {
  schema_version: number;
  app: 'sr-app';
  created_at: number;
  tables: Record<string, Row[]>;
};

const snapshotSchema = z.object({
  schema_version: z.number().int().positive(),
  app: z.literal('sr-app'),
  created_at: z.number(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

/**
 * Upgrade steps from older backups: MIGRATIONS[n] turns version n into n + 1.
 * Version 1 is the first format, so there are none yet.
 */
const MIGRATIONS: Record<number, (s: Snapshot) => Snapshot> = {};

/** Validate and upgrade a parsed backup file. Throws a readable error if invalid. */
export const parseSnapshot = (input: unknown): Snapshot => {
  const result = snapshotSchema.safeParse(input);
  if (!result.success) throw new Error('File bukan backup SR App yang valid.');
  let snapshot = result.data as Snapshot;
  if (snapshot.schema_version > BACKUP_SCHEMA_VERSION) {
    throw new Error('Backup dibuat oleh versi app yang lebih baru. Perbarui app dulu.');
  }
  while (snapshot.schema_version < BACKUP_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[snapshot.schema_version];
    if (!migrate) throw new Error(`Versi backup ${snapshot.schema_version} tidak didukung.`);
    snapshot = migrate(snapshot);
  }
  return snapshot;
};

/** Whole user data (synced tables; no device settings or local-only columns). */
export const createSnapshot = async (db: SqlExecutor, now: number = Date.now()): Promise<Snapshot> => {
  const tables: Record<string, Row[]> = {};
  for (const table of SYNC_TABLES) {
    const rows = await db.all<Record<string, SqlParam>>(`SELECT ${table.columns.join(', ')} FROM ${table.name}`);
    tables[table.name] = rows.map((row) => {
      const out: Row = { ...row };
      for (const col of table.json) {
        if (typeof out[col] === 'string') out[col] = JSON.parse(out[col] as string);
      }
      return out;
    });
  }
  return { schema_version: BACKUP_SCHEMA_VERSION, app: 'sr-app', created_at: now, tables };
};

const toParams = (table: SyncTable, row: Row): SqlParam[] =>
  table.columns.map((col) => {
    const value = row[col];
    if (value === undefined || value === null) return null;
    if (table.json.includes(col)) return JSON.stringify(value);
    return value as SqlParam;
  });

/**
 * Replace local data with the snapshot so that it also wins over the cloud:
 * - snapshot rows are written with updated_at = now and dirty = 1 (newer than
 *   any server copy, so sync pushes them instead of pulling old ones back);
 * - local rows missing from the snapshot are soft-deleted the same way, so the
 *   deletion syncs too. Nothing is hard-deleted.
 * Returns the number of restored rows.
 */
export const restoreSnapshot = async (db: SqlExecutor, snapshot: Snapshot, now: number = Date.now()) => {
  let restored = 0;
  await db.run('BEGIN');
  try {
    for (const table of SYNC_TABLES) {
      const rows = snapshot.tables[table.name] ?? [];
      const cols = table.columns;
      const updates = cols.filter((c) => c !== 'id' && c !== 'updated_at').map((c) => `${c} = excluded.${c}`);
      for (const row of rows) {
        await db.run(
          `INSERT INTO ${table.name} (${cols.join(', ')}, dirty) VALUES (${cols.map(() => '?').join(', ')}, 1)
           ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}, updated_at = excluded.updated_at, dirty = 1`,
          toParams(table, { ...row, updated_at: now }),
        );
      }
      await db.run(
        `UPDATE ${table.name} SET deleted_at = ?, updated_at = ?, dirty = 1
         WHERE deleted_at IS NULL AND id NOT IN (SELECT value FROM json_each(?))`,
        [now, now, JSON.stringify(rows.map((r) => String(r.id)))],
      );
      restored += rows.length;
    }
    await db.run('COMMIT');
  } catch (e) {
    await db.run('ROLLBACK');
    throw e;
  }
  return restored;
};

/** Cloud retention: names (timestamps, sortable) to delete beyond the newest `keep`. */
export const backupsToPrune = (names: string[], keep = 7) => [...names].sort().reverse().slice(keep);

/** Sortable, filename-safe timestamp, e.g. 2026-10-11T08-30-00-000Z.json */
export const backupFileName = (createdAt: number) => `${new Date(createdAt).toISOString().replace(/[:.]/g, '-')}.json`;
