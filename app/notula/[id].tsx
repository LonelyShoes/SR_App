import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import type { File } from 'expo-file-system';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { format, isValid, parse } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Field } from '../../src/components/Form';
import { Sheet } from '../../src/components/Sheet';
import { Tap } from '../../src/components/Tap';
import { Icon } from '../../src/components/Icon';
import { IconBubble } from '../../src/components/IconBubble';
import { SectionHeader } from '../../src/components/SectionHeader';
import { getMeetingById, updateMeetingStatus, Meeting } from '../../src/features/meetings/repository';
import {
  ActionItem,
  MinuteInput,
  convertActionItemToTask,
  getMinuteByMeetingId,
  saveMinute,
  softDeleteMinute,
} from '../../src/features/minutes/repository';
import {
  describePdfError,
  minutesPdfName,
  renderMinutesPdf,
  saveMinutesPdf,
  shareMinutesPdf,
} from '../../src/features/minutes/pdf';
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
  // Rendered PDF waiting for the user to pick share or save
  const [pdf, setPdf] = useState<File | null>(null);

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

  const buildInput = (actionItems: ActionItem[] = items, files: Attachment[] = attachments): MinuteInput => ({
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

  // Render first, then let the user choose where the PDF goes
  const handleExport = async () => {
    if (!meeting) return;
    setBusy(true);
    try {
      setPdf(await renderMinutesPdf(meeting, buildInput()));
    } catch (e) {
      Alert.alert('Gagal membuat PDF', describePdfError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSharePdf = async () => {
    if (!meeting || !pdf) return;
    setPdf(null);
    try {
      await shareMinutesPdf(pdf, meeting);
    } catch (e) {
      Alert.alert('Gagal membagikan PDF', describePdfError(e));
    }
  };

  const handleSavePdf = async () => {
    if (!meeting || !pdf) return;
    setPdf(null);
    try {
      if (await saveMinutesPdf(pdf, meeting)) {
        Alert.alert('PDF tersimpan', `${minutesPdfName(meeting)} tersimpan di folder yang kamu pilih.`);
      }
    } catch (e) {
      Alert.alert('Gagal menyimpan PDF', describePdfError(e));
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="height">
      <Stack.Screen options={screenOptions} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card tone="q4">
          <View style={styles.row}>
            <IconBubble name="groups" tone="q4" filled />
            <View style={styles.flex}>
              <Text style={[tokens.typography.h3, { color: colors.text }]}>{meeting.title}</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {format(meeting.start_at, 'EEEE, d MMM yyyy · HH:mm', { locale: localeId })}
                {meeting.location ? ` · ${meeting.location}` : ''}
              </Text>
            </View>
          </View>
        </Card>

        <SectionHeader title="Isi Notula" />
        <Field
          label="Peserta hadir (satu nama per baris)"
          value={attendeesText}
          onChangeText={setAttendeesText}
          multiline
          placeholder="Nama peserta"
        />
        <Field
          label="Pembahasan"
          value={discussion}
          onChangeText={setDiscussion}
          multiline
          placeholder="Ringkasan pembahasan"
        />
        <Field
          label="Keputusan"
          value={decisions}
          onChangeText={setDecisions}
          multiline
          placeholder="Keputusan rapat"
        />

        <SectionHeader title={`Action Items · ${items.length}`} />
        {items.map((item, index) => (
          <Card key={`${index}-${item.text}`}>
            <View style={styles.row}>
              <IconBubble
                name={item.task_id ? 'task_alt' : 'checklist'}
                tone={item.task_id ? 'success' : 'q2'}
                size={38}
              />
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>{item.text}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  PJ: {item.assignee ?? '-'} · Tenggat:{' '}
                  {item.due_at ? format(item.due_at, 'd MMM yyyy', { locale: localeId }) : '-'}
                </Text>
              </View>
              <Tap
                onPress={() => handleRemoveItem(index)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Hapus ${item.text}`}
                hitSlop={8}
                style={[styles.iconBtn, { backgroundColor: colors.errorSoft }]}
              >
                <Icon name="delete" size={18} color={colors.error} />
              </Tap>
            </View>
            {item.task_id ? (
              <Text style={[styles.meta, styles.itemFoot, { color: colors.success }]}>
                ✓ Sudah jadi tugas di Matrix
              </Text>
            ) : (
              <Button
                title="Jadikan tugas"
                icon="add_task"
                variant="secondary"
                onPress={() => handleConvertItem(index)}
                disabled={busy}
                style={styles.itemFoot}
              />
            )}
          </Card>
        ))}

        <Card tone="q2">
          <Field
            label="Tindak lanjut baru"
            value={draftText}
            onChangeText={setDraftText}
            placeholder="Contoh: Kirim proposal"
          />
          <View style={styles.formRow}>
            <Field
              flex
              label="PJ (opsional)"
              value={draftAssignee}
              onChangeText={setDraftAssignee}
              placeholder="Nama"
            />
            <Field
              flex
              label="Tenggat"
              value={draftDue}
              onChangeText={setDraftDue}
              placeholder="hh/bb/tttt"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <Button title="Tambah action item" icon="add" onPress={handleAddItem} />
        </Card>

        <SectionHeader
          title={`Lampiran · ${attachments.length}`}
          actionLabel="Tambah"
          actionIcon="attach_file"
          onAction={busy ? undefined : handleAddAttachments}
        />
        {attachments.length === 0 && (
          <Text style={[styles.meta, styles.emptyHint, { color: colors.textSecondary }]}>
            Belum ada lampiran. Tambahkan foto atau dokumen pendukung.
          </Text>
        )}
        {attachments.map((attachment) => (
          <Card
            key={attachment.id}
            onPress={() => handleOpenAttachment(attachment)}
            accessibilityLabel={`Buka ${attachment.name}`}
          >
            <View style={styles.row}>
              <IconBubble
                name={attachment.mime_type?.startsWith('image/') ? 'image' : 'attach_file'}
                tone="santai"
                size={38}
              />
              <View style={styles.flex}>
                <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                  {attachment.name}
                </Text>
                {attachment.size != null && (
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{formatFileSize(attachment.size)}</Text>
                )}
              </View>
              <Tap
                onPress={() => handleRemoveAttachment(attachment)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Hapus ${attachment.name}`}
                hitSlop={8}
                style={[styles.iconBtn, { backgroundColor: colors.errorSoft }]}
              >
                <Icon name="delete" size={18} color={colors.error} />
              </Tap>
            </View>
          </Card>
        ))}

        <View style={styles.footer}>
          <Button title="Simpan Notula" icon="check" size="lg" onPress={handleSave} loading={busy} />
          <Button
            title="Ekspor PDF"
            icon="picture_as_pdf"
            size="lg"
            variant="secondary"
            onPress={handleExport}
            disabled={busy}
          />
          {minuteId && (
            <Button title="Hapus Notula" icon="delete" variant="danger" onPress={handleDelete} disabled={busy} />
          )}
        </View>
      </ScrollView>

      <Sheet
        visible={pdf !== null}
        onClose={() => setPdf(null)}
        title="PDF siap"
        icon="picture_as_pdf"
        subtitle={meeting ? minutesPdfName(meeting) : undefined}
      >
        <View style={styles.footer}>
          <Button title="Bagikan (WA, Email, Drive…)" icon="share" size="lg" onPress={handleSharePdf} />
          <Button title="Simpan ke folder" icon="download" size="lg" variant="secondary" onPress={handleSavePdf} />
        </View>
      </Sheet>
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
    paddingBottom: tokens.spacing.xl * 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm + tokens.spacing.xs,
  },
  formRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  meta: {
    ...tokens.typography.small,
    marginTop: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemFoot: {
    marginTop: tokens.spacing.sm + tokens.spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: {
    marginBottom: tokens.spacing.sm,
  },
  footer: {
    gap: tokens.spacing.sm + tokens.spacing.xs,
    marginTop: tokens.spacing.lg,
  },
});
