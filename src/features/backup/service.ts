import { create } from 'zustand';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { getSetting, setSetting } from '../settings/repository';
import { reconcileMeetingReminders } from '../../notifications/scheduler';
import { expoExecutor, getSupabase } from '../sync/supabase';
import { syncNow } from '../sync/service';
import { Snapshot, backupFileName, backupsToPrune, createSnapshot, parseSnapshot, restoreSnapshot } from './snapshot';

const BUCKET = 'backups';
const KEEP = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type BackupState = { lastBackupAt: number | null; autoEnabled: boolean };

export const useBackupStore = create<BackupState>(() => ({ lastBackupAt: null, autoEnabled: true }));

export const loadBackupSettings = async () => {
  const [last, auto] = await Promise.all([getSetting('last_backup_at'), getSetting('auto_backup_enabled')]);
  useBackupStore.setState({ lastBackupAt: last ? Number(last) : null, autoEnabled: auto !== 'false' });
};

export const setAutoBackupEnabled = async (enabled: boolean) => {
  useBackupStore.setState({ autoEnabled: enabled });
  await setSetting('auto_backup_enabled', String(enabled));
};

// ---- Cloud (Supabase Storage, private bucket, folder per user) ----

/** Signed-in user linked to this device, or null when cloud backup is unavailable. */
const cloudUser = async () => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || (await getSetting('sync_user_id')) !== session.user.id) return null;
  return { supabase, userId: session.user.id };
};

export type CloudBackup = { name: string; path: string; createdAt: number; size: number | null };

export const listCloudBackups = async (): Promise<CloudBackup[]> => {
  const cloud = await cloudUser();
  if (!cloud) return [];
  const { data, error } = await cloud.supabase.storage
    .from(BUCKET)
    .list(cloud.userId, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
  if (error) throw error;
  return (data ?? [])
    .filter((f) => f.name.endsWith('.json'))
    .map((f) => ({
      name: f.name,
      path: `${cloud.userId}/${f.name}`,
      createdAt: Date.parse(f.created_at ?? '') || 0,
      size: (f.metadata?.size as number | undefined) ?? null,
    }));
};

/** Upload a snapshot and keep only the newest 7. Returns false when not signed in. */
export const backupToCloud = async (snapshot?: Snapshot): Promise<boolean> => {
  const cloud = await cloudUser();
  if (!cloud) return false;
  const snap = snapshot ?? (await createSnapshot(expoExecutor));
  const name = backupFileName(snap.created_at);

  const { error } = await cloud.supabase.storage
    .from(BUCKET)
    .upload(`${cloud.userId}/${name}`, JSON.stringify(snap), { contentType: 'application/json', upsert: true });
  if (error) throw error;

  const existing = await listCloudBackups();
  const prune = backupsToPrune(
    existing.map((b) => b.name),
    KEEP,
  );
  if (prune.length > 0) {
    await cloud.supabase.storage.from(BUCKET).remove(prune.map((n) => `${cloud.userId}/${n}`));
  }

  await setSetting('last_backup_at', String(snap.created_at));
  useBackupStore.setState({ lastBackupAt: snap.created_at });
  return true;
};

export const downloadCloudBackup = async (path: string): Promise<Snapshot> => {
  const cloud = await cloudUser();
  if (!cloud) throw new Error('Masuk ke akun dulu untuk memakai backup cloud.');
  // Blob.text() is not available on React Native, so fetch through a signed URL
  const { data, error } = await cloud.supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  const response = await fetch(data.signedUrl);
  if (!response.ok) throw new Error(`Gagal mengunduh backup (${response.status}).`);
  return parseSnapshot(await response.json());
};

/**
 * Daily automatic backup: runs when enabled, signed in, and the last backup is
 * older than 24 h. Called when the app opens and from the background task.
 */
export const runAutoBackupIfDue = async (now: number = Date.now()) => {
  if ((await getSetting('auto_backup_enabled')) === 'false') return;
  const last = Number(await getSetting('last_backup_at')) || 0;
  if (now - last < DAY_MS) return;
  await backupToCloud();
};

// ---- Local file export / import ----

export const exportBackupFile = async () => {
  const snap = await createSnapshot(expoExecutor);
  const file = new File(Paths.cache, `sr-app-backup-${backupFileName(snap.created_at)}`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(snap, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Simpan backup SR App' });
};

/** Pick a backup JSON file. Returns null if the user cancels. */
export const pickBackupFile = async (): Promise<Snapshot | null> => {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const text = await new File(result.assets[0].uri).text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('File bukan backup SR App yang valid.');
  }
  return parseSnapshot(json);
};

// ---- Restore ----

/** Keep a copy of the current data on the device before overwriting it (last 7). */
const saveLocalSafetyCopy = async (snap: Snapshot) => {
  const dir = new Directory(Paths.document, 'backups');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, `sebelum-pulihkan-${backupFileName(snap.created_at)}`);
  file.create();
  file.write(JSON.stringify(snap));

  const names = dir
    .list()
    .filter((f): f is File => f instanceof File)
    .map((f) => f.name);
  for (const name of backupsToPrune(names, KEEP)) new File(dir, name).delete();
};

/**
 * Replace local data with `snapshot`. A backup of the current data is made
 * first (on the device, and in the cloud when signed in). Afterwards meeting
 * reminders are rescheduled and the restored data is synced.
 */
export const restoreBackup = async (snapshot: Snapshot) => {
  const current = await createSnapshot(expoExecutor);
  await saveLocalSafetyCopy(current);
  try {
    await backupToCloud(current);
  } catch (e) {
    console.warn('Pre-restore cloud backup failed (local copy kept):', e);
  }

  const restored = await restoreSnapshot(expoExecutor, snapshot);
  await reconcileMeetingReminders();
  syncNow();
  return restored;
};
