import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { getTasksQuery, toggleTaskStatus } from '../../src/features/tasks/repository';
import { getMeetingsQuery, updateMeetingStatus } from '../../src/features/meetings/repository';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import { format, isToday } from 'date-fns';
import { useRouter } from 'expo-router';

export default function Dashboard() {
  const { colors } = useTheme();
  const router = useRouter();

  const { data: tasks } = useLiveQuery(getTasksQuery(), []);
  const { data: meetings } = useLiveQuery(getMeetingsQuery(), []);

  const todayMeetings = useMemo(() => meetings.filter((m) => isToday(m.start_at)), [meetings]);
  const confirmedMeetings = todayMeetings.filter((m) => m.status === 'terkonfirmasi').length;

  const priorityTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'todo' && (t.quadrant === 'Q1' || t.quadrant === 'Q2'));
  }, [tasks]);

  const tasksTodo = tasks.filter((t) => t.status === 'todo');
  const q1Count = tasksTodo.filter((t) => t.quadrant === 'Q1').length;
  const q2Count = tasksTodo.filter((t) => t.quadrant === 'Q2').length;
  const q3Count = tasksTodo.filter((t) => t.quadrant === 'Q3').length;
  const q4Count = tasksTodo.filter((t) => t.quadrant === 'Q4').length;

  const urgentTasksCount = tasksTodo.filter((t) => t.quadrant === 'Q1' || (t.due_at && isToday(t.due_at))).length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* Daily Briefing */}
      <Card style={{ backgroundColor: colors.primary }}>
        <Text style={[styles.sectionTitle, { color: colors.onPrimary }]}>Daily Briefing</Text>
        <Text style={{ color: colors.onPrimary, marginTop: 8 }}>
          Agenda Hari Ini: {todayMeetings.length} ({confirmedMeetings} Terkonfirmasi)
        </Text>
        <Text style={{ color: colors.onPrimary }}>Tugas Mendesak/Q1: {urgentTasksCount}</Text>
      </Card>

      {/* Agenda Hari Ini */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 8 }]}>Agenda Hari Ini</Text>
      {todayMeetings.length === 0 ? (
        <EmptyState title="Tidak ada agenda" description="Bebas agenda hari ini." />
      ) : (
        todayMeetings.map((m) => (
          <Card key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>{m.title}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {format(m.start_at, 'HH:mm')} - {format(m.end_at, 'HH:mm')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => updateMeetingStatus(m.id, m.status === 'terkonfirmasi' ? 'rencana' : 'terkonfirmasi')}
              style={{
                backgroundColor: m.status === 'terkonfirmasi' ? colors.success : colors.surface,
                padding: 8,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: m.status === 'terkonfirmasi' ? colors.onPrimary : colors.text, fontSize: 12 }}>
                {m.status === 'terkonfirmasi' ? 'Terkonfirmasi' : 'Konfirmasi'}
              </Text>
            </TouchableOpacity>
          </Card>
        ))
      )}

      {/* Tugas Prioritas */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 8 }]}>
        Tugas Prioritas (Q1 & Q2)
      </Text>
      {priorityTasks.slice(0, 5).map((t) => (
        <Card key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => toggleTaskStatus(t.id, t.status)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: colors[t.quadrant.toLowerCase() as keyof typeof colors],
              marginRight: 12,
              backgroundColor:
                t.status === 'done' ? colors[t.quadrant.toLowerCase() as keyof typeof colors] : 'transparent',
            }}
          />
          <Text
            style={{ color: colors.text, flex: 1, textDecorationLine: t.status === 'done' ? 'line-through' : 'none' }}
          >
            {t.title}
          </Text>
          <Text
            style={{ color: colors[t.quadrant.toLowerCase() as keyof typeof colors], fontSize: 12, fontWeight: 'bold' }}
          >
            {t.quadrant}
          </Text>
        </Card>
      ))}

      {/* Ringkasan 4Q */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 8 }]}>
        Ringkasan Matrix 4Q
      </Text>
      <TouchableOpacity onPress={() => router.push('/matrix')} style={styles.grid4Q}>
        <View style={styles.gridRow}>
          <View style={[styles.quadrantBox, { backgroundColor: colors.q1 + '20', borderColor: colors.q1 }]}>
            <Text style={{ color: colors.q1, fontWeight: 'bold' }}>Q1</Text>
            <Text style={{ color: colors.text }}>{q1Count} tugas</Text>
          </View>
          <View style={[styles.quadrantBox, { backgroundColor: colors.q2 + '20', borderColor: colors.q2 }]}>
            <Text style={{ color: colors.q2, fontWeight: 'bold' }}>Q2</Text>
            <Text style={{ color: colors.text }}>{q2Count} tugas</Text>
          </View>
        </View>
        <View style={styles.gridRow}>
          <View style={[styles.quadrantBox, { backgroundColor: colors.q3 + '20', borderColor: colors.q3 }]}>
            <Text style={{ color: colors.q3, fontWeight: 'bold' }}>Q3</Text>
            <Text style={{ color: colors.text }}>{q3Count} tugas</Text>
          </View>
          <View style={[styles.quadrantBox, { backgroundColor: colors.q4 + '20', borderColor: colors.q4 }]}>
            <Text style={{ color: colors.q4, fontWeight: 'bold' }}>Q4</Text>
            <Text style={{ color: colors.text }}>{q4Count} tugas</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  grid4Q: {
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quadrantBox: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
