import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { ThemeMode } from '../src/theme/tokens';
import * as Notifications from 'expo-notifications';
import { SyncSettingsCard } from '../src/features/sync/SyncSettingsCard';
import { BackupSettingsCard } from '../src/features/backup/BackupSettingsCard';
import { ReminderSettingsCard } from '../src/features/meetings/ReminderSettingsCard';

type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'loading';

// Battery optimization list; falls back to the app's settings page if the OEM blocks the intent
const openBatterySettings = () =>
  Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => Linking.openSettings());

export default function Pengaturan() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const [notifStatus, setNotifStatus] = useState<PermissionStatus>('loading');

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setNotifStatus(status));
  }, []);

  const requestNotifPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifStatus(status);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {/* Tema */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Tema Tampilan</Text>
      <Card>
        <View style={styles.themeButtons}>
          {(['system', 'light', 'dark'] as ThemeMode[]).map((t) => (
            <View key={t} style={styles.btnWrapper}>
              <Button
                title={t === 'system' ? '🖥 Sistem' : t === 'light' ? '☀️ Terang' : '🌙 Gelap'}
                variant={themeMode === t ? 'primary' : 'secondary'}
                onPress={() => setThemeMode(t)}
              />
            </View>
          ))}
        </View>
      </Card>

      {/* Pengingat rapat */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Pengingat Rapat</Text>
      <ReminderSettingsCard />

      {/* Akun & Sinkronisasi */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Akun & Sinkronisasi</Text>
      <SyncSettingsCard />

      {/* Backup */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Backup</Text>
      <BackupSettingsCard />

      {/* Cek Kesehatan Notifikasi */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Cek Kesehatan Notifikasi</Text>

      {/* Status Notifikasi */}
      <Card>
        <View style={styles.healthRow}>
          <Text style={{ color: colors.text, flex: 1 }}>🔔 Izin Notifikasi</Text>
          <StatusBadge status={notifStatus} colors={colors} />
        </View>
        {notifStatus !== 'granted' && <Button title="Minta Izin" onPress={requestNotifPermission} variant="primary" />}
      </Card>

      {/* Exact Alarm */}
      <Card>
        <View style={styles.healthRow}>
          <Text style={{ color: colors.text, flex: 1 }}>⏰ Alarm Tepat Waktu</Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
          Pastikan izin “Alarm &amp; pengingat” aktif agar timer berbunyi tepat waktu.
        </Text>
        <Button title="Buka Pengaturan Sistem" onPress={() => Linking.openSettings()} variant="secondary" />
      </Card>

      {/* Battery */}
      <Card>
        <View style={styles.healthRow}>
          <Text style={{ color: colors.text, flex: 1 }}>🔋 Baterai (Samsung)</Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
          Atur app ke “Tidak dibatasi” agar timer berjalan di latar belakang.
          {'\n'}Matikan “Alihkan app yang tidak digunakan ke tidur”.
        </Text>
        <Button title="Buka Pengaturan Baterai" onPress={openBatterySettings} variant="secondary" />
      </Card>
    </ScrollView>
  );
}

function StatusBadge({ status, colors }: { status: PermissionStatus; colors: any }) {
  const label =
    status === 'granted' ? '✅ Aktif' : status === 'denied' ? '❌ Ditolak' : status === 'loading' ? '⏳' : '⚪ Belum';
  const bgColor =
    status === 'granted' ? colors.success + '30' : status === 'denied' ? colors.error + '30' : colors.surface;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={{ color: colors.text, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  btnWrapper: {
    flex: 1,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
