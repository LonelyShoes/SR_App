import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { format, isSameDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens, Accent } from '../../src/theme/tokens';
import { Card } from '../../src/components/Card';
import { Tap } from '../../src/components/Tap';
import { Icon, IconName } from '../../src/components/Icon';
import { IconBubble } from '../../src/components/IconBubble';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { Task, getTasksQuery, toggleTaskStatus } from '../../src/features/tasks/repository';
import { Meeting, getMeetingsQuery, updateMeetingStatus } from '../../src/features/meetings/repository';
import { TaskFormSheet } from '../../src/features/tasks/TaskFormSheet';
import { MeetingFormSheet } from '../../src/features/meetings/MeetingFormSheet';
import { summarizeDashboard } from '../../src/widgets/dashboard-data';
import { useTimerStore } from '../../src/features/timer/store';
import { getPresetsQuery } from '../../src/features/timer/repository';

const PRIORITY_LIMIT = 5;
const QUADRANTS = [
  { q: 'Q1', label: 'Penting & Mendesak' },
  { q: 'Q2', label: 'Penting' },
  { q: 'Q3', label: 'Mendesak' },
  { q: 'Q4', label: 'Lainnya' },
] as const;

const greeting = (now: number) => {
  const h = new Date(now).getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
};

export default function Dashboard() {
  const { colors } = useTheme();
  const { data: tasks } = useLiveQuery(getTasksQuery(), []);
  const { data: meetings } = useLiveQuery(getMeetingsQuery(), []);
  const { data: presets } = useLiveQuery(getPresetsQuery(), []);
  const timerStatus = useTimerStore((s) => s.status);

  // "Today" is refreshed whenever the tab gains focus (render must stay pure)
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  const [taskSheet, setTaskSheet] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [meetingSheet, setMeetingSheet] = useState<{ open: boolean; meeting: Meeting | null }>({
    open: false,
    meeting: null,
  });

  // Same rules as the home-screen widget
  const summary = summarizeDashboard(tasks, meetings, now);
  const todayMeetings = meetings.filter((m) => isSameDay(m.start_at, now));
  const tasksTodo = tasks.filter((t) => t.status === 'todo');
  const priorityTasks = tasksTodo
    .filter((t) => t.quadrant === 'Q1' || t.quadrant === 'Q2')
    .sort((a, b) => a.quadrant.localeCompare(b.quadrant) || (a.due_at ?? Infinity) - (b.due_at ?? Infinity))
    .slice(0, PRIORITY_LIMIT);
  const qTone = (q: string) => q.toLowerCase() as Accent;

  const startFocus = () => {
    const focus = presets.find((p) => p.kind === 'fokus');
    if (focus && timerStatus === 'idle') useTimerStore.getState().start('fokus', focus.duration_sec, focus.id);
    router.navigate('/timer');
  };

  const quickActions: { icon: IconName; label: string; hint: string; tone: Accent; onPress: () => void }[] = [
    {
      icon: 'timer',
      label: 'Fokus',
      hint: timerStatus === 'idle' ? 'Mulai sesi' : 'Sedang jalan',
      tone: 'fokus',
      onPress: startFocus,
    },
    {
      icon: 'add_task',
      label: 'Tugas',
      hint: 'Tambah baru',
      tone: 'q2',
      onPress: () => setTaskSheet({ open: true, task: null }),
    },
    {
      icon: 'event',
      label: 'Rapat',
      hint: 'Jadwalkan',
      tone: 'santai',
      onPress: () => setMeetingSheet({ open: true, meeting: null }),
    },
    {
      icon: 'mic',
      label: 'Quick Plan',
      hint: 'Pakai suara',
      tone: 'q4',
      onPress: () => router.push('/modals/quick-plan'),
    },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Greeting + daily briefing */}
      <Animated.View entering={FadeInDown.duration(350)}>
        <Text style={[styles.hello, { color: colors.textSecondary }]}>
          {format(now, 'EEEE, d MMMM', { locale: localeId })}
        </Text>
        <Text style={[styles.greeting, { color: colors.text }]}>{greeting(now)} 👋</Text>

        <Card tone="primary" style={styles.briefing}>
          <Text style={[styles.briefingTitle, { color: colors.primary }]}>Ringkasan hari ini</Text>
          <View style={styles.statRow}>
            <Stat value={summary.agendaToday} label="Agenda" />
            <Stat value={summary.confirmedToday} label="Terkonfirmasi" />
            <Stat value={summary.urgentTasks} label="Mendesak" />
          </View>
        </Card>
      </Animated.View>

      {/* Quick actions: horizontal tiles */}
      <SectionHeader title="Aksi Cepat" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tiles}
        style={styles.tilesScroll}
      >
        {quickActions.map((a, i) => (
          <Animated.View key={a.label} entering={FadeInDown.delay(80 + i * 50).duration(350)}>
            <Tap
              onPress={a.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${a.label}: ${a.hint}`}
              style={[styles.tile, { backgroundColor: colors[`${a.tone}Soft`] }]}
            >
              <Icon name={a.icon} size={30} color={colors[a.tone]} />
              <Text style={[styles.tileLabel, { color: colors[a.tone] }]}>{a.label}</Text>
              <Text style={[styles.tileHint, { color: colors.textSecondary }]}>{a.hint}</Text>
            </Tap>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Agenda hari ini */}
      <SectionHeader
        title="Agenda Hari Ini"
        actionLabel="Tambah"
        onAction={() => setMeetingSheet({ open: true, meeting: null })}
      />
      {todayMeetings.length === 0 ? (
        <Card>
          <View style={styles.row}>
            <IconBubble name="event_available" tone="santai" />
            <Text style={[styles.flex, { color: colors.textSecondary }]}>Bebas agenda hari ini. Nikmati!</Text>
          </View>
        </Card>
      ) : (
        todayMeetings.map((m, i) => {
          const confirmed = m.status === 'terkonfirmasi';
          return (
            <Animated.View key={m.id} entering={FadeInDown.delay(i * 40).duration(300)}>
              <Card onPress={() => setMeetingSheet({ open: true, meeting: m })} accessibilityLabel={`Rapat ${m.title}`}>
                <View style={styles.row}>
                  <IconBubble name="groups" tone="santai" />
                  <View style={styles.flex}>
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                      {m.title}
                    </Text>
                    <Text style={[styles.itemMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {format(m.start_at, 'HH:mm')}–{format(m.end_at, 'HH:mm')}
                      {m.location ? ` · ${m.location}` : ''}
                    </Text>
                  </View>
                  {(m.status === 'rencana' || confirmed) && (
                    <Tap
                      onPress={() => updateMeetingStatus(m.id, confirmed ? 'rencana' : 'terkonfirmasi')}
                      accessibilityRole="button"
                      accessibilityLabel={confirmed ? 'Batalkan konfirmasi' : 'Konfirmasi rapat'}
                      scaleTo={0.9}
                      hitSlop={6}
                      style={[styles.badge, { backgroundColor: confirmed ? colors.success : colors.surfaceAlt }]}
                    >
                      <Icon
                        name={confirmed ? 'check_circle' : 'radio_button_unchecked'}
                        size={16}
                        color={confirmed ? colors.onPrimary : colors.textSecondary}
                      />
                      <Text style={[styles.badgeText, { color: confirmed ? colors.onPrimary : colors.text }]}>
                        {confirmed ? 'Siap' : 'Konfirmasi'}
                      </Text>
                    </Tap>
                  )}
                </View>
              </Card>
            </Animated.View>
          );
        })
      )}

      {/* Tugas prioritas */}
      <SectionHeader
        title="Tugas Prioritas"
        actionLabel="Tambah"
        onAction={() => setTaskSheet({ open: true, task: null })}
      />
      {priorityTasks.length === 0 ? (
        <Card>
          <EmptyState
            icon="task_alt"
            tone="q2"
            title="Tidak ada tugas prioritas"
            description="Tugas Q1 dan Q2 yang belum selesai muncul di sini."
          />
        </Card>
      ) : (
        priorityTasks.map((t, i) => (
          <Animated.View key={t.id} entering={FadeInDown.delay(i * 40).duration(300)}>
            <Card onPress={() => setTaskSheet({ open: true, task: t })} accessibilityLabel={`Tugas ${t.title}`}>
              <View style={styles.row}>
                <Tap
                  onPress={() => toggleTaskStatus(t.id, t.status)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: false }}
                  accessibilityLabel={`Selesai: ${t.title}`}
                  hitSlop={10}
                  scaleTo={0.8}
                  style={[styles.check, { borderColor: colors[qTone(t.quadrant)] }]}
                />
                <View style={styles.flex}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
                    {t.title}
                  </Text>
                  {t.due_at && (
                    <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                      Tenggat {format(t.due_at, 'd MMM, HH:mm', { locale: localeId })}
                    </Text>
                  )}
                </View>
                <View style={[styles.qChip, { backgroundColor: colors[`${qTone(t.quadrant)}Soft`] }]}>
                  <Text style={[styles.qChipText, { color: colors[qTone(t.quadrant)] }]}>{t.quadrant}</Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        ))
      )}

      {/* Ringkasan 4Q */}
      <SectionHeader
        title="Matrix 4Q"
        actionLabel="Buka"
        actionIcon="grid_view"
        onAction={() => router.push('/matrix?tab=grid')}
      />
      <View style={styles.grid}>
        {QUADRANTS.map(({ q, label }) => {
          const tone = qTone(q);
          const count = tasksTodo.filter((t) => t.quadrant === q).length;
          return (
            <Tap
              key={q}
              onPress={() => router.push('/matrix?tab=grid')}
              accessibilityRole="button"
              accessibilityLabel={`${q} ${label}: ${count} tugas`}
              style={[styles.quadrant, { backgroundColor: colors[`${tone}Soft`] }]}
            >
              <Text style={[styles.quadrantCount, { color: colors[tone] }]}>{count}</Text>
              <Text style={[styles.quadrantName, { color: colors[tone] }]}>{q}</Text>
              <Text style={[styles.quadrantLabel, { color: colors.text }]} numberOfLines={1}>
                {label}
              </Text>
            </Tap>
          );
        })}
      </View>

      <TaskFormSheet
        visible={taskSheet.open}
        task={taskSheet.task}
        onClose={() => setTaskSheet({ open: false, task: null })}
      />
      <MeetingFormSheet
        visible={meetingSheet.open}
        meeting={meetingSheet.meeting}
        onClose={() => setMeetingSheet({ open: false, meeting: null })}
      />
    </ScrollView>
  );
}

const Stat = ({ value, label }: { value: number; label: string }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface }]}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl * 2,
  },
  flex: {
    flex: 1,
  },
  hello: {
    ...tokens.typography.caption,
    textTransform: 'capitalize',
  },
  greeting: {
    ...tokens.typography.h1,
    marginBottom: tokens.spacing.md,
  },
  briefing: {
    padding: tokens.spacing.md + tokens.spacing.xs,
  },
  briefingTitle: {
    ...tokens.typography.caption,
    fontWeight: '700',
    marginBottom: tokens.spacing.sm + tokens.spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  stat: {
    flex: 1,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: tokens.spacing.sm + tokens.spacing.xs,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    ...tokens.typography.small,
    marginTop: 2,
  },
  tilesScroll: {
    marginHorizontal: -tokens.spacing.md,
  },
  tiles: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm + tokens.spacing.xs,
  },
  tile: {
    width: 112,
    height: 120,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.sm + tokens.spacing.xs,
    justifyContent: 'flex-end',
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: tokens.spacing.sm,
  },
  tileHint: {
    ...tokens.typography.small,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm + tokens.spacing.xs,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemMeta: {
    ...tokens.typography.small,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: tokens.borderRadius.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: tokens.borderRadius.full,
    borderWidth: 2.5,
  },
  qChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: tokens.borderRadius.full,
  },
  qChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm + tokens.spacing.xs,
  },
  quadrant: {
    width: '48%',
    flexGrow: 1,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.md,
  },
  quadrantCount: {
    fontSize: 30,
    fontWeight: '800',
  },
  quadrantName: {
    fontSize: 13,
    fontWeight: '800',
  },
  quadrantLabel: {
    ...tokens.typography.small,
    marginTop: 2,
  },
});
