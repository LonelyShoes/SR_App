import { Platform } from 'react-native';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { renderWidgetByName, WIDGET_NAMES } from './widget-task-handler';

const WATCHED_TABLES = new Set(['tasks', 'meetings']);
const DEBOUNCE_MS = 1000;

export const refreshDashboardWidget = async () => {
  if (Platform.OS !== 'android') return;
  try {
    await requestWidgetUpdate({
      widgetName: WIDGET_NAMES.dashboard,
      renderWidget: async () => (await renderWidgetByName(WIDGET_NAMES.dashboard))!,
    });
  } catch (e) {
    console.warn('Widget: refresh failed', e);
  }
};

/**
 * Refresh the Dashboard widget whenever tasks or meetings change (debounced),
 * on top of the periodic refresh Android does every 30 minutes.
 * Returns an unsubscribe function.
 */
export const startWidgetAutoUpdate = () => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const subscription = addDatabaseChangeListener(({ tableName }) => {
    if (!WATCHED_TABLES.has(tableName)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(refreshDashboardWidget, DEBOUNCE_MS);
  });
  refreshDashboardWidget();

  return () => {
    if (timer) clearTimeout(timer);
    subscription.remove();
  };
};
