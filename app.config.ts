import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SR App',
  slug: 'sr-app',
  owner: 'whitesr',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'srapp',
  userInterfaceStyle: 'automatic',
  android: {
    package: 'com.srapp.app',
    // Icons generated from assets/images/sr-logo.jpg (glyph kept inside the adaptive-icon safe zone)
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.RECORD_AUDIO',
    ],
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-sharing',
    'expo-secure-store',
    'expo-background-task',
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            name: 'QuickAction',
            label: 'SR Quick Action',
            description: 'Tugas baru, Quick Plan, dan mulai fokus',
            minWidth: '250dp',
            minHeight: '40dp',
            targetCellWidth: 4,
            targetCellHeight: 1,
            resizeMode: 'horizontal',
          },
          {
            name: 'Dashboard',
            label: 'SR Dashboard',
            description: 'Agenda dan tugas mendesak hari ini',
            minWidth: '250dp',
            minHeight: '110dp',
            targetCellWidth: 4,
            targetCellHeight: 2,
            resizeMode: 'horizontal|vertical',
            // Android minimum; data changes also trigger an immediate refresh
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'Izinkan $(PRODUCT_NAME) memakai mikrofon untuk Quick Plan.',
        speechRecognitionPermission: 'Izinkan $(PRODUCT_NAME) mengenali ucapan untuk Quick Plan.',
        androidSpeechServicePackages: ['com.google.android.googlequicksearchbox', 'com.google.android.tts'],
      },
    ],
    [
      'expo-notifications',
      {
        // Small status-bar icon must be white on transparent
        icon: './assets/images/notification-icon.png',
        color: '#1A6FC9', // tokens.colors.light.primary
      },
    ],
    [
      'expo-splash-screen',
      {
        // Matches tokens background/glyph for light and dark system themes
        backgroundColor: '#FFFFFF',
        image: './assets/images/splash-icon.png',
        imageWidth: 160,
        dark: {
          backgroundColor: '#121212',
          image: './assets/images/splash-icon-dark.png',
        },
      },
    ],
  ],
  extra: {
    ...config.extra,
    eas: {
      projectId: 'c7094549-0b0c-4298-92ba-fa6356668564',
    },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
