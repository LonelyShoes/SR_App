import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens, Accent, elevation } from '../../src/theme/tokens';
import { Card } from '../../src/components/Card';
import { Sheet } from '../../src/components/Sheet';
import { EmptyState } from '../../src/components/EmptyState';
import { Tap } from '../../src/components/Tap';
import { Icon } from '../../src/components/Icon';
import { IconBubble } from '../../src/components/IconBubble';
import { Task, getTasksQuery, toggleTaskStatus, updateTask } from '../../src/features/tasks/repository';
import { Meeting, getMeetingsQuery } from '../../src/features/meetings/repository';
import { TaskFormSheet } from '../../src/features/tasks/TaskFormSheet';
import { MeetingFormSheet } from '../../src/features/meetings/MeetingFormSheet';

type Tab = 'tugas' | 'rapat' | 'grid';
type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';

const TABS: { value: Tab; label: string }[] = [
  { value: 'tugas', label: 'Tugas' },
  { value: 'rapat', label: 'Rapat' },
  { value: 'grid', label: 'Grid 4Q' },
];

const QUADRANTS: { q: Quadrant; label: string }[] = [
  { q: 'Q1', label: 'Penting & Mendesak' },
  { q: 'Q2', label: 'Penting, Tdk Mendesak' },
  { q: 'Q3', label: 'Tdk Penting, Mendesak' },
  { q: 'Q4', label: 'Tdk Penting, Tdk Mendesak' },
];

const STATUS: Record<string, { label: string; tone: Accent }> = {
  rencana: { label: 'Rencana', tone: 'q4' },
  terkonfirmasi: { label: 'Terkonfirmasi', tone: 'primary' },
  selesai: { label: 'Selesai', tone: 'success' },
  batal: { label: 'Batal', tone: 'error' },
};

const formatDue = (ms: number) =>
  format(ms, format(ms, 'HH:mm') === '23:59' ? 'd MMM' : 'd MMM, HH:mm', { locale: localeId });

const qTone = (q: string) => q.toLowerCase() as Accent;

/**
 * Deep links:
 * - ?baru=tugas (Quick Action widget) opens the new-task sheet
 * - ?rapat=<id> (meeting reminder tap) opens that meeting
 * - ?tab=grid (Dashboard 4Q summary) opens the grid
 */
