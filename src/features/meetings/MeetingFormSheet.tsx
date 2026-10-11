import React, { useState } from 'react';
import { Text, View, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { tokens } from '../../theme/tokens';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Field, FormRow, Segmented } from '../../components/Form';
import { combineDateTime, toDateText, toTimeText } from '../../lib/date-input';
import { getSettingSync } from '../settings/repository';
import { DEFAULT_REMINDER_OFFSET_MIN } from '../../notifications/scheduler';
import { Meeting, createMeeting, softDeleteMeeting, updateMeeting } from './repository';

type Status = 'rencana' | 'terkonfirmasi' | 'selesai' | 'batal';
type Reminder = 'default' | '10' | '15' | '30' | '60';

const STATUSES: { value: Status; label: string }[] = [
  { value: 'rencana', label: 'Rencana' },
  { value: 'terkonfirmasi', label: 'Konfirm' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'batal', label: 'Batal' },
];

const HOUR_MS = 60 * 60 * 1000;

/** Next whole hour from now, used as the default start of a new meeting. */
const nextHour = () => {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d.getTime();
};

const toList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

type Props = {
  visible: boolean;
  /** Meeting to edit; null/undefined creates a new one */
  meeting?: Meeting | null;
  onClose: () => void;
};

/** Add/edit a meeting plan (spec 6.2 + per-meeting reminder offset from 6.6). */
export function MeetingFormSheet({ visible, meeting, onClose }: Props) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={meeting ? 'Edit Rapat' : 'Tambah Rapat'}
      icon="event"
      subtitle="Pengingat dikirim sebelum rapat dimulai"
    >
      {visible && <MeetingForm key={meeting?.id ?? 'new'} meeting={meeting ?? null} onDone={onClose} />}
    </Sheet>
  );
}

function MeetingForm({ meeting, onDone }: { meeting: Meeting | null; onDone: () => void }) {
  const { colors } = useTheme();
  const start = meeting?.start_at ?? nextHour();
  const end = meeting?.end_at ?? start + HOUR_MS;
  const globalOffset = Number(getSettingSync('default_reminder_offset_min')) || DEFAULT_REMINDER_OFFSET_MIN;

  const [title, setTitle] = useState(meeting?.title ?? '');
  const [dateText, setDateText] = useState(toDateText(start));
  const [startText, setStartText] = useState(toTimeText(start));
  const [endText, setEndText] = useState(toTimeText(end));
  const [location, setLocation] = useState(meeting?.location ?? '');
  const [participants, setParticipants] = useState(toList(meeting?.participants).join('\n'));
  const [agenda, setAgenda] = useState(meeting?.agenda ?? '');
  const [status, setStatus] = useState<Status>((meeting?.status as Status) ?? 'rencana');
  const [reminder, setReminder] = useState<Reminder>(
    meeting?.reminder_offset_min != null ? (String(meeting.reminder_offset_min) as Reminder) : 'default',
  );
  const [error, setError] = useState<string | null>(null);

  const reminderOptions: { value: Reminder; label: string }[] = [
    { value: 'default', label: 'Default' },
    { value: '10', label: '10' },
    { value: '15', label: '15' },
    { value: '30', label: '30' },
    { value: '60', label: '60' },
  ];

  const save = async () => {
    if (!title.trim()) return setError('Judul tidak boleh kosong.');
    const startAt = combineDateTime(dateText, startText, { hour: 9, minute: 0 });
    const endAt = combineDateTime(dateText, endText, { hour: 10, minute: 0 });
    if (!startAt || !endAt) return setError('Tanggal (hh/bb/tttt) atau jam (JJ:mm) tidak valid.');
    if (endAt <= startAt) return setError('Jam selesai harus setelah jam mulai.');

    const data = {
      title: title.trim(),
      start_at: startAt.getTime(),
      end_at: endAt.getTime(),
      location: location.trim() || null,
      participants: participants
        .split(/[\n,]/)
        .map((p) => p.trim())
        .filter(Boolean),
      agenda: agenda.trim() || null,
      status,
      reminder_offset_min: reminder === 'default' ? null : Number(reminder),
    };
    // Repository writes reschedule the H-30 reminders
    if (meeting) await updateMeeting(meeting.id, data);
    else await createMeeting(data);
    onDone();
  };

  const remove = () => {
    if (!meeting) return;
    Alert.alert('Hapus rapat?', `${meeting.title}\nPengingatnya ikut dibatalkan.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await softDeleteMeeting(meeting.id);
          onDone();
        },
      },
    ]);
  };

  return (
    <View>
      <Field label="Judul" value={title} onChangeText={setTitle} placeholder="Contoh: Rapat evaluasi" />
      <Field
        label="Tanggal"
        value={dateText}
        onChangeText={setDateText}
        placeholder="hh/bb/tttt"
        keyboardType="numbers-and-punctuation"
      />
      <FormRow>
        <Field
          flex
          label="Mulai"
          value={startText}
          onChangeText={setStartText}
          placeholder="JJ:mm"
          keyboardType="numbers-and-punctuation"
        />
        <Field
          flex
          label="Selesai"
          value={endText}
          onChangeText={setEndText}
          placeholder="JJ:mm"
          keyboardType="numbers-and-punctuation"
        />
      </FormRow>
      <Field label="Lokasi" value={location} onChangeText={setLocation} placeholder="Opsional" />
      <Field
        label="Peserta (satu per baris)"
        value={participants}
        onChangeText={setParticipants}
        multiline
        placeholder="Opsional"
      />
      <Field label="Agenda" value={agenda} onChangeText={setAgenda} multiline placeholder="Opsional" />
      <Segmented label="Status" options={STATUSES} value={status} onChange={setStatus} />
      <Segmented label="Pengingat (menit sebelum)" options={reminderOptions} value={reminder} onChange={setReminder} />
      <Text style={{ color: colors.textSecondary, marginTop: -tokens.spacing.sm, marginBottom: tokens.spacing.md }}>
        Default: {globalOffset} menit (ubah di Pengaturan)
      </Text>
      {error && <Text style={{ color: colors.error, marginBottom: tokens.spacing.sm }}>{error}</Text>}
      <View style={{ gap: tokens.spacing.sm }}>
        <Button title="Simpan" icon="check" size="lg" onPress={save} />
        {meeting && <Button title="Hapus rapat" icon="delete" variant="danger" onPress={remove} />}
      </View>
    </View>
  );
}
