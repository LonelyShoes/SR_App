import { AppState } from 'react-native';
import { create } from 'zustand';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { getSetting, setSetting } from '../settings/repository';
import { reconcileMeetingReminders } from '../../notifications/scheduler';
import { Cursors, markAllDirty, syncAll } from './engine';
import { SYNC_TABLE_NAMES } from './tables';
import { expoExecutor, getSupabase, isSyncConfigured, supabaseRemote } from './supabase';

export type SyncStatus = 'unconfigured' | 'signed-out' | 'idle' | 'syncing' | 'error' | 'offline';

type SyncState = {
  status: SyncStatus;
  email: string | null;
  lastSyncedAt: number | null;
  error: string | null;
};

export const useSyncStore = create<SyncState>(() => ({
  status: isSyncConfigured ? 'signed-out' : 'unconfigured',
  email: null,
  lastSyncedAt: null,
  error: null,
}));

const setState = useSyncStore.setState;

const DEBOUNCE_MS = 5000;
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 5 * 60 * 1000;

let running: Promise<void> | null = null;
let pending = false;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const isNetworkError = (e: unknown) =>
  e instanceof TypeError || /network|fetch|timed? ?out|offline/i.test(e instanceof Error ? e.message : String(e));

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);

/**
 * One full pull+push cycle. Safe to call from the background task.
 * Throws on failure; never deletes local data.
 */
export const runSync = async (): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) {
    setState({ status: 'unconfigured' });
    return;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    setState({ status: 'signed-out', email: null });
    return;
  }
  const userId = session.user.id;
  // Device must be linked to this account first (see linkAccount)
  if ((await getSetting('sync_user_id')) !== userId) return;

  setState({ status: 'syncing', email: session.user.email ?? null, error: null });
  const cursors: Cursors = JSON.parse((await getSetting('sync_cursors')) ?? '{}');
  const result = await syncAll(expoExecutor, supabaseRemote(supabase, userId), userId, cursors);

  const now = Date.now();
  await setSetting('sync_cursors', JSON.stringify(result.cursors));
  await setSetting('last_synced_at', String(now));
  if (result.changedTables.has('meetings')) {
    // Meetings changed on another device: reschedule H-30 reminders
    await reconcileMeetingReminders();
  }
  setState({ status: 'idle', lastSyncedAt: now });
};

/** Run a sync now; concurrent calls coalesce into one follow-up run. Retries with backoff. */
export const syncNow = (): Promise<void> => {
  if (running) {
    pending = true;
    return running;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  running = runSync()
    .then(() => {
      retryCount = 0;
    })
    .catch((e) => {
      const offline = isNetworkError(e);
      setState({ status: offline ? 'offline' : 'error', error: offline ? null : errorMessage(e) });
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** retryCount++);
      retryTimer = setTimeout(syncNow, delay);
    })
    .finally(() => {
      running = null;
      if (pending) {
        pending = false;
        syncNow();
      }
    });
  return running;
};

const scheduleSync = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(syncNow, DEBOUNCE_MS);
};

/**
 * Wire up sync triggers: app open/foreground, data changes (debounced 5 s),
 * and auth changes. Returns a cleanup function.
 */
export const startSyncService = (hooks: { onSignedIn?: () => void; onSignedOut?: () => void } = {}) => {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  getSetting('last_synced_at').then((v) => setState({ lastSyncedAt: v ? Number(v) : null }));

  const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
    setState({ email: session?.user.email ?? null, status: session ? 'idle' : 'signed-out' });
    // Don't call supabase from inside this callback (can deadlock); defer
    if (session) {
      setTimeout(syncNow, 0);
      hooks.onSignedIn?.();
    } else {
      hooks.onSignedOut?.();
    }
  });

  // Supabase recommends driving token refresh from AppState on React Native
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
      syncNow();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
  supabase.auth.startAutoRefresh();

  const dbListener = addDatabaseChangeListener(({ tableName }) => {
    if (SYNC_TABLE_NAMES.has(tableName)) scheduleSync();
  });

  syncNow();

  return () => {
    authListener.subscription.unsubscribe();
    appState.remove();
    dbListener.remove();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (retryTimer) clearTimeout(retryTimer);
  };
};

// ---- Account ----

export type AuthResult = { error?: string; needsConfirmation?: boolean; userId?: string };

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Email atau kata sandi salah.',
  email_not_confirmed: 'Email belum dikonfirmasi. Buka tautan di email pendaftaran.',
  user_already_exists: 'Email ini sudah terdaftar. Silakan masuk.',
  weak_password: 'Kata sandi terlalu lemah (minimal 6 karakter).',
  over_email_send_rate_limit: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
};

const authError = (e: { code?: string; message: string }) =>
  (e.code && AUTH_ERRORS[e.code]) || (isNetworkError(e) ? 'Tidak ada koneksi internet.' : e.message);

export const signIn = async (email: string, password: string): Promise<AuthResult> => {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase belum dikonfigurasi.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { error: authError(error) };
  return { userId: data.user.id };
};

export const signUp = async (email: string, password: string): Promise<AuthResult> => {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase belum dikonfigurasi.' };
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { error: authError(error) };
  // With "Confirm email" on, there is no session until the link is opened
  if (!data.session) return { needsConfirmation: true };
  return { userId: data.user!.id };
};

/** Whether this device's data was last synced with a different account. */
export const isLinkedToOtherAccount = async (userId: string) => {
  const linked = await getSetting('sync_user_id');
  return linked !== null && linked !== userId;
};

/**
 * Link this device to the signed-in account. When switching accounts, all
 * local rows are re-uploaded to the new account (the user confirms first).
 */
export const linkAccount = async (userId: string) => {
  const previous = await getSetting('sync_user_id');
  if (previous !== userId) {
    if (previous !== null) await markAllDirty(expoExecutor);
    await setSetting('sync_cursors', '{}');
    await setSetting('sync_user_id', userId);
  }
  await syncNow();
};

/** Sign out; local data stays on the device. */
export const signOut = async () => {
  await getSupabase()?.auth.signOut();
  setState({ status: 'signed-out', email: null, error: null });
};
