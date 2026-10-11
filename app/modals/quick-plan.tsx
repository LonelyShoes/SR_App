import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView } from 'react-native';
import Animated, {
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Field, FormRow, Segmented } from '../../src/components/Form';
import { Tap } from '../../src/components/Tap';
import { Icon } from '../../src/components/Icon';
import { parseQuickPlan } from '../../src/lib/date-parser-id';
import { useSpeechInput } from '../../src/features/voice/use-speech-input';
import { Quadrant, QuickPlanForm, draftToForm, saveQuickPlan } from '../../src/features/voice/quick-plan';

const QUADRANTS = (['Q1', 'Q2', 'Q3', 'Q4'] as Quadrant[]).map((q) => ({ value: q, label: q }));
const KINDS = [
  { value: 'task' as const, label: 'Tugas' },
  { value: 'meeting' as const, label: 'Rapat' },
];

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

  // Expanding ring around the mic while listening
  const ripple = useSharedValue(0);
  useEffect(() => {
    if (!speech.listening) {
      cancelAnimation(ripple);
      ripple.set(0);
      return;
    }
    ripple.set(withRepeat(withTiming(1, { duration: 1200 }), -1));
  }, [speech.listening, ripple]);
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 1 - ripple.get(),
    transform: [{ scale: 1 + ripple.get() * 0.6 }],
  }));

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

  const micColor = speech.listening ? colors.error : colors.primary;
  const micSoft = speech.listening ? colors.errorSoft : colors.primarySoft;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="height">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.micWrap}>
          <Animated.View style={[styles.ripple, { backgroundColor: micSoft }, rippleStyle]} />
          <Tap
            onPress={speech.listening ? speech.stop : speech.start}
            scaleTo={0.9}
            style={[styles.mic, { backgroundColor: micColor }]}
            accessibilityRole="button"
            accessibilityLabel={speech.listening ? 'Berhenti merekam' : 'Mulai merekam'}
          >
            <Icon name={speech.listening ? 'stop' : 'mic'} size={44} color={colors.onPrimary} />
          </Tap>
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {speech.listening
            ? speech.interim || 'Mendengarkan…'
            : 'Ketuk mikrofon, lalu ucapkan rencana. Contoh: “rapat tim besok jam 9”'}
        </Text>
        {speech.error && <Text style={[styles.hint, { color: colors.error }]}>{speech.error}</Text>}

        <Field
          label="Teks"
          value={transcript}
          onChangeText={setTranscript}
          onEndEditing={() => process(transcript)}
          multiline
          placeholder="Atau ketik di sini"
        />
        <Button title="Proses teks" icon="auto_awesome" variant="secondary" onPress={() => process(transcript)} />

        {form && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Card style={styles.confirm}>
              <Text style={[tokens.typography.h3, { color: colors.text, marginBottom: tokens.spacing.md }]}>
                Periksa sebelum simpan
              </Text>

              <Segmented options={KINDS} value={form.kind} onChange={(kind) => update({ kind })} />
              <Field label="Judul" value={form.title} onChangeText={(title) => update({ title })} />
              <FormRow>
                <Field
                  flex
                  label={form.kind === 'task' ? 'Tenggat' : 'Tanggal'}
                  value={form.dateText}
                  onChangeText={(dateText) => update({ dateText })}
                  placeholder="hh/bb/tttt"
                  keyboardType="numbers-and-punctuation"
                />
                <Field
                  flex
                  label="Jam"
                  value={form.timeText}
                  onChangeText={(timeText) => update({ timeText })}
                  placeholder={form.kind === 'task' ? 'opsional' : '09:00'}
                  keyboardType="numbers-and-punctuation"
                />
              </FormRow>

              {form.kind === 'task' && (
                <Segmented
                  label="Kuadran"
                  options={QUADRANTS}
                  value={form.quadrant}
                  onChange={(quadrant) => update({ quadrant })}
                />
              )}

              {saveError && <Text style={[styles.hint, { color: colors.error }]}>{saveError}</Text>}
              <Button
                title={form.kind === 'task' ? 'Simpan Tugas' : 'Simpan Rapat'}
                icon="check"
                size="lg"
                onPress={handleSave}
                loading={saving}
              />
            </Card>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const MIC = 104;

const styles = StyleSheet.create({
  content: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  micWrap: {
    width: MIC * 1.7,
    height: MIC * 1.7,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
  },
  mic: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    ...tokens.typography.caption,
    textAlign: 'center',
    marginBottom: tokens.spacing.md,
  },
  confirm: {
    marginTop: tokens.spacing.lg,
  },
});
