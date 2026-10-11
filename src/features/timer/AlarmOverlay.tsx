import React, { useEffect } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTheme } from '../../theme/ThemeProvider';
import { tokens } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useTimerStore, TimerKind } from './store';
import { getPresetsQuery } from './repository';

const COPY: Record<TimerKind, { title: string; body: string; next: TimerKind }> = {
  fokus: { title: 'Fokus selesai!', body: 'Kerja bagus. Saatnya istirahat sejenak.', next: 'rehat' },
  rehat: { title: 'Rehat selesai!', body: 'Siap fokus lagi?', next: 'fokus' },
  santai: { title: 'Santai selesai!', body: 'Waktunya kembali beraktivitas.', next: 'fokus' },
};

const NEXT_LABEL: Record<TimerKind, string> = { fokus: 'Mulai Fokus', rehat: 'Mulai Rehat', santai: 'Mulai Santai' };

/**
 * In-app alarm screen while the end-of-session alarm rings (the native alarm screen
 * covers the lock screen; this one covers the app when it is open).
 */
export function AlarmOverlay() {
  const { colors } = useTheme();
  const ringing = useTimerStore((s) => s.ringing);
  const kind = useTimerStore((s) => s.kind);
  const { data: presets } = useLiveQuery(getPresetsQuery(), []);

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!ringing) return;
    pulse.set(withRepeat(withSequence(withTiming(1.12, { duration: 650 }), withTiming(1, { duration: 650 })), -1));
    return () => cancelAnimation(pulse);
  }, [ringing, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  const copy = COPY[kind];
  const next = presets.find((p) => p.kind === copy.next);

  const dismiss = () => useTimerStore.getState().dismissAlarm();
  const startNext = () => {
    if (!next) return;
    useTimerStore.getState().start(copy.next, next.duration_sec, next.id);
    router.navigate('/timer');
  };

  return (
    <Modal visible={ringing} animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View style={[styles.screen, { backgroundColor: colors[`${kind}Soft`] }]}>
        <Animated.View style={[styles.halo, { backgroundColor: colors.surface }, ring]}>
          <View style={[styles.core, { backgroundColor: colors[kind] }]}>
            <Icon name="alarm" size={64} color={colors.onPrimary} />
          </View>
        </Animated.View>
        <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{copy.body}</Text>
        <View style={styles.actions}>
          <Button title="Matikan Alarm" icon="alarm_off" size="lg" onPress={dismiss} />
          {next && (
            <Button
              title={`${NEXT_LABEL[copy.next]} ${Math.round(next.duration_sec / 60)} menit`}
              icon="play_arrow"
              size="lg"
              variant="secondary"
              onPress={startNext}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
  },
  halo: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.xl,
  },
  core: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...tokens.typography.h1,
    textAlign: 'center',
  },
  body: {
    ...tokens.typography.body,
    textAlign: 'center',
    marginTop: tokens.spacing.sm,
  },
  actions: {
    alignSelf: 'stretch',
    gap: tokens.spacing.sm + tokens.spacing.xs,
    marginTop: tokens.spacing.xl + tokens.spacing.md,
  },
});