export default function Matrix() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ baru?: string; rapat?: string; tab?: Tab }>();
  const [tab, setTab] = useState<Tab>('tugas');

  const { data: tasks } = useLiveQuery(getTasksQuery(), []);
  const { data: meetings } = useLiveQuery(getMeetingsQuery(), []);

  const [taskSheet, setTaskSheet] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [meetingSheet, setMeetingSheet] = useState<{ open: boolean; meeting: Meeting | null }>({
    open: false,
    meeting: null,
  });
  const [moving, setMoving] = useState<Task | null>(null);
  // Snapshot of the time for the overdue highlight (render must stay pure)
  const [now] = useState(Date.now);

  // Params win until the sheet they opened is closed
  const linkedMeeting = params.rapat ? (meetings.find((m) => m.id === params.rapat) ?? null) : null;
  const activeTab: Tab = linkedMeeting ? 'rapat' : (params.tab ?? tab);
  const taskSheetOpen = taskSheet.open || params.baru === 'tugas';
  const meetingSheetOpen = meetingSheet.open || linkedMeeting !== null;
  const editingMeeting = meetingSheet.meeting ?? linkedMeeting;

  const clearParams = () => {
    if (params.baru || params.rapat || params.tab)
      router.setParams({ baru: undefined, rapat: undefined, tab: undefined });
  };
  const closeTaskSheet = () => {
    setTaskSheet({ open: false, task: null });
    clearParams();
  };
  const closeMeetingSheet = () => {
    setMeetingSheet({ open: false, meeting: null });
    clearParams();
  };
  const selectTab = (t: Tab) => {
    setTab(t);
    clearParams();
  };

  const tasksTodo = tasks.filter((t) => t.status === 'todo');

  const renderTask = ({ item: t, index }: { item: Task; index: number }) => {
    const tone = qTone(t.quadrant);
    const overdue = t.due_at != null && t.due_at < now;
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(280)} layout={LinearTransition}>
        <Card onPress={() => setTaskSheet({ open: true, task: t })} accessibilityLabel={`Tugas ${t.title}`}>
          <View style={styles.row}>
            <Check task={t} />
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{t.title}</Text>
              {t.due_at != null && (
                <View style={styles.metaRow}>
                  <Icon name="schedule" size={14} color={overdue ? colors.error : colors.textSecondary} />
                  <Text style={[styles.meta, { color: overdue ? colors.error : colors.textSecondary }]}>
                    {overdue ? 'Lewat tenggat · ' : ''}
                    {formatDue(t.due_at)}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.chip, { backgroundColor: colors[`${tone}Soft`] }]}>
              <Text style={[styles.chipText, { color: colors[tone] }]}>{t.quadrant}</Text>
            </View>
          </View>
        </Card>
      </Animated.View>
    );
  };

  const renderMeeting = ({ item: m, index }: { item: Meeting; index: number }) => {
    const status = STATUS[m.status] ?? { label: m.status, tone: 'q4' as Accent };
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(280)}>
        <Card onPress={() => setMeetingSheet({ open: true, meeting: m })} accessibilityLabel={`Rapat ${m.title}`}>
          <View style={styles.row}>
            <View style={[styles.dateBox, { backgroundColor: colors.santaiSoft }]}>
              <Text style={[styles.dateDay, { color: colors.santai }]}>{format(m.start_at, 'd')}</Text>
              <Text style={[styles.dateMonth, { color: colors.santai }]}>
                {format(m.start_at, 'MMM', { locale: localeId })}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                {m.title}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                {format(m.start_at, 'EEE, HH:mm', { locale: localeId })}–{format(m.end_at, 'HH:mm')}
                {m.location ? ` · ${m.location}` : ''}
              </Text>
              <View style={[styles.chip, styles.statusChip, { backgroundColor: colors[`${status.tone}Soft`] }]}>
                <Text style={[styles.chipText, { color: colors[status.tone] }]}>{status.label}</Text>
              </View>
            </View>
            {m.status !== 'batal' && (
              <Tap
                onPress={() => router.push(`/notula/${m.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Notula ${m.title}`}
                scaleTo={0.9}
                hitSlop={6}
                style={[styles.roundBtn, { backgroundColor: colors.primarySoft }]}
              >
                <Icon name="edit_note" size={22} color={colors.primary} />
              </Tap>
            )}
          </View>
        </Card>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
        {TABS.map((t) => {
          const active = activeTab === t.value;
          return (
            <Tap
              key={t.value}
              style={[styles.segmentBtn, active && { backgroundColor: colors.surface }, active && elevation(colors)]}
              onPress={() => selectTab(t.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              scaleTo={0.95}
            >
              <Text
                style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: active ? '800' : '600' }}
              >
                {t.label}
              </Text>
            </Tap>
          );
        })}
      </View>

      {activeTab === 'tugas' && (
        <View style={styles.flex}>
          <FlatList
            data={tasksTodo}
            keyExtractor={(t) => t.id}
            renderItem={renderTask}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                icon="task_alt"
                tone="q2"
                title="Belum ada tugas"
                description="Ketuk Tambah Tugas untuk mulai mengatur prioritasmu."
              />
            }
          />
          <Fab label="Tambah Tugas" onPress={() => setTaskSheet({ open: true, task: null })} />
        </View>
      )}

      {activeTab === 'rapat' && (
        <View style={styles.flex}>
          <FlatList
            data={meetings}
            keyExtractor={(m) => m.id}
            renderItem={renderMeeting}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                icon="event"
                tone="santai"
                title="Belum ada rapat"
                description="Rencanakan rapat dan dapatkan pengingat sebelum mulai."
              />
            }
          />
          <Fab label="Tambah Rapat" onPress={() => setMeetingSheet({ open: true, meeting: null })} />
        </View>
      )}

      {activeTab === 'grid' && (
        <View style={styles.grid}>
          {[QUADRANTS.slice(0, 2), QUADRANTS.slice(2)].map((pair, i) => (
            <View key={i} style={styles.gridRow}>
              {pair.map(({ q, label }) => {
                const tone = qTone(q);
                const items = tasksTodo.filter((t) => t.quadrant === q);
                return (
                  <View key={q} style={[styles.quadrant, { backgroundColor: colors[`${tone}Soft`] }]}>
                    <View style={styles.quadrantHead}>
                      <Text style={[styles.quadrantName, { color: colors[tone] }]}>{q}</Text>
                      <View style={[styles.countBubble, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.chipText, { color: colors[tone] }]}>{items.length}</Text>
                      </View>
                    </View>
                    <Text style={[styles.meta, { color: colors.text }]} numberOfLines={1}>
                      {label}
                    </Text>
                    <ScrollView style={styles.flex} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {items.map((t) => (
                        <Tap
                          key={t.id}
                          style={[styles.gridItem, { backgroundColor: colors.surface }]}
                          onPress={() => setTaskSheet({ open: true, task: t })}
                          onLongPress={() => setMoving(t)}
                          accessibilityHint="Tahan untuk memindah kuadran"
                        >
                          <Check task={t} />
                          <Text style={[styles.flex, styles.gridText, { color: colors.text }]} numberOfLines={2}>
                            {t.title}
                          </Text>
                        </Tap>
                      ))}
                    </ScrollView>
                  </View>
                );
              })}
            </View>
          ))}
          <View style={styles.hintRow}>
            <Icon name="touch_app" size={16} color={colors.textSecondary} />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Tahan tugas untuk memindah kuadran</Text>
          </View>
        </View>
      )}

      <TaskFormSheet visible={taskSheetOpen} task={taskSheet.task} onClose={closeTaskSheet} />
      <MeetingFormSheet visible={meetingSheetOpen} meeting={editingMeeting} onClose={closeMeetingSheet} />

      <Sheet
        visible={moving !== null}
        onClose={() => setMoving(null)}
        title="Pindah ke kuadran"
        icon="swap_vert"
        subtitle={moving?.title}
      >
        {moving && (
          <View style={{ gap: tokens.spacing.sm }}>
            {QUADRANTS.filter(({ q }) => q !== moving.quadrant).map(({ q, label }) => (
              <Card
                key={q}
                tone={qTone(q)}
                style={styles.moveOption}
                onPress={async () => {
                  await updateTask(moving.id, { quadrant: q });
                  setMoving(null);
                }}
                accessibilityLabel={`Pindah ke ${q} ${label}`}
              >
                <View style={styles.row}>
                  <IconBubble name="grid_view" tone={qTone(q)} filled size={36} />
                  <Text style={[styles.itemTitle, { color: colors[qTone(q)] }]}>{q}</Text>
                  <Text style={[styles.flex, { color: colors.text }]}>{label}</Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </Sheet>
    </View>
  );
}

/** Round checkbox in the task's quadrant color. */
const Check = ({ task }: { task: Task }) => {
  const { colors } = useTheme();
  const done = task.status === 'done';
  const tone = qTone(task.quadrant);
  return (
    <Tap
      onPress={() => toggleTaskStatus(task.id, task.status)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`Selesai: ${task.title}`}
      hitSlop={10}
      scaleTo={0.8}
      style={[styles.check, { borderColor: colors[tone], backgroundColor: done ? colors[tone] : 'transparent' }]}
    >
      {done && <Icon name="check" size={16} color={colors.onPrimary} />}
    </Tap>
  );
};

/** Floating add button above the list. */
const Fab = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.92}
      style={[styles.fab, { backgroundColor: colors.primary }, elevation(colors, 2)]}
    >
      <Icon name="add" size={24} color={colors.onPrimary} />
      <Text style={[styles.fabText, { color: colors.onPrimary }]}>{label}</Text>
    </Tap>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  segmented: {
    flexDirection: 'row',
    margin: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.full,
    padding: tokens.spacing.xs,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: tokens.spacing.sm + 2,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.full,
  },
  list: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: 96,
    flexGrow: 1,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  meta: {
    ...tokens.typography.small,
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: tokens.borderRadius.full,
  },
  statusChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: tokens.borderRadius.full,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBox: {
    width: 50,
    height: 54,
    borderRadius: tokens.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 20,
    fontWeight: '800',
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: tokens.spacing.md,
    bottom: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 20,
    borderRadius: tokens.borderRadius.full,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '800',
  },
  grid: {
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    gap: tokens.spacing.sm + tokens.spacing.xs,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: tokens.spacing.sm + tokens.spacing.xs,
  },
  quadrant: {
    flex: 1,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.sm + tokens.spacing.xs,
    gap: 2,
  },
  quadrantHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quadrantName: {
    fontSize: 18,
    fontWeight: '800',
  },
  countBubble: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.full,
    alignItems: 'center',
  },
  gridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.md,
    marginTop: tokens.spacing.xs + 2,
  },
  gridText: {
    fontSize: 13,
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  hint: {
    ...tokens.typography.small,
  },
  moveOption: {
    marginBottom: 0,
  },
});
