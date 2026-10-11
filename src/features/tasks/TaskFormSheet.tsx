import React, { useState } from 'react';
import { Text, View, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { tokens } from '../../theme/tokens';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Field, FormRow, Segmented } from '../../components/Form';
import { combineDateTime, toDateText, toTimeText } from '../../lib/date-input';
import { Task, createTask, softDeleteTask, updateTask } from './repository';

type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';

const QUADRANTS: { value: Quadrant; label: string }[] = [
  { value: 'Q1', label: 'Q1' },
  { value: 'Q2', label: 'Q2' },
  { value: 'Q3', label: 'Q3' },
  { value: 'Q4', label: 'Q4' },
];

const QUADRANT_HINT: Record<Quadrant, string> = {
  Q1: 'Penting & mendesak',
  Q2: 'Penting, tidak mendesak',
  Q3: 'Tidak penting, mendesak',
  Q4: 'Tidak penting, tidak mendesak',
};

// A task due "on a day" without a time is due at the end of that day
const END_OF_DAY = { hour: 23, minute: 59 };

type Props = {
  visible: boolean;
  /** Task to edit; null/undefined creates a new one */
  task?: Task | null;
  onClose: () => void;
};

/** Add/edit a task: title, quadrant, due date/time, notes (spec 6.2). */
export function TaskFormSheet({ visible, task, onClose }: Props) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={task ? 'Edit Tugas' : 'Tambah Tugas'}
      icon="add_task"
      subtitle="Tentukan kuadran agar prioritas jelas"
    >
      {/* Keyed so the form resets whenever another task is opened */}
      {visible && <TaskForm key={task?.id ?? 'new'} task={task ?? null} onDone={onClose} />}
    </Sheet>
  );
}

function TaskForm({ task, onDone }: { task: Task | null; onDone: () => void }) {
  const { colors } = useTheme();
  const [title, setTitle] = useState(task?.title ?? '');
  const [quadrant, setQuadrant] = useState<Quadrant>((task?.quadrant as Quadrant) ?? 'Q1');
  const [dateText, setDateText] = useState(toDateText(task?.due_at));
  const [timeText, setTimeText] = useState(
    task?.due_at && toTimeText(task.due_at) !== '23:59' ? toTimeText(task.due_at) : '',
  );
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) return setError('Judul tidak boleh kosong.');
    let dueAt: number | null = null;
    if (dateText.trim()) {
      const due = combineDateTime(dateText, timeText, END_OF_DAY);
      if (!due) return setError('Tanggal (hh/bb/tttt) atau jam (JJ:mm) tidak valid.');
      dueAt = due.getTime();
    } else if (timeText.trim()) {
      return setError('Isi tanggal tenggat juga, atau kosongkan jamnya.');
    }
    const data = { title: title.trim(), quadrant, due_at: dueAt, notes: notes.trim() || null };
    if (task) await updateTask(task.id, data);
    else await createTask(data);
    onDone();
  };

  const remove = () => {
    if (!task) return;
    Alert.alert('Hapus tugas?', task.title, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await softDeleteTask(task.id);
          onDone();
        },
      },
    ]);
  };

  return (
    <View>
      <Field label="Judul" value={title} onChangeText={setTitle} placeholder="Contoh: Kirim laporan" />
      <Segmented label="Kuadran" options={QUADRANTS} value={quadrant} onChange={setQuadrant} />
      <Text style={{ color: colors.textSecondary, marginTop: -tokens.spacing.sm, marginBottom: tokens.spacing.md }}>
        {QUADRANT_HINT[quadrant]}
      </Text>
      <FormRow>
        <Field
          flex
          label="Tenggat (opsional)"
          value={dateText}
          onChangeText={setDateText}
          placeholder="hh/bb/tttt"
          keyboardType="numbers-and-punctuation"
        />
        <Field
          flex
          label="Jam"
          value={timeText}
          onChangeText={setTimeText}
          placeholder="JJ:mm"
          keyboardType="numbers-and-punctuation"
        />
      </FormRow>
      <Field label="Catatan" value={notes} onChangeText={setNotes} multiline placeholder="Opsional" />
      {error && <Text style={{ color: colors.error, marginBottom: tokens.spacing.sm }}>{error}</Text>}
      <View style={{ gap: tokens.spacing.sm }}>
        <Button title="Simpan" icon="check" size="lg" onPress={save} />
        {task && <Button title="Hapus tugas" icon="delete" variant="danger" onPress={remove} />}
      </View>
    </View>
  );
}
