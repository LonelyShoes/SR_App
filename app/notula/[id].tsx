import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { format, isValid, parse } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { getMeetingById, updateMeetingStatus, Meeting } from '../../src/features/meetings/repository';
import {
  ActionItem,
  MinuteInput,
  convertActionItemToTask,
  getMinuteByMeetingId,
  saveMinute,
  softDeleteMinute,
} from '../../src/features/minutes/repository';
import { exportMinutesPdf } from '../../src/features/minutes/pdf';
import {
  Attachment,
  deleteAttachmentFile,
  formatFileSize,
  openAttachment,
  pickAttachments,
} from '../../src/features/minutes/attachments';

const DUE_FORMAT = 'dd/MM/yyyy';

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

const toActionItems = (value: unknown): ActionItem[] => (Array.isArray(value) ? (value as ActionItem[]) : []);

const toAttachments = (value: unknown): Attachment[] => (Array.isArray(value) ? (value as Attachment[]) : []);

// `id` is the meeting id: each meeting has at most one notula.
export default function NotulaEditor() {
  const { id: meetingId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [minuteId, setMinuteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [discussion, setDiscussion] = useState('');
  const [decisions, setDecisions] = useState('');
  const [attendeesText, setAttendeesText] = useState('');
  const [items, setItems] = useState<ActionItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [draftText, setDraftText] = useState('');
  const [draftAssignee, setDraftAssignee] = useState('');
  const [draftDue, setDraftDue] = useState('');

  useEffect(() => {
    Promise.all([getMeetingById(meetingId), getMinuteByMeetingId(meetingId)]).then(([m, minute]) => {
      setMeeting(m);
      if (minute) {
        setMinuteId(minute.id);
        setDiscussion(minute.discussion ?? '');
        setDecisions(minute.decisions ?? '');
        setAttendeesText(toStringArray(minute.attendees).join('\n'));
        setItems(toActionItems(minute.action_items));
        setAttachments(toAttachments(minute.attachments));
      } else if (m) {
        // New notula: prefill from the meeting
        setAttendeesText(toStringArray(m.participants).join('\n'));
        setDiscussion(m.agenda ?? '');
      }
      setLoading(false);
    });
  }, [meetingId]);

  const buildInput = (
    actionItems: ActionItem[] = items,
    files: Attachment[] = attachments,
  ): MinuteInput => ({
    discussion,
    decisions,
    attendees: attendeesText
      .split('\n')
      .map((a) => a.trim())
      .filter(Boolean),
    action_items: actionItems,
    attachments: files,
  });

  const handleAddItem = () => {
    if (!draftText.trim()) return;
    let dueAt: number | null = null;
    if (draftDue.trim()) {
      const parsed = parse(draftDue.trim(), DUE_FORMAT, new Date());
      if (!isValid(parsed)) {
        Alert.alert('Tanggal tidak valid', 'Gunakan format hh/bb/tttt, misalnya 15/10/2026.');
        return;
      }
      parsed.setHours(23, 59, 0, 0);
      dueAt = parsed.getTime();
    }
    setItems([...items, { text: draftText.trim(), assignee: draftAssignee.trim() || null, due_at: dueAt }]);
    setDraftText('');
    setDraftAssignee('');
    setDraftDue('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleConvertItem = async (index: number) => {
    setBusy(true);
    try {
      const converted = await convertActionItemToTask(meetingId, items[index]);
      const next = items.map((item, i) => (i === index ? converted : item));
      setItems(next);
      // Persist right away so the task_id link survives leaving without saving
      setMinuteId(await saveMinute(meetingId, buildInput(next)));
    } finally {
      setBusy(false);
    }
  };

  // Attachment changes are saved right away: files are copied/deleted on disk
  // immediately, so the notula must stay in sync with them.
  const handleAddAttachments = async () => {
    setBusy(true);
    try {
      const added = await pickAttachments();
      if (added.length === 0) return;
      const next = [...attachments, ...added];
      setAttachments(next);
      setMinuteId(await saveMinute(meetingId, buildInput(items, next)));
    } catch (e) {
      Alert.alert('Gagal menambah lampiran', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAttachment = (attachment: Attachment) => {
    Alert.alert('Hapus lampiran?', attachment.name, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          const next = attachments.filter((a) => a.id !== attachment.id);
          setAttachments(next);
          setMinuteId(await saveMinute(meetingId, buildInput(items, next)));
          deleteAttachmentFile(attachment);
        },
      },
    ]);
  };

  const handleOpenAttachment = async (attachment: Attachment) => {
    try {
      await openAttachment(attachment);
    } catch (e) {
      Alert.alert('Gagal membuka lampiran', e instanceof Error ? e.message : String(e));
    }
  };

  const handleSave = async () => {
    if (!meeting) return;
    setBusy(true);
    try {
      setMinuteId(await saveMinute(meetingId, buildInput()));
    } finally {
      setBusy(false);
    }

    if (meeting.status === 'selesai') {
      router.back();
      return;
    }
    Alert.alert('Notula tersimpan', 'Tandai rapat ini sebagai selesai?', [
      { text: 'Nanti', style: 'cancel', onPress: () => router.back() },
      {
        text: 'Ya, selesai',
        onPress: async () => {
          await updateMeetingStatus(meetingId, 'selesai');
          router.back();
        },
      },
    ]);
  };

  const handleExport = async () => {
    if (!meeting) return;
    setBusy(true);
    try {
      await exportMinutesPdf(meeting, buildInput());
    } catch (e) {
      Alert.alert('Gagal mengekspor PDF', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (!minuteId) return;
    Alert.alert('Hapus notula?', 'Tugas yang sudah dibuat dari action item tidak ikut terhapus.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await softDeleteMinute(minuteId);
          router.back();
        },
      },
    ]);
  };

  const screenOptions = {
    headerShown: true,
    title: minuteId ? 'Edit Notula' : 'Notula Baru',
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={screenOptions} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={screenOptions} />
        <Text style={{ color: colors.textSecondary }}>Rapat tidak ditemukan.</Text>
      </View>
    );
  }

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="height">
      <Stack.Screen options={screenOptions} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={[tokens.typography.h3, { color: colors.text }]}>{meeting.title}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: tokens.spacing.xs }}>
            {format(meeting.start_at, 'EEEE, d MMM yyyy · HH:mm', { locale: localeId })}
            {meeting.location ? ` · ${meeting.location}` : ''}
          </Text>
          <Text style={{ color: colors.primary, marginTop: tokens.spacing.xs }}>Status: {meeting.status}</Text>
        </Card>

        <Text style={[styles.label, { color: colors.text }]}>Peserta hadir (satu nama per baris)</Text>
        <TextInput
          value={attendeesText}
          onChangeText={setAttendeesText}
          multiline
          placeholder="Nama peserta"
          placeholderTextColor={colors.textSecondary}
          style={[inputStyle, styles.multiline]}
        />

        <Text style={[styles.label, { color: colors.text }]}>Pembahasan</Text>
        <TextInput
          value={discussion}
          onChangeText={setDiscussion}
          multiline
          placeholder="Ringkasan pembahasan"
          placeholderTextColor={colors.textSecondary}
          style={[inputStyle, styles.multiline]}
        />

        <Text style={[styles.label, { color: colors.text }]}>Keputusan</Text>
        <TextInput
          value={decisions}
          onChangeText={setDecisions}
          multiline
          placeholder="Keputusan rapat"
          placeholderTextColor={colors.textSecondary}
          style={[inputStyle, styles.multiline]}
        />

        <Text style={[styles.label, { color: colors.text }]}>Action items</Text>
        {items.map((item, index) => (
          <Card key={`${index}-${item.text}`}>
            <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.text}</Text>
            <Text style={{ color: colors.textSecondary, marginTop: tokens.spacing.xs }}>
              PJ: {item.assignee ?? '-'} · Tenggat:{' '}
              {item.due_at ? format(item.due_at, 'd MMM yyyy', { locale: localeId }) : '-'}
            </Text>
            <View style={styles.itemActions}>
              {item.task_id ? (
                <Text style={{ color: colors.success }}>✓ Sudah jadi tugas</Text>
              ) : (
                <TouchableOpacity onPress={() => handleConvertItem(index)} disabled={busy} style={styles.linkBtn}>
                  <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Jadikan tugas</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleRemoveItem(index)} disabled={busy} style={styles.linkBtn}>
                <Text style={{ color: colors.error }}>Hapus</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        <Card>
          <TextInput
            value={draftText}
            onChangeText={setDraftText}
            placeholder="Tindak lanjut baru"
            placeholderTextColor={colors.textSecondary}
            style={inputStyle}
          />
          <View style={styles.row}>
            <TextInput
              value={draftAssignee}
              onChangeText={setDraftAssignee}
              placeholder="PJ (opsional)"
              placeholderTextColor={colors.textSecondary}
              style={[inputStyle, styles.flex]}
            />
            <TextInput
              value={draftDue}
              onChangeText={setDraftDue}
              placeholder="Tenggat hh/bb/tttt"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
              style={[inputStyle, styles.flex]}
            />
          </View>
          <Button title="Tambah action item" variant="secondary" onPress={handleAddItem} />
        </Card>

        <Text style={[styles.label, { color: colors.text }]}>Lampiran</Text>
        {attachments.map((attachment) => (
          <Card key={attachment.id} style={styles.attachmentRow}>
            <TouchableOpacity style={styles.flex} onPress={() => handleOpenAttachment(attachment)}>
              <Text style={{ color: colors.text }} numberOfLines={1}>
                📎 {attachment.name}
              </Text>
              {attachment.size != null && (
                <Text style={{ color: colors.textSecondary, ...tokens.typography.small }}>
                  {formatFileSize(attachment.size)}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleRemoveAttachment(attachment)} disabled={busy} style={styles.linkBtn}>
              <Text style={{ color: colors.error }}>Hapus</Text>
            </TouchableOpacity>
          </Card>
        ))}
        <Button title="Tambah lampiran" variant="secondary" onPress={handleAddAttachments} disabled={busy} />

        <View style={styles.footer}>
          <Button title="Simpan Notula" onPress={handleSave} loading={busy} />
          <Button title="Ekspor & Bagikan PDF" variant="secondary" onPress={handleExport} disabled={busy} />
          {minuteId && <Button title="Hapus Notula" variant="danger" onPress={handleDelete} disabled={busy} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
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
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  linkBtn: {
    paddingVertical: tokens.spacing.xs,
  },
  footer: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.lg,
  },
});
