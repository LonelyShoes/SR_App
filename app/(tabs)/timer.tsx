import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useTimerStore, TimerKind } from '../../src/features/timer/store';
import { getPresetsQuery, TimerPreset } from '../../src/features/timer/repository';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const KIND_LABELS: Record<TimerKind, string> = {
  fokus: '🎯 Fokus',
  rehat: '☕ Rehat',
  santai: '🌴 Santai',
};

const KIND_COLORS_LIGHT: Record<TimerKind, string> = {
  fokus: '#EF4444',
  rehat: '#10B981',
  santai: '#3B82F6',
};

export default function Timer() {
  const { colors } = useTheme();
  const { status, kind, start, pause, resume, stop, tick, plannedSec, presetId } = useTimerStore();
  const { mulai } = useLocalSearchParams<{ mulai?: string }>();
  const { data: presets } = useLiveQuery(getPresetsQuery(), []);
  const [pickedPreset, setPickedPreset] = useState<TimerPreset | null>(null);
  const [, setTickCount] = useState(0);

  // While a session runs, show its preset; otherwise the user's pick (default: first preset)
  const runningPreset = status !== 'idle' ? presets.find((p) => p.id === presetId) : undefined;
  const selectedPreset = runningPreset ?? pickedPreset ?? presets[0] ?? null;

  // Deep link from the Quick Action widget: srapp://timer?mulai=fokus
  useEffect(() => {
    if (mulai !== 'fokus' || presets.length === 0) return;
    router.setParams({ mulai: undefined });
    const focus = presets.find((p) => p.kind === 'fokus');
    if (status === 'idle' && focus) {
      start('fokus', focus.duration_sec, focus.id);
    }
  }, [mulai, presets, status, start]);

  // Tick every 200ms only to re-render; remaining time is derived from end_at
  useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => {
      if (tick() <= 0) {
        // Timer finished naturally
        stop();
      } else {
        setTickCount((n) => n + 1);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [status, tick, stop]);

  const remaining = status === 'idle' ? (selectedPreset?.duration_sec ?? plannedSec) : tick();

  const handleSelectPreset = useCallback((preset: TimerPreset) => {
    if (status !== 'idle') return; // Can't change preset while running
    setPickedPreset(preset);
  }, [status]);

  const handleStart = useCallback(async () => {
    if (!selectedPreset) return;
    await start(
      selectedPreset.kind as TimerKind,
      selectedPreset.duration_sec,
      selectedPreset.id,
    );
  }, [selectedPreset, start]);

  const accentColor = KIND_COLORS_LIGHT[kind] || colors.primary;
  const progress = status === 'idle' ? 1 : remaining / plannedSec;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Kind Selector */}
      <View style={[styles.presetRow, { backgroundColor: colors.surface }]}>
        {presets.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.presetBtn,
              selectedPreset?.id === p.id && { backgroundColor: accentColor },
            ]}
            onPress={() => handleSelectPreset(p)}
            disabled={status !== 'idle'}
          >
            <Text
              style={{
                color: selectedPreset?.id === p.id ? '#FFF' : colors.text,
                fontSize: 13,
                fontWeight: selectedPreset?.id === p.id ? 'bold' : 'normal',
              }}
            >
              {KIND_LABELS[p.kind as TimerKind] || p.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timer Display */}
      <View style={styles.timerSection}>
        {/* Circular progress ring */}
        <View style={[styles.timerRing, { borderColor: accentColor + '30' }]}>
          <View
            style={[
              styles.timerRingInner,
              { borderColor: accentColor, opacity: progress },
            ]}
          />
          <View style={styles.timerTextContainer}>
            <Text style={[styles.timerText, { color: accentColor }]}>
              {formatTime(remaining)}
            </Text>
            <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>
              {status === 'idle'
                ? selectedPreset?.name || 'Pilih preset'
                : status === 'paused'
                  ? 'Dijeda'
                  : 'Berjalan...'}
            </Text>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {status === 'idle' && (
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: accentColor }]}
            onPress={handleStart}
          >
            <Text style={styles.mainBtnText}>▶ Mulai</Text>
          </TouchableOpacity>
        )}

        {status === 'running' && (
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: colors.warning }]}
              onPress={pause}
            >
              <Text style={styles.controlBtnText}>⏸ Jeda</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: colors.error }]}
              onPress={stop}
            >
              <Text style={styles.controlBtnText}>⏹ Berhenti</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'paused' && (
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: accentColor }]}
              onPress={resume}
            >
              <Text style={styles.controlBtnText}>▶ Lanjut</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: colors.error }]}
              onPress={stop}
            >
              <Text style={styles.controlBtnText}>⏹ Berhenti</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Duration info */}
      {selectedPreset && status === 'idle' && (
        <Text style={[styles.durationHint, { color: colors.textSecondary }]}>
          {Math.floor(selectedPreset.duration_sec / 60)} menit
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  presetRow: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  timerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerRing: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerRingInner: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 8,
  },
  timerTextContainer: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 56,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: 16,
    marginTop: 8,
  },
  controls: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  mainBtn: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 32,
  },
  mainBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  controlRow: {
    flexDirection: 'row',
    gap: 16,
  },
  controlBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  controlBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  durationHint: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
});
