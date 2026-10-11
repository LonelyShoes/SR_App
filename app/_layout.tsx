import { Stack, router } from 'expo-router';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '../src/db/client';
import migrations from '../src/db/migrations/migrations';
import { ActivityIndicator, View, Text } from 'react-native';
import { useEffect } from 'react';
import { seedPresets } from '../src/db/seed';
import { setupNotificationChannels, setupNotificationHandler } from '../src/notifications/channels';
import { reconcileMeetingReminders } from '../src/notifications/scheduler';
import * as Notifications from 'expo-notifications';
import { startWidgetAutoUpdate } from '../src/widgets/update';

// Configure notification handler at module level (before any component renders)
setupNotificationHandler();

export default function Layout() {
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (success) {
      seedPresets(db);
      // Set up notification channels after DB is ready
      setupNotificationChannels();
      // Reconcile meeting reminders on app startup
      reconcileMeetingReminders();
      // Keep the home-screen Dashboard widget in sync with task/meeting changes
      return startWidgetAutoUpdate();
    }
  }, [success]);

  // Handle notification tap → deep link
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string') {
        router.push(url as any);
      }
    });

    return () => subscription.remove();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error loading DB: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pengaturan" options={{ headerShown: true, title: 'Pengaturan' }} />
        <Stack.Screen name="notula/[id]" options={{ headerShown: true, title: 'Notula' }} />
        <Stack.Screen
          name="modals/quick-plan"
          options={{ headerShown: true, title: 'Quick Plan', presentation: 'modal' }}
        />
        <Stack.Screen name="statistik" options={{ headerShown: true, title: 'Statistik' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
