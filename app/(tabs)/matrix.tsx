import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { getTasksQuery, toggleTaskStatus, createTask, softDeleteTask } from '../../src/features/tasks/repository';
import { getMeetingsQuery, createMeeting, softDeleteMeeting } from '../../src/features/meetings/repository';
import { Card } from '../../src/components/Card';
import { Sheet } from '../../src/components/Sheet';
import { Button } from '../../src/components/Button';
import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';

export default function Matrix() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'Tugas' | 'Rapat' | 'Grid 4Q'>('Tugas');

  const { data: tasks } = useLiveQuery(getTasksQuery(), []);
  const { data: meetings } = useLiveQuery(getMeetingsQuery(), []);
  
  // srapp://matrix?baru=tugas (Quick Action widget) opens the new-task sheet
  const { baru } = useLocalSearchParams<{ baru?: string }>();
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const isTaskModalOpen = taskSheetOpen || baru === 'tugas';
  const setIsTaskModalOpen = (open: boolean) => {
    setTaskSheetOpen(open);
    if (!open && baru) router.setParams({ baru: undefined });
  };
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskQuadrant, setNewTaskQuadrant] = useState('Q1');

  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');

  const handleSaveTask = async () => {
    if (!newTaskTitle.trim()) return;
    await createTask({ title: newTaskTitle, quadrant: newTaskQuadrant });
    setNewTaskTitle('');
    setIsTaskModalOpen(false);
  };

  const handleSaveMeeting = async () => {
    if (!newMeetingTitle.trim()) return;
    // For simplicity, default to today + 1 hour to today + 2 hours
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const end = new Date(now);
    end.setHours(end.getHours() + 1);

    await createMeeting({ 
      title: newMeetingTitle, 
      start_at: now.getTime(), 
      end_at: end.getTime(),
    });
    setNewMeetingTitle('');
    setIsMeetingModalOpen(false);
  };

  const tasksTodo = tasks.filter(t => t.status === 'todo');

  const renderTask = ({ item: t }: { item: typeof tasks[0] }) => (
    <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity 
        onPress={() => toggleTaskStatus(t.id, t.status)}
        style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors[t.quadrant.toLowerCase() as keyof typeof colors], marginRight: 12, backgroundColor: t.status === 'done' ? colors[t.quadrant.toLowerCase() as keyof typeof colors] : 'transparent' }} 
      />
      <Text style={{ color: colors.text, flex: 1, textDecorationLine: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</Text>
      <Text style={{ color: colors[t.quadrant.toLowerCase() as keyof typeof colors], fontSize: 12, fontWeight: 'bold' }}>{t.quadrant}</Text>
      <TouchableOpacity onPress={() => softDeleteTask(t.id)} style={{ marginLeft: 8, padding: 4 }}>
        <Text style={{ color: colors.error, fontSize: 12 }}>Hapus</Text>
      </TouchableOpacity>
    </Card>
  );

  const renderMeeting = ({ item: m }: { item: typeof meetings[0] }) => (
    <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: 'bold' }}>{m.title}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {format(m.start_at, 'dd MMM yyyy, HH:mm')} - {format(m.end_at, 'HH:mm')}
        </Text>
        <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4 }}>Status: {m.status}</Text>
      </View>
      {m.status !== 'batal' && (
        <TouchableOpacity onPress={() => router.push(`/notula/${m.id}`)} style={{ padding: 8 }}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold' }}>Notula</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => softDeleteMeeting(m.id)} style={{ padding: 8 }}>
        <Text style={{ color: colors.error, fontSize: 12 }}>Hapus</Text>
      </TouchableOpacity>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Segmented Control */}
      <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
        {['Tugas', 'Rapat', 'Grid 4Q'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.segmentBtn, tab === t && { backgroundColor: colors.primary }]}
            onPress={() => setTab(t as any)}
          >
            <Text style={{ color: tab === t ? '#FFF' : colors.text }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'Tugas' && (
        <View style={{ flex: 1 }}>
          <FlatList 
            data={tasksTodo}
            keyExtractor={t => t.id}
            renderItem={renderTask}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 32 }}>Belum ada tugas</Text>}
          />
          <View style={{ padding: 16 }}>
            <Button title="Tambah Tugas" onPress={() => setIsTaskModalOpen(true)} />
          </View>
        </View>
      )}

      {tab === 'Rapat' && (
        <View style={{ flex: 1 }}>
          <FlatList 
            data={meetings}
            keyExtractor={m => m.id}
            renderItem={renderMeeting}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 32 }}>Belum ada rapat/agenda</Text>}
          />
          <View style={{ padding: 16 }}>
            <Button title="Tambah Rapat" onPress={() => setIsMeetingModalOpen(true)} />
          </View>
        </View>
      )}

      {tab === 'Grid 4Q' && (
        <View style={{ flex: 1, padding: 16, gap: 8 }}>
          <View style={styles.gridRow}>
            <View style={[styles.quadrantBox, { backgroundColor: colors.q1 + '20', borderColor: colors.q1 }]}>
              <Text style={{ color: colors.q1, fontWeight: 'bold' }}>Q1 (Penting & Mendesak)</Text>
              <Text style={{ color: colors.text }}>{tasksTodo.filter(t => t.quadrant==='Q1').length}</Text>
            </View>
            <View style={[styles.quadrantBox, { backgroundColor: colors.q2 + '20', borderColor: colors.q2 }]}>
              <Text style={{ color: colors.q2, fontWeight: 'bold' }}>Q2 (Penting, Tdk Mendesak)</Text>
              <Text style={{ color: colors.text }}>{tasksTodo.filter(t => t.quadrant==='Q2').length}</Text>
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={[styles.quadrantBox, { backgroundColor: colors.q3 + '20', borderColor: colors.q3 }]}>
              <Text style={{ color: colors.q3, fontWeight: 'bold' }}>Q3 (Tdk Penting, Mendesak)</Text>
              <Text style={{ color: colors.text }}>{tasksTodo.filter(t => t.quadrant==='Q3').length}</Text>
            </View>
            <View style={[styles.quadrantBox, { backgroundColor: colors.q4 + '20', borderColor: colors.q4 }]}>
              <Text style={{ color: colors.q4, fontWeight: 'bold' }}>Q4 (Tdk Penting, Tdk Mend)</Text>
              <Text style={{ color: colors.text }}>{tasksTodo.filter(t => t.quadrant==='Q4').length}</Text>
            </View>
          </View>
        </View>
      )}

      <Sheet visible={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Tambah Tugas Baru">
        <TextInput
          placeholder="Judul Tugas"
          placeholderTextColor={colors.textSecondary}
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
            <TouchableOpacity 
              key={q} 
              style={[styles.qBtn, { borderColor: colors.border, backgroundColor: newTaskQuadrant === q ? colors.primary : colors.surface }]}
              onPress={() => setNewTaskQuadrant(q)}
            >
              <Text style={{ color: newTaskQuadrant === q ? '#FFF' : colors.text }}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button title="Simpan Tugas" onPress={handleSaveTask} />
      </Sheet>

      <Sheet visible={isMeetingModalOpen} onClose={() => setIsMeetingModalOpen(false)} title="Tambah Agenda Rapat">
        <TextInput
          placeholder="Judul Rapat (contoh: Sync Mingguan)"
          placeholderTextColor={colors.textSecondary}
          value={newMeetingTitle}
          onChangeText={setNewMeetingTitle}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <Button title="Simpan Rapat" onPress={handleSaveMeeting} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmented: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  qBtn: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  quadrantBox: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
});
