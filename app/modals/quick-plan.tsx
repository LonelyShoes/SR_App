import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { parseQuickPlan } from '../../src/lib/date-parser-id';
import { useSpeechInput } from '../../src/features/voice/use-speech-input';
import { Quadrant, QuickPlanForm, draftToForm, saveQuickPlan } from '../../src/features/voice/quick-plan';

const QUADRANTS: Quadrant[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function QuickPlan() {
  const { colors } = useTheme();
  const [transcript, setTranscript] = useState('');
  const [form, setForm] = useState<QuickPlanForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const process = (text: string) => {
    setSaveError(null);
    setForm(text.trim() ? draftToForm(parseQuickPlan(text)) : null);
  };

  const speech = useSpeechInput((finalText) => {
    setTranscript(finalText);
    process(finalText);
  });

  const update = (patch: Partial<QuickPlanForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const error = await saveQuickPlan(form);
    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }
    router.back();
  };

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border }];
  const segment = (active: boolean) => [
    styles.segmentBtn,
    { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.surface },
  ];
  const segmentText = (active: boolean) => ({ color: active ? '#FFF' : colors.text });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="height">
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          onPress={speech.listening ? speech.stop : speech.start}
          style={[styles.mic, { backgroundColor: speech.listening ? colors.error : colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={speech.listening ? 'Berhenti merekam' : 'Mulai merekam'}
        >
          <Text style={styles.micIcon}>{speech.listening ? '■' : '🎤'}</Text>
        </TouchableOpacity>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {speech.listening
            ? speech.interim || 'Mendengarkan…'
            : 'Ketuk mikrofon, lalu ucapkan rencana. Contoh: “rapat tim besok jam 9”'}
        </Text>
        {speech.error && <Text style={[styles.hint, { color: colors.error }]}>{speech.error}</Text>}

        <Text style={[styles.label, { color: colors.text }]}>Teks</Text>
        <TextInput
          value={transcript}
          onChangeText={setTranscript}
          onEndEditing={() => process(transcript)}
          multiline
          placeholder="Atau ketik di sini"
          placeholderTextColor={colors.textSecondary}
          style={[inputStyle, styles.multiline]}
        />
        <Button title="Proses teks" variant="secondary" onPress={() => process(transcript)} />

        {form && (
          <Card style={styles.confirm}>
            <Text style={[tokens.typography.h3, { color: colors.text, marginBottom: tokens.spacing.md }]}>
              Periksa sebelum simpan
            </Text>

            <View style={styles.row}>
              {(['task', 'meeting'] as const).map((kind) => (
                <TouchableOpacity key={kind} style={segment(form.kind === kind)} onPress={() => update({ kind })}>
                  <Text style={segmentText(form.kind === kind)}>{kind === 'task' ? 'Tugas' : 'Rapat'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Judul</Text>
            <TextInput value={form.title} onChangeText={(title) => update({ title })} style={inputStyle} />

            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {form.kind === 'task' ? 'Tenggat' : 'Tanggal'}
                </Text>
                <TextInput
                  value={form.dateText}
                  onChangeText={(dateText) => update({ dateText })}
                  placeholder="hh/bb/tttt"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                  style={inputStyle}
                />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.label, { color: colors.text }]}>Jam</Text>
                <TextInput
                  value={form.timeText}
                  onChangeText={(timeText) => update({ timeText })}
                  placeholder={form.kind === 'task' ? 'opsional' : '09:00'}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                  style={inputStyle}
                />
              </View>
            </View>

            {form.kind === 'task' && (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Kuadran</Text>
                <View style={styles.row}>
                  {QUADRANTS.map((q) => (
                    <TouchableOpacity key={q} style={segment(form.quadrant === q)} onPress={() => update({ quadrant: q })}>
                      <Text style={segmentText(form.quadrant === q)}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {saveError && <Text style={[styles.hint, { color: colors.error }]}>{saveError}</Text>}
            <Button title={form.kind === 'task' ? 'Simpan Tugas' : 'Simpan Rapat'} onPress={handleSave} loading={saving} />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  mic: {
    width: 96,
    height: 96,
    borderRadius: tokens.borderRadius.full,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: tokens.spacing.md,
  },
  micIcon: {
    fontSize: 36,
    color: '#FFF',
  },
  hint: {
    ...tokens.typography.caption,
    textAlign: 'center',
    marginBottom: tokens.spacing.md,
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
    minHeight: 72,
    textAlignVertical: 'top',
  },
  confirm: {
    marginTop: tokens.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  flex: {
    flex: 1,
  },
  segmentBtn: {
    flex: 1,
    padding: tokens.spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.borderRadius.md,
    alignItems: 'center',
  },
});
