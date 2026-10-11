import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens } from '../../src/theme/tokens';
import { Card } from '../../src/components/Card';
import { Sheet } from '../../src/components/Sheet';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
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

const STATUS_LABEL: Record<string, string> = {
  rencana: 'Rencana',
  terkonfirmasi: 'Terkonfirmasi',
  selesai: 'Selesai',
  batal: 'Batal',
};

const formatDue = (ms: number) =>
  format(ms, format(ms, 'HH:mm') === '23:59' ? 'd MMM' : 'd MMM, HH:mm', { locale: localeId });

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
  const qColor = (q: string) => colors[q.toLowerCase() as 'q1' | 'q2' | 'q3' | 'q4'] ?? colors.primary;

  const Check = ({ task }: { task: Task }) => (
    <TouchableOpacity
      onPress={() => toggleTaskStatus(task.id, task.status)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.status === 'done' }}
      accessibilityLabel={`Selesai: ${task.title}`}
      hitSlop={8}
      style={[
        styles.check,
        {
          borderColor: qColor(task.quadrant),
          backgroundColor: task.status === 'done' ? qColor(task.quadrant) : 'transparent',
        },
      ]}
    />
  );

  const renderTask = ({ item: t }: { item: Task }) => (
    <TouchableOpacity onPress={() => setTaskSheet({ open: true, task: t })} activeOpacity={0.7}>
      <Card style={styles.row}>
        <Check task={t} />
        <View style={styles.flex}>
          <Text style={{ color: colors.text }}>{t.title}</Text>
          {t.due_at != null && (
            <Text style={{ color: t.due_at < now ? colors.error : colors.textSecondary, ...tokens.typography.small }}>
              Tenggat {formatDue(t.due_at)}
            </Text>
          )}
        </View>
        <Text style={{ ...tokens.typography.small, color: qColor(t.quadrant), fontWeight: 'bold' }}>{t.quadrant}</Text>
      </Card>
    </TouchableOpacity>
  );

  const renderMeeting = ({ item: m }: { item: Meeting }) => (
    <TouchableOpacity onPress={() => setMeetingSheet({ open: true, meeting: m })} activeOpacity={0.7}>
      <Card style={styles.row}>
        <View style={styles.flex}>
          <Text style={{ color: colors.text, fontWeight: 'bold' }}>{m.title}</Text>
          <Text style={{ color: colors.textSecondary, ...tokens.typography.small }}>
            {format(m.start_at, 'EEE, d MMM yyyy · HH:mm', { locale: localeId })}–{format(m.end_at, 'HH:mm')}
            {m.location ? ` · ${m.location}` : ''}
          </Text>
          <Text style={{ color: m.status === 'batal' ? colors.error : colors.primary, ...tokens.typography.small }}>
            {STATUS_LABEL[m.status] ?? m.status}
          </Text>
        </View>
        {m.status !== 'batal' && (
          <TouchableOpacity onPress={() => router.push(`/notula/${m.id}`)} style={styles.linkBtn}>
            <Text style={{ ...tokens.typography.small, color: colors.primary, fontWeight: 'bold' }}>Notula</Text>
          </TouchableOpacity>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.segmentBtn, activeTab === t.value && { backgroundColor: colors.primary }]}
            onPress={() => selectTab(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === t.value }}
          >
            <Text style={{ color: activeTab === t.value ? colors.onPrimary : colors.text }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'tugas' && (
        <View style={styles.flex}>
          <FlatList
            data={tasksTodo}
            keyExtractor={(t) => t.id}
            renderItem={renderTask}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<EmptyState title="Belum ada tugas" description="Tambahkan tugas pertama di bawah." />}
          />
          <View style={styles.footer}>
            <Button title="Tambah Tugas" onPress={() => setTaskSheet({ open: true, task: null })} />
          </View>
        </View>
      )}

      {activeTab === 'rapat' && (
        <View style={styles.flex}>
          <FlatList
            data={meetings}
            keyExtractor={(m) => m.id}
            renderItem={renderMeeting}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<EmptyState title="Belum ada rapat" description="Rencanakan rapat di bawah." />}
          />
          <View style={styles.footer}>
            <Button title="Tambah Rapat" onPress={() => setMeetingSheet({ open: true, meeting: null })} />
          </View>
        </View>
      )}

      {activeTab === 'grid' && (
        <View style={styles.grid}>
          {[QUADRANTS.slice(0, 2), QUADRANTS.slice(2)].map((pair, i) => (
            <View key={i} style={styles.gridRow}>
              {pair.map(({ q, label }) => {
                const items = tasksTodo.filter((t) => t.quadrant === q);
                return (
                  <View key={q} style={[styles.quadrant, { borderColor: qColor(q), backgroundColor: colors.surface }]}>
                    <Text style={{ color: qColor(q), fontWeight: 'bold' }}>
                      {q} · {items.length}
                    </Text>
                    <Text style={{ color: colors.textSecondary, ...tokens.typography.small }}>{label}</Text>
                    <ScrollView style={styles.flex} nestedScrollEnabled>
                      {items.map((t) => (
                        <TouchableOpacity
                          key={t.id}
                          style={styles.gridItem}
                          onPress={() => setTaskSheet({ open: true, task: t })}
                          onLongPress={() => setMoving(t)}
                          accessibilityHint="Tahan untuk memindah kuadran"
                        >
                          <Check task={t} />
                          <Text style={[styles.flex, { color: colors.text }]} numberOfLines={2}>
                            {t.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                );
              })}
            </View>
          ))}
          <Text style={[styles.hint, { color: colors.textSecondary }]}>Tahan tugas untuk memindah kuadran</Text>
        </View>
      )}

      <TaskFormSheet visible={taskSheetOpen} task={taskSheet.task} onClose={closeTaskSheet} />
      <MeetingFormSheet visible={meetingSheetOpen} meeting={editingMeeting} onClose={closeMeetingSheet} />

      <Sheet visible={moving !== null} onClose={() => setMoving(null)} title="Pindah ke kuadran">
        {moving && (
          <View style={{ gap: tokens.spacing.sm }}>
            <Text style={{ color: colors.textSecondary }}>{moving.title}</Text>
            {QUADRANTS.filter(({ q }) => q !== moving.quadrant).map(({ q, label }) => (
              <Button
                key={q}
                title={`${q} · ${label}`}
                variant="secondary"
                onPress={async () => {
                  await updateTask(moving.id, { quadrant: q });
                  setMoving(null);
                }}
              />
            ))}
          </View>
        )}
      </Sheet>
    </View>
  );
}

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
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.xs,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.sm,
  },
  list: {
    paddingHorizontal: tokens.spacing.md,
    flexGrow: 1,
  },
  footer: {
    padding: tokens.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: tokens.borderRadius.full,
    borderWidth: 2,
  },
  linkBtn: {
    padding: tokens.spacing.sm,
  },
  grid: {
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  quadrant: {
    flex: 1,
    borderWidth: 1,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.sm,
  },
  gridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  hint: {
    ...tokens.typography.small,
    textAlign: 'center',
  },
});
