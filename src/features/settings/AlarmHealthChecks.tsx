import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Linking, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../theme/ThemeProvider';
import { tokens, Accent } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon, IconName } from '../../components/Icon';
import { IconBubble } from '../../components/IconBubble';
import { SrAlarm } from '../../../modules/sr-alarm';

type Health = 'ok' | 'bad' | 'unknown';

// Battery optimization list; falls back to the app's settings page if the OEM blocks the intent
const openBatterySettings = () =>
  Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => Linking.openSettings());

/** Permission checklist the timer alarm depends on (Pengaturan and onboarding). */
export function AlarmHealthChecks() {
  const [notif, setNotif] = useState<Health>('unknown');
  const [exactAlarm, setExactAlarm] = useState<Health>('unknown');
  const [fullScreen, setFullScreen] = useState<Health>('unknown');

  // Re-check whenever the user comes back from system settings
  const refresh = useCallback(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setNotif(status === 'granted' ? 'ok' : 'bad'));
    if (SrAlarm) {
      setExactAlarm(SrAlarm.canScheduleExactAlarms() ? 'ok' : 'bad');
      setFullScreen(SrAlarm.canUseFullScreenIntent() ? 'ok' : 'bad');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
      return () => sub.remove();
    }, [refresh]),
  );

  const requestNotifPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') Linking.openSettings();
    refresh();
  };

  return (
    <>
      <HealthCard
        icon="notifications"
        tone="q4"
        title="Izin notifikasi"
        status={notif}
        description="Wajib agar alarm timer dan pengingat rapat muncul."
        action={notif === 'bad' ? { label: 'Izinkan', onPress: requestNotifPermission } : undefined}
      />
      {SrAlarm && (
        <>
          <HealthCard
            icon="alarm"
            tone="fokus"
            title="Alarm tepat waktu"
            status={exactAlarm}
            description="Izin “Alarm & pengingat” agar timer berbunyi tepat di detik selesai."
            action={
              exactAlarm === 'bad'
                ? { label: 'Buka pengaturan', onPress: () => SrAlarm?.openExactAlarmSettings() }
                : undefined
            }
          />
          <HealthCard
            icon="lock_open"
            tone="santai"
            title="Alarm layar penuh"
            status={fullScreen}
            description="Menampilkan layar alarm di atas layar kunci saat timer selesai."
            action={
              fullScreen === 'bad'
                ? { label: 'Buka pengaturan', onPress: () => SrAlarm?.openFullScreenIntentSettings() }
                : undefined
            }
          />
        </>
      )}
      <HealthCard
        icon="battery_alert"
        tone="q3"
        title="Baterai (Samsung)"
        status="unknown"
        description={
          'Atur app ke “Tidak dibatasi” agar alarm tetap berbunyi di latar belakang.\nMatikan “Tidurkan aplikasi yang tidak digunakan”.'
        }
        action={{ label: 'Buka pengaturan baterai', onPress: openBatterySettings }}
      />
    </>
  );
}

type HealthCardProps = {
  icon: IconName;
  tone: Accent;
  title: string;
  description: string;
  status: Health;
  action?: { label: string; onPress: () => void };
};

function HealthCard({ icon, tone, title, description, status, action }: HealthCardProps) {
  const { colors } = useTheme();
  const badge =
    status === 'ok'
      ? { label: 'Aktif', icon: 'check_circle' as IconName, fg: colors.success, bg: colors.successSoft }
      : status === 'bad'
        ? { label: 'Perlu izin', icon: 'error' as IconName, fg: colors.error, bg: colors.errorSoft }
        : null;

  return (
    <Card>
      <View style={styles.healthRow}>
        <IconBubble name={icon} tone={tone} size={40} />
        <Text style={[styles.healthTitle, { color: colors.text }]}>{title}</Text>
        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Icon name={badge.icon} size={14} color={badge.fg} />
            <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.healthDesc, { color: colors.textSecondary }]}>{description}</Text>
      {action && <Button title={action.label} variant="secondary" onPress={action.onPress} style={styles.healthBtn} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm + tokens.spacing.xs,
  },
  healthTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  healthDesc: {
    ...tokens.typography.caption,
    lineHeight: 20,
    marginTop: tokens.spacing.sm + tokens.spacing.xs,
  },
  healthBtn: {
    marginTop: tokens.spacing.sm + tokens.spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
