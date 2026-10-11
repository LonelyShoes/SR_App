import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useTheme } from '../src/theme/ThemeProvider';
import { tokens } from '../src/theme/tokens';
import { Card } from '../src/components/Card';
import { BarChart } from '../src/components/BarChart';
import { useTablesVersion } from '../src/db/use-tables-version';
import { loadStats, Stats, StatsRange } from '../src/features/stats/repository';
import { formatDuration } from '../src/features/stats/compute';

const RANGES: StatsRange[] = [7, 30, 90];

const KIND_LABELS: Record<string, string> = { fokus: 'Fokus', rehat: 'Rehat', santai: 'Santai' };

export default function Statistik() {
  const { colors } = useTheme();
  const [range, setRange] = useState<StatsRange>(7);
  const [stats, setStats] = useState<Stats | null>(null);
  const version = useTablesVersion(['timer_sessions', 'tasks']);

  useEffect(() => {
    let cancelled = false;
    loadStats(range).then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [range, version]);

  const kindColors: Record<string, string> = { fokus: colors.q1, rehat: colors.success, santai: colors.primary };

  const seriesLabel = (day: string) =>
    stats?.seriesUnit === 'minggu' || range === 30
      ? format(parseISO(day), 'd/M')
      : format(parseISO(day), 'EEE', { locale: localeId });
  const labelEvery = range === 30 ? 5 : range === 90 ? 2 : 1;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }}
      />

      <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.segmentBtn, range === r && { backgroundColor: colors.primary }]}
            onPress={() => setRange(r)}
            accessibilityRole="button"
            accessibilityState={{ selected: range === r }}
          >
            <Text style={{ color: range === r ? colors.background : colors.text, fontWeight: 'bold' }}>{r} hari</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!stats ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: tokens.spacing.xl }} />
      ) : (
        <>
          <View style={styles.tiles}>
            <Tile label="Total fokus" value={formatDuration(stats.totalFocusSec)} />
            <Tile label="Rata-rata sesi fokus" value={formatDuration(stats.avgFocusSec)} />
            <Tile label="Streak saat ini" value={`${stats.streak.current} hari`} />
            <Tile label="Streak terpanjang" value={`${stats.streak.longest} hari`} />
          </View>

          <Card>
            <Text style={[styles.title, { color: colors.text }]}>Sesi timer</Text>
            <Text style={{ color: colors.text }}>
              {stats.sessionsCompleted} selesai · {stats.sessionsTotal - stats.sessionsCompleted} dibatalkan
            </Text>
            <View style={[styles.track, { backgroundColor: colors.border }]}>
              <View style={{ width: `${stats.completionPct}%`, height: '100%', backgroundColor: colors.success }} />
            </View>
            <Text style={{ color: colors.textSecondary }}>Tingkat penyelesaian {stats.completionPct}%</Text>
          </Card>

          <Card>
            <Text style={[styles.title, { color: colors.text }]}>Waktu fokus per {stats.seriesUnit}</Text>
            <BarChart
              data={stats.focusSeries.map((d) => ({ label: seriesLabel(d.day), value: d.value }))}
              labelEvery={labelEvery}
              color={colors.q1}
              accessibilityLabel={`Waktu fokus per ${stats.seriesUnit}, total ${formatDuration(stats.totalFocusSec)}`}
            />
          </Card>

          <Card>
            <Text style={[styles.title, { color: colors.text }]}>Distribusi waktu</Text>
            {stats.kinds.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>Belum ada sesi di periode ini.</Text>
            ) : (
              (() => {
                const total = stats.kinds.reduce((sum, k) => sum + k.totalSec, 0) || 1;
                return stats.kinds.map((k) => {
                  const pct = Math.round((k.totalSec / total) * 100);
                  return (
                    <View key={k.kind} style={styles.kindRow}>
                      <Text style={[styles.kindLabel, { color: colors.text }]}>{KIND_LABELS[k.kind] ?? k.kind}</Text>
                      <View style={[styles.track, styles.flex, { backgroundColor: colors.border }]}>
                        <View
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            backgroundColor: kindColors[k.kind] ?? colors.primary,
                          }}
                        />
                      </View>
                      <Text style={[styles.kindValue, { color: colors.textSecondary }]}>
                        {formatDuration(k.totalSec)} · {pct}%
                      </Text>
                    </View>
                  );
                });
              })()
            )}
          </Card>

          <Card>
            <Text style={[styles.title, { color: colors.text }]}>Jam paling produktif</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: tokens.spacing.sm }}>
              {stats.peakHour === null
                ? 'Belum ada sesi fokus.'
                : `Puncak fokus pukul ${String(stats.peakHour).padStart(2, '0')}.00–${String(stats.peakHour + 1).padStart(2, '0')}.00`}
            </Text>
            <BarChart
              data={stats.hours.map((value, hour) => ({ label: String(hour), value }))}
              labelEvery={3}
              height={80}
              accessibilityLabel="Total waktu fokus per jam, 0 sampai 23"
            />
          </Card>

          <Card>
            <Text style={[styles.title, { color: colors.text }]}>Tugas diselesaikan per {stats.seriesUnit}</Text>
            <BarChart
              data={stats.tasksSeries.map((d) => ({ label: seriesLabel(d.day), value: d.value }))}
              labelEvery={labelEvery}
              color={colors.success}
              accessibilityLabel={`Tugas selesai per ${stats.seriesUnit}, total ${stats.tasksSeries.reduce((s, d) => s + d.value, 0)}`}
            />
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.tile}>
      <Text style={[tokens.typography.h3, { color: colors.text }]}>{value}</Text>
      <Text style={{ color: colors.textSecondary, ...tokens.typography.small }}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: tokens.spacing.md,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.sm,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
  },
  title: {
    ...tokens.typography.body,
    fontWeight: 'bold',
    marginBottom: tokens.spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden',
    marginVertical: tokens.spacing.sm,
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  kindLabel: {
    width: 56,
  },
  kindValue: {
    ...tokens.typography.small,
    width: 96,
    textAlign: 'right',
  },
  flex: {
    flex: 1,
  },
});
