import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { tokens, ThemeMode } from '../src/theme/tokens';
import { Tap } from '../src/components/Tap';
import { Icon, IconName } from '../src/components/Icon';
import { SectionHeader } from '../src/components/SectionHeader';
import { SyncSettingsCard } from '../src/features/sync/SyncSettingsCard';
import { BackupSettingsCard } from '../src/features/backup/BackupSettingsCard';
import { ReminderSettingsCard } from '../src/features/meetings/ReminderSettingsCard';
import { AlarmHealthChecks } from '../src/features/settings/AlarmHealthChecks';

const THEMES: { value: ThemeMode; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Sistem', icon: 'brightness_auto' },
  { value: 'light', label: 'Terang', icon: 'light_mode' },
  { value: 'dark', label: 'Gelap', icon: 'dark_mode' },
];

export default function Pengaturan() {
  const { colors, themeMode, setThemeMode } = useTheme();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <SectionHeader title="Tema Tampilan" first />
      <View style={styles.themeRow}>
        {THEMES.map((t) => {
          const active = themeMode === t.value;
          return (
            <Tap
              key={t.value}
              onPress={() => setThemeMode(t.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.themeTile, { backgroundColor: active ? colors.primary : colors.surface }]}
            >
              <Icon name={t.icon} size={26} color={active ? colors.onPrimary : colors.primary} />
              <Text style={[styles.themeLabel, { color: active ? colors.onPrimary : colors.text }]}>{t.label}</Text>
            </Tap>
          );
        })}
      </View>

      <SectionHeader title="Pengingat Rapat" />
      <ReminderSettingsCard />

      <SectionHeader title="Akun & Sinkronisasi" />
      <SyncSettingsCard />

      <SectionHeader title="Backup" />
      <BackupSettingsCard />

      <SectionHeader title="Cek Kesehatan Alarm" />
      <AlarmHealthChecks />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl * 2,
  },
  themeRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm + tokens.spacing.xs,
  },
  themeTile: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.spacing.xs + 2,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
