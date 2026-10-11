import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useTimerStore, TimerKind } from '../../src/features/timer/store';
import { getPresetsQuery, updatePreset, TimerPreset } from '../../src/features/timer/repository';
import { Sheet } from '../../src/components/Sheet';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Form';
import { Tap } from '../../src/components/Tap';
import { Icon, IconName } from '../../src/components/Icon';
import { tokens } from '../../src/theme/tokens';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const MAX_PRESET_MIN = 180;
const DIAL = 270;
const TICKS = 60;

const KIND_ICONS: Record<TimerKind, IconName> = {
  fokus: 'psychology',
  rehat: 'local_cafe',
  santai: 'spa',
};

export default function Timer() {
  const { colors } = useTheme();
  const { status, kind, start, pause, resume, stop, tick, plannedSec, presetId } = useTimerStore();
  const { mulai } = useLocalSearchParams<{ mulai?: string }>();
  const { data: presets } = useLiveQuery(getPresetsQuery(), []);
  // Keep the id, not the row, so edits to the preset are picked up
  const [pickedPresetId, setPickedPresetId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; minutes: string } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [, setTickCount] = useState(0);

  // While a session runs, show its preset; otherwise the user's pick (default: first preset)
  const runningPreset = status !== 'idle' ? presets.find((p) => p.id === presetId) : undefined;
  const selectedPreset = runningPreset ?? presets.find((p) => p.id === pickedPresetId) ?? presets[0] ?? null;

  // Deep link from the Quick Action widget: srapp://timer?mulai=fokus
  useEffect(() => {
    if (mulai !== 'fokus' || presets.length === 0) return;
    router.setParams({ mulai: undefined });
    const focus = presets.find((p) => p.kind === 'fokus');
    if (status === 'idle' && focus) {
      start('fokus', focus.duration_sec, focus.id);
    }
  }, [mulai, presets, status, start]);

  // Re-render every 200ms while running; remaining time is derived from end_at and
  // completion is handled app-wide by useTimerWatcher
  useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => setTickCount((n) => n + 1), 200);
    return () => clearInterval(interval);
  }, [status]);

  // Soft "breathing" of the dial while running
  const breath = useSharedValue(1);
  useEffect(() => {
    if (status !== 'running') {
      cancelAnimation(breath);
      breath.set(withTiming(1));
      return;
    }
    breath.set(withRepeat(withSequence(withTiming(1.03, { duration: 1600 }), withTiming(1, { duration: 1600 })), -1));
  }, [status, breath]);
  const dialStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.get() }] }));

  const remaining = status === 'idle' ? (selectedPreset?.duration_sec ?? plannedSec) : tick();

  const handleSelectPreset = useCallback(
    (preset: TimerPreset) => {
      if (status !== 'idle') return; // Can't change preset while running
      setPickedPresetId(preset.id);
    },
    [status],
  );

  const handleStart = useCallback(async () => {
    if (!selectedPreset) return;
    await start(selectedPreset.kind as TimerKind, selectedPreset.duration_sec, selectedPreset.id);
  }, [selectedPreset, start]);

  // Idle: colors of the preset about to start; running: the session's kind
  const accentKind = ((status === 'idle' ? selectedPreset?.kind : kind) as TimerKind | undefined) ?? 'fokus';
  const strong = colors[accentKind];
  const soft = colors[`${accentKind}Soft`];

  const openEditor = () => {
    if (!selectedPreset) return;
    setEditError(null);
    setEditing({
      id: selectedPreset.id,
      name: selectedPreset.name,
      minutes: String(Math.round(selectedPreset.duration_sec / 60)),
    });
  };

  const saveEditor = async () => {
    if (!editing) return;
    const minutes = Number(editing.minutes);
    if (!editing.name.trim()) return setEditError('Nama tidak boleh kosong.');
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_PRESET_MIN) {
      return setEditError(`Durasi harus 1–${MAX_PRESET_MIN} menit.`);
    }
    await updatePreset(editing.id, { name: editing.name.trim(), duration_sec: minutes * 60 });
    setEditing(null);
  };

  const progress = status === 'idle' ? 1 : Math.max(0, Math.min(1, remaining / plannedSec));
  const litTicks = Math.round(progress * TICKS);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      {/* Preset tiles */}
      <View style={styles.presetRow}>
        {presets.map((p) => {
          const k = p.kind as TimerKind;
          const selected = selectedPreset?.id === p.id;
          return (
            <Tap
              key={p.id}
              onPress={() => handleSelectPreset(p)}
              disabled={status !== 'idle' && !selected}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${p.name} ${Math.round(p.duration_sec / 60)} menit`}
              style={[styles.presetTile, { backgroundColor: selected ? colors[k] : colors[`${k}Soft`] }]}
            >
              <Icon name={KIND_ICONS[k] ?? 'timer'} size={28} color={selected ? colors.onPrimary : colors[k]} />
              <Text style={[styles.presetName, { color: selected ? colors.onPrimary : colors[k] }]} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={[styles.presetMin, { color: selected ? colors.onPrimary : colors.textSecondary }]}>
                {Math.round(p.duration_sec / 60)} menit
              </Text>
            </Tap>
          );
        })}
      </View>

      {/* Dial */}
      <Animated.View style={[styles.dial, { backgroundColor: soft }, dialStyle]}>
        {Array.from({ length: TICKS }, (_, i) => (
          <View
            key={i}
            style={[styles.tickArm, { transform: [{ rotate: `${(i * 360) / TICKS}deg` }] }]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.tick,
                i % 5 === 0 && styles.tickMajor,
                { backgroundColor: i < litTicks ? strong : colors.surface },
              ]}
            />
          </View>
        ))}
        <View style={[styles.face, { backgroundColor: colors.surface }]}>
          <Text style={[styles.timerText, { color: colors.text }]}>{formatTime(remaining)}</Text>
          <View style={[styles.statusChip, { backgroundColor: soft }]}>
            <Text style={[styles.statusText, { color: strong }]}>
              {status === 'idle'
                ? (selectedPreset?.name ?? 'Pilih preset')
                : status === 'paused'
                  ? 'Dijeda'
                  : 'Berjalan'}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Controls */}
      <View style={styles.controls}>
        {status === 'idle' && (
          <Tap
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Mulai timer"
            scaleTo={0.92}
            style={[styles.playBtn, { backgroundColor: strong }]}
          >
            <Icon name="play_arrow" size={44} color={colors.onPrimary} />
          </Tap>
        )}

        {status !== 'idle' && (
          <View style={styles.controlRow}>
            <Tap
              onPress={stop}
              accessibilityRole="button"
              accessibilityLabel="Berhenti"
              scaleTo={0.9}
              style={[styles.sideBtn, { backgroundColor: colors.surfaceAlt }]}
            >
              <Icon name="stop" size={28} color={colors.text} />
            </Tap>
            <Tap
              onPress={status === 'running' ? pause : resume}
              accessibilityRole="button"
              accessibilityLabel={status === 'running' ? 'Jeda' : 'Lanjut'}
              scaleTo={0.92}
              style={[styles.playBtn, { backgroundColor: strong }]}
            >
              <Icon name={status === 'running' ? 'pause' : 'play_arrow'} size={44} color={colors.onPrimary} />
            </Tap>
            <View style={styles.sideBtn} />
          </View>
        )}
      </View>

      {/* Preset editor (spec 6.4: presets are configurable) */}
      {selectedPreset && status === 'idle' && (
        <Button title="Atur preset" icon="tune" variant="ghost" onPress={openEditor} />
      )}

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title="Atur preset"
        icon="tune"
        subtitle={`Maksimal ${MAX_PRESET_MIN} menit`}
      >
        {editing && (
          <>
            <Field label="Nama" value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} />
            <Field
              label="Durasi (menit)"
              value={editing.minutes}
              onChangeText={(minutes) => setEditing({ ...editing, minutes: minutes.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
            />
            {editError && <Text style={{ color: colors.error, marginBottom: tokens.spacing.sm }}>{editError}</Text>}
            <Button title="Simpan" size="lg" onPress={saveEditor} />
          </>
        )}
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
    alignItems: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm + tokens.spacing.xs,
    alignSelf: 'stretch',
    marginBottom: tokens.spacing.xl,
  },
  presetTile: {
    flex: 1,
    borderRadius: tokens.borderRadius.lg,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  presetName: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: tokens.spacing.xs,
  },
  presetMin: {
    ...tokens.typography.small,
  },
  dial: {
    width: DIAL,
    height: DIAL,
    borderRadius: DIAL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickArm: {
    position: 'absolute',
    width: DIAL,
    height: DIAL,
    alignItems: 'center',
  },
  tick: {
    width: 4,
    height: 12,
    borderRadius: 2,
    marginTop: 10,
  },
  tickMajor: {
    height: 18,
    width: 5,
  },
  face: {
    width: DIAL - 84,
    height: DIAL - 84,
    borderRadius: (DIAL - 84) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 50,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statusChip: {
    marginTop: tokens.spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: tokens.borderRadius.full,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  controls: {
    marginTop: tokens.spacing.xl,
    marginBottom: tokens.spacing.md,
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.lg,
  },
  playBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
