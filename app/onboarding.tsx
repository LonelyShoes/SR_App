import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'loading';

export default function Onboarding() {
  const { colors } = useTheme();
  const router = useRouter();

  const [notifStatus, setNotifStatus] = useState<PermissionStatus>('loading');

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setNotifStatus(status));
  }, []);

  const requestNotifPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifStatus(status);
  };

  const openAlarmSettings = () => {
    if (Platform.OS === 'android') {
      // Open exact alarm settings (Android 12+)
      Linking.openSettings();
    }
  };

  const openBatterySettings = () => {
    if (Platform.OS === 'android') {
      // Open battery optimization settings
      Linking.openSettings();
    }
  };

  const allGranted = notifStatus === 'granted';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text style={[styles.title, { color: colors.text }]}>Selamat Datang di SR App!</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Untuk pengalaman terbaik, berikan izin berikut:
      </Text>

      {/* Notification Permission */}
      <Card>
        <View style={styles.permRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.permTitle, { color: colors.text }]}>🔔 Notifikasi</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Untuk alarm timer dan pengingat rapat.</Text>
          </View>
          <StatusBadge status={notifStatus} colors={colors} />
        </View>
        {notifStatus !== 'granted' && (
          <Button title="Izinkan Notifikasi" onPress={requestNotifPermission} variant="primary" />
        )}
      </Card>

      {/* Exact Alarm */}
      <Card>
        <View style={styles.permRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.permTitle, { color: colors.text }]}>⏰ Alarm Tepat Waktu</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Agar timer dan pengingat rapat berbunyi tepat waktu.
            </Text>
          </View>
        </View>
        <Button title="Buka Pengaturan Alarm" onPress={openAlarmSettings} variant="secondary" />
      </Card>

      {/* Battery Optimization */}
      <Card>
        <View style={styles.permRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.permTitle, { color: colors.text }]}>🔋 Baterai (Samsung/One UI)</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Atur app ke “Tidak dibatasi” agar timer tetap berjalan di latar belakang.
              {'\n'}Matikan “Alihkan app yang tidak digunakan ke tidur”.
            </Text>
          </View>
        </View>
        <Button title="Buka Pengaturan Baterai" onPress={openBatterySettings} variant="secondary" />
      </Card>

      <View style={{ marginTop: 24 }}>
        <Button
          title={allGranted ? 'Mulai Pakai SR App ✨' : 'Lewati untuk sekarang'}
          onPress={() => router.replace('/(tabs)')}
          variant={allGranted ? 'primary' : 'secondary'}
        />
      </View>
    </ScrollView>
  );
}

function StatusBadge({ status, colors }: { status: PermissionStatus; colors: any }) {
  const label =
    status === 'granted'
      ? '✅ Diizinkan'
      : status === 'denied'
        ? '❌ Ditolak'
        : status === 'loading'
          ? '⏳'
          : '⚪ Belum';
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  permTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
});
