import { Tabs, Link } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Text, TouchableOpacity, View } from 'react-native';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home',
          headerRight: () => (
            <View style={{ flexDirection: 'row', marginRight: 16, gap: 16 }}>
              <Link href="/statistik" asChild>
                <TouchableOpacity accessibilityLabel="Statistik">
                  <Text style={{ fontSize: 20 }}>📊</Text>
                </TouchableOpacity>
              </Link>
              <Link href="/pengaturan" asChild>
                <TouchableOpacity accessibilityLabel="Pengaturan">
                  <Text style={{ fontSize: 20 }}>⚙️</Text>
                </TouchableOpacity>
              </Link>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="matrix" options={{ title: 'Matrix 4Q', tabBarLabel: 'Matrix' }} />
      <Tabs.Screen
        name="notula"
        options={{
          title: 'Notula',
          tabBarLabel: 'Notula',
          headerRight: () => (
            <Link href="/modals/quick-plan" asChild>
              <TouchableOpacity style={{ marginRight: 16 }} accessibilityLabel="Quick Plan suara">
                <Text style={{ fontSize: 20 }}>🎤</Text>
              </TouchableOpacity>
            </Link>
          ),
        }}
      />
      <Tabs.Screen name="timer" options={{ title: 'Timer', tabBarLabel: 'Timer' }} />
    </Tabs>
  );
}
