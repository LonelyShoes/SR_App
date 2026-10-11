/**
 * Local-first sync engine (spec section 7). Platform-free: it talks to SQLite
 * through `SqlExecutor` and to the server through `SyncRemote`, so the same
 * code runs in the app (expo-sqlite + Supabase) and in tests (node:sqlite + fake).
 *
 * - Pull first, then push, so local rows that lost to a newer remote edit are
 *   replaced before we try to upload them.
 * - Conflicts: last-write-wins per row on `updated_at` (device clock), enforced
 *   both locally (here) and on the server (trigger in supabase/migrations).
 * - Pull cursor: (server_updated_at, id), the server clock, so rows from a
 *   device whose clock lags are never skipped.
 * - Network errors throw; local data is never deleted.
 */
import { SYNC_TABLES, SyncTable } from './tables';

export type SqlParam = string | number | null;

export interface SqlExecutor {
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  run(sql: string, params?: SqlParam[]): Promise<{ changes: number }>;
}

export type RemoteRow = Record<string, unknown> & { id: string; updated_at: number; server_updated_at?: string };

export type Cursor = { at: string; id: string };

export interface SyncRemote {
  /** Upsert rows; returns what the server stored (it may keep a newer version). */
  push(table: string, rows: RemoteRow[]): Promise<RemoteRow[]>;
  /** Rows after `cursor`, ordered by (server_updated_at, id). */
  pull(table: string, cursor: Cursor | null, limit: number): Promise<RemoteRow[]>;
}

export type Cursors = Record<string, Cursor>;

export type SyncResult = {
  cursors: Cursors;
  pulled: number;
  pushed: number;
  /** Tables whose local rows changed because of remote data */
  changedTables: Set<string>;
};

export const PAGE_SIZE = 500;

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

const toRemote = (table: SyncTable, row: Record<string, SqlParam>, userId: string): RemoteRow => {
  const out: Record<string, unknown> = { user_id: userId };
  for (const col of table.columns) {
    const value = row[col];
    out[col] = table.json.includes(col) && typeof value === 'string' ? JSON.parse(value) : value;
  }
  return out as RemoteRow;
};

const toLocalParams = (table: SyncTable, row: RemoteRow): SqlParam[] =>
  table.columns.map((col) => {
    const value = row[col];
    if (value === undefined || value === null) return null;
    if (table.json.includes(col)) return JSON.stringify(value);
    return value as SqlParam;
  });

/**
 * Write a remote row locally if it is newer than what we have (LWW).
 * Returns true when the local row changed.
 */
export const applyRemoteRow = async (db: SqlExecutor, table: SyncTable, row: RemoteRow): Promise<boolean> => {
  const cols = table.columns;
  const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
  const { changes } = await db.run(
    `INSERT INTO ${table.name} (${cols.join(', ')}, dirty) VALUES (${placeholders(cols.length)}, 0)
     ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}, dirty = 0
     WHERE excluded.updated_at > ${table.name}.updated_at`,
    toLocalParams(table, row),
  );
  return changes > 0;
};

export const pullTable = async (
  db: SqlExecutor,
  remote: SyncRemote,
  table: SyncTable,
  cursor: Cursor | null,
): Promise<{ cursor: Cursor | null; pulled: number; changed: number }> => {
  let pulled = 0;
  let changed = 0;
  for (;;) {
    const page = await remote.pull(table.name, cursor, PAGE_SIZE);
    for (const row of page) {
      if (await applyRemoteRow(db, table, row)) changed++;
    }
    pulled += page.length;
    if (page.length > 0) {
      const last = page[page.length - 1];
      cursor = { at: String(last.server_updated_at), id: last.id };
    }
    if (page.length < PAGE_SIZE) return { cursor, pulled, changed };
  }
};

export const pushTable = async (
  db: SqlExecutor,
  remote: SyncRemote,
  table: SyncTable,
  userId: string,
): Promise<{ pushed: number; changed: number }> => {
  let pushed = 0;
  let changed = 0;
  let afterId = '';
  for (;;) {
    // Walk by id so rows that stay dirty (edited mid-push) don't loop forever
    const rows = await db.all<Record<string, SqlParam>>(
      `SELECT ${table.columns.join(', ')} FROM ${table.name}
       WHERE dirty = 1 AND id > ? ORDER BY id LIMIT ${PAGE_SIZE}`,
      [afterId],
    );
    if (rows.length === 0) return { pushed, changed };

    const sent = rows.map((r) => toRemote(table, r, userId));
    const stored = await remote.push(table.name, sent);
    const storedById = new Map(stored.map((r) => [r.id, r]));

    for (const row of sent) {
      const serverRow = storedById.get(row.id);
      if (serverRow && serverRow.updated_at > row.updated_at) {
        // Server kept a newer edit from another device: take it
        if (await applyRemoteRow(db, table, serverRow)) changed++;
      } else if (serverRow) {
        // Only clear if not edited again while we were pushing
        await db.run(`UPDATE ${table.name} SET dirty = 0 WHERE id = ? AND updated_at = ?`, [row.id, row.updated_at]);
      }
    }
    pushed += rows.length;
    afterId = String(rows[rows.length - 1].id);
    if (rows.length < PAGE_SIZE) return { pushed, changed };
  }
};

export const syncAll = async (
  db: SqlExecutor,
  remote: SyncRemote,
  userId: string,
  cursors: Cursors,
  tables: SyncTable[] = SYNC_TABLES,
): Promise<SyncResult> => {
  const next: Cursors = { ...cursors };
  const changedTables = new Set<string>();
  let pulled = 0;
  let pushed = 0;

  for (const table of tables) {
    const res = await pullTable(db, remote, table, next[table.name] ?? null);
    if (res.cursor) next[table.name] = res.cursor;
    pulled += res.pulled;
    if (res.changed > 0) changedTables.add(table.name);
  }
  for (const table of tables) {
    const res = await pushTable(db, remote, table, userId);
    pushed += res.pushed;
    if (res.changed > 0) changedTables.add(table.name);
  }
  return { cursors: next, pulled, pushed, changedTables };
};

/** Mark every synced row dirty, e.g. to upload this device's data to a newly linked account. */
export const markAllDirty = async (db: SqlExecutor, tables: SyncTable[] = SYNC_TABLES) => {
  for (const table of tables) {
    await db.run(`UPDATE ${table.name} SET dirty = 1`);
  }
};
