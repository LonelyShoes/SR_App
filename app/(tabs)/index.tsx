import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { format, isSameDay } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens } from '../../src/theme/tokens';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import { Task, getTasksQuery, toggleTaskStatus } from '../../src/features/tasks/repository';
import { Meeting, getMeetingsQuery, updateMeetingStatus } from '../../src/features/meetings/repository';
import { TaskFormSheet } from '../../src/features/tasks/TaskFormSheet';
import { MeetingFormSheet } from '../../src/features/meetings/MeetingFormSheet';
import { summarizeDashboard } from '../../src/widgets/dashboard-data';

const PRIORITY_LIMIT = 5;
const QUADRANTS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

export default function Dashboard() {
  const { colors } = useTheme();
  const { data: tasks } = useLiveQuery(getTasksQuery(), []);
  const { data: meetings } = useLiveQuery(getMeetingsQuery(), []);

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
  const qColor = (q: string) => colors[q.toLowerCase() as 'q1' | 'q2' | 'q3' | 'q4'] ?? colors.primary;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Daily briefing */}
      <Card style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
        <Text style={[styles.sectionTitle, { color: colors.onPrimary }]}>Daily Briefing</Text>
        <Text style={{ color: colors.onPrimary, marginTop: tokens.spacing.sm }}>
          {summary.agendaToday} agenda hari ini · {summary.confirmedToday} terkonfirmasi
        </Text>
        <Text style={{ color: colors.onPrimary }}>
          {summary.urgentTasks} tugas harus dikerjakan (Q1 / tenggat hari ini)
        </Text>
      </Card>

      {/* Agenda hari ini */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Agenda Hari Ini</Text>
        <TouchableOpacity onPress={() => setMeetingSheet({ open: true, meeting: null })} style={styles.linkBtn}>
          <Text style={{ color: colors.primary, fontWeight: 'bold' }}>+ Tambah</Text>
        </TouchableOpacity>
      </View>
      {todayMeetings.length === 0 ? (
        <Card>
          <Text style={{ color: colors.textSecondary }}>Bebas agenda hari ini.</Text>
        </Card>
      ) : (
        todayMeetings.map((m) => {
          const confirmed = m.status === 'terkonfirmasi';
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => setMeetingSheet({ open: true, meeting: m })}
              activeOpacity={0.7}
            >
              <Card style={styles.row}>
                <View style={styles.flex}>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>{m.title}</Text>
                  <Text style={{ color: colors.textSecondary, ...tokens.typography.small }}>
                    {format(m.start_at, 'HH:mm')}–{format(m.end_at, 'HH:mm')}
                    {m.location ? ` · ${m.location}` : ''}
                  </Text>
                </View>
                {(m.status === 'rencana' || confirmed) && (
                  <TouchableOpacity
                    onPress={() => updateMeetingStatus(m.id, confirmed ? 'rencana' : 'terkonfirmasi')}
                    accessibilityRole="button"
                    style={[styles.badge, { backgroundColor: confirmed ? colors.success : colors.surface }]}
                  >
                    <Text style={{ ...tokens.typography.small, color: confirmed ? colors.onPrimary : colors.text }}>
                      {confirmed ? '✓ Terkonfirmasi' : 'Konfirmasi'}
                    </Text>
                  </TouchableOpacity>
                )}
              </Card>
            </TouchableOpacity>
          );
        })
      )}

      {/* Tugas prioritas */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tugas Prioritas</Text>
        <TouchableOpacity onPress={() => setTaskSheet({ open: true, task: null })} style={styles.linkBtn}>
          <Text style={{ color: colors.primary, fontWeight: 'bold' }}>+ Tambah</Text>
        </TouchableOpacity>
      </View>
      {priorityTasks.length === 0 ? (
        <EmptyState
          title="Tidak ada tugas prioritas"
          description="Tugas Q1 dan Q2 yang belum selesai muncul di sini."
        />
      ) : (
        priorityTasks.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setTaskSheet({ open: true, task: t })} activeOpacity={0.7}>
            <Card style={styles.row}>
              <TouchableOpacity
                onPress={() => toggleTaskStatus(t.id, t.status)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={`Selesai: ${t.title}`}
                hitSlop={8}
                style={[styles.check, { borderColor: qColor(t.quadrant) }]}
              />
              <Text style={[styles.flex, { color: colors.text }]}>{t.title}</Text>
              <Text style={{ ...tokens.typography.small, color: qColor(t.quadrant), fontWeight: 'bold' }}>
                {t.quadrant}
              </Text>
            </Card>
          </TouchableOpacity>
        ))
      )}

      {/* Ringkasan 4Q */}
      <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: colors.text }]}>Ringkasan Matrix 4Q</Text>
      <TouchableOpacity
        onPress={() => router.push('/matrix?tab=grid')}
        accessibilityRole="button"
        accessibilityLabel="Buka grid Matrix 4Q"
        style={styles.grid}
      >
        {[QUADRANTS.slice(0, 2), QUADRANTS.slice(2)].map((pair, i) => (
          <View key={i} style={styles.gridRow}>
            {pair.map((q) => (
              <View key={q} style={[styles.quadrantBox, { borderColor: qColor(q), backgroundColor: colors.surface }]}>
                <Text style={{ color: qColor(q), fontWeight: 'bold' }}>{q}</Text>
                <Text style={{ color: colors.text }}>{tasksTodo.filter((t) => t.quadrant === q).length} tugas</Text>
              </View>
            ))}
          </View>
        ))}
      </TouchableOpacity>

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

const styles = StyleSheet.create({
  content: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  flex: {
    flex: 1,
  },
  sectionTitle: {
    ...tokens.typography.h3,
  },
  sectionSpacing: {
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  linkBtn: {
    padding: tokens.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  badge: {
    paddingVertical: tokens.spacing.xs + 2,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.sm,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: tokens.borderRadius.full,
    borderWidth: 2,
  },
  grid: {
    gap: tokens.spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  quadrantBox: {
    flex: 1,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
});
