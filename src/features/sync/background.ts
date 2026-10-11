import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { runSync } from './service';

const SYNC_TASK = 'sr-app-background-sync';
// Android/WorkManager runs it at most this often (minutes), best effort
const INTERVAL_MIN = 60;

// Must run at module scope (imported from index.ts), before the app renders
TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    await runSync();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.warn('Background sync failed', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export const registerBackgroundSync = async () => {
  if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) return;
  await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: INTERVAL_MIN });
};

export const unregisterBackgroundSync = async () => {
  if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) {
    await BackgroundTask.unregisterTaskAsync(SYNC_TASK);
  }
};
