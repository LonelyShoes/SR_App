import React from 'react';
import { Tabs, router } from 'expo-router';
import { View, StyleSheet, ColorValue } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens } from '../../src/theme/tokens';
import { Icon, IconName } from '../../src/components/Icon';
import { Tap } from '../../src/components/Tap';

const HeaderAction = ({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.9}
      style={[styles.headerBtn, { backgroundColor: colors.surface }]}
    >
      <Icon name={icon} size={22} color={colors.text} />
    </Tap>
  );
};

/** Tab icon on a pastel pill when selected. */
const TabIcon = ({ name, focused, color }: { name: IconName; focused: boolean; color: ColorValue }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.tabPill, focused && { backgroundColor: colors.primarySoft }]}>
      <Icon name={name} size={22} color={color} />
    </View>
  );
};

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { ...tokens.typography.h2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'SR App',
          tabBarLabel: 'Beranda',
          tabBarIcon: ({ focused, color }) => <TabIcon name="home" focused={focused} color={color} />,
          headerRight: () => (
            <View style={styles.headerRow}>
              <HeaderAction icon="bar_chart" label="Statistik" onPress={() => router.push('/statistik')} />
              <HeaderAction icon="settings" label="Pengaturan" onPress={() => router.push('/pengaturan')} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="matrix"
        options={{
          title: 'Matrix 4Q',
          tabBarLabel: 'Matrix',
          tabBarIcon: ({ focused, color }) => <TabIcon name="grid_view" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notula"
        options={{
          title: 'Notula',
          tabBarLabel: 'Notula',
          tabBarIcon: ({ focused, color }) => <TabIcon name="description" focused={focused} color={color} />,
          headerRight: () => (
            <View style={styles.headerRow}>
              <HeaderAction icon="mic" label="Quick Plan suara" onPress={() => router.push('/modals/quick-plan')} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="timer"
        options={{
          title: 'Timer',
          tabBarLabel: 'Timer',
          tabBarIcon: ({ focused, color }) => <TabIcon name="timer" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginRight: tokens.spacing.md,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: tokens.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPill: {
    width: 56,
    height: 30,
    borderRadius: tokens.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
