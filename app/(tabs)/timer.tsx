import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useTimerStore, TimerKind } from '../../src/features/timer/store';
import { getPresetsQuery, updatePreset, TimerPreset } from '../../src/features/timer/repository';
import { Sheet } from '../../src/components/Sheet';
import { Button } from '../../src/components/Button';
import { tokens } from '../../src/theme/tokens';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const MAX_PRESET_MIN = 180;

const KIND_LABELS: Record<TimerKind, string> = {
  fokus: '🎯 Fokus',
  rehat: '☕ Rehat',
  santai: '🌴 Santai',
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

  // Idle: color of the preset about to start; running: the session's kind
  const accentKind = (status === 'idle' ? selectedPreset?.kind : kind) as TimerKind | undefined;
  const accentColor = (accentKind && colors[accentKind]) || colors.primary;

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
  const progress = status === 'idle' ? 1 : remaining / plannedSec;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Kind Selector */}
      <View style={[styles.presetRow, { backgroundColor: colors.surface }]}>
        {presets.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.presetBtn, selectedPreset?.id === p.id && { backgroundColor: accentColor }]}
            onPress={() => handleSelectPreset(p)}
            disabled={status !== 'idle'}
          >
            <Text
              style={{
                color: selectedPreset?.id === p.id ? colors.onPrimary : colors.text,
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
          <View style={[styles.timerRingInner, { borderColor: accentColor, opacity: progress }]} />
          <View style={styles.timerTextContainer}>
            <Text style={[styles.timerText, { color: accentColor }]}>{formatTime(remaining)}</Text>
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
          <TouchableOpacity style={[styles.mainBtn, { backgroundColor: accentColor }]} onPress={handleStart}>
            <Text style={[styles.mainBtnText, { color: colors.onPrimary }]}>▶ Mulai</Text>
          </TouchableOpacity>
        )}

        {status === 'running' && (
          <View style={styles.controlRow}>
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.warning }]} onPress={pause}>
              <Text style={[styles.controlBtnText, { color: colors.onPrimary }]}>⏸ Jeda</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.error }]} onPress={stop}>
              <Text style={[styles.controlBtnText, { color: colors.onError }]}>⏹ Berhenti</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'paused' && (
          <View style={styles.controlRow}>
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: accentColor }]} onPress={resume}>
              <Text style={[styles.controlBtnText, { color: colors.onPrimary }]}>▶ Lanjut</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.error }]} onPress={stop}>
              <Text style={[styles.controlBtnText, { color: colors.onError }]}>⏹ Berhenti</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Duration info + preset editor (spec 6.4: presets are configurable) */}
      {selectedPreset && status === 'idle' && (
        <View style={styles.durationRow}>
          <Text style={[styles.durationHint, { color: colors.textSecondary }]}>
            {Math.floor(selectedPreset.duration_sec / 60)} menit
          </Text>
          <TouchableOpacity onPress={openEditor} accessibilityRole="button" style={styles.editBtn}>
            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>✏️ Atur preset</Text>
          </TouchableOpacity>
        </View>
      )}

      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title="Atur preset">
        {editing && (
          <>
            <Text style={[styles.label, { color: colors.text }]}>Nama</Text>
            <TextInput
              value={editing.name}
              onChangeText={(name) => setEditing({ ...editing, name })}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <Text style={[styles.label, { color: colors.text }]}>Durasi (menit)</Text>
            <TextInput
              value={editing.minutes}
              onChangeText={(minutes) => setEditing({ ...editing, minutes: minutes.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            {editError && <Text style={{ color: colors.error, marginBottom: tokens.spacing.sm }}>{editError}</Text>}
            <Button title="Simpan" onPress={saveEditor} />
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  durationRow: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  editBtn: {
    padding: tokens.spacing.sm,
  },
  label: {
    ...tokens.typography.caption,
    fontWeight: 'bold',
    marginBottom: tokens.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.sm + tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  durationHint: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
});
