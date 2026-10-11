import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { tokens } from '../theme/tokens';

/**
 * Set up notification channels for Android.
 * Must be called before any notification is scheduled.
 */
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;

  // Timer alarm channel: importance MAX, alarm-like behavior
  await Notifications.setNotificationChannelAsync('timer-alarm', {
    name: 'Timer Alarm',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    enableLights: true,
    lightColor: tokens.colors.light.error,
    // sound will use default alarm sound
  });

  // Meeting reminder channel: importance HIGH, standard notification sound
  await Notifications.setNotificationChannelAsync('meeting-reminder', {
    name: 'Pengingat Rapat',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: true,
    lightColor: tokens.colors.light.primary,
  });
}

/**
 * Request notification permissions from the user.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

/**
 * Configure how notifications are handled when the app is in the foreground.
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
