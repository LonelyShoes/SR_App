import React from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { tokens } from '../src/theme/tokens';
import { Button } from '../src/components/Button';
import { IconBubble } from '../src/components/IconBubble';
import { AlarmHealthChecks } from '../src/features/settings/AlarmHealthChecks';

const FEATURES = [
  { icon: 'grid_view', tone: 'q2', text: 'Prioritaskan tugas dengan Matrix 4Q' },
  { icon: 'timer', tone: 'fokus', text: 'Fokus dengan timer yang berbunyi seperti alarm' },
  { icon: 'description', tone: 'q4', text: 'Catat notula rapat dan ekspor ke PDF' },
] as const;

export default function Onboarding() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(400)} style={[styles.hero, { backgroundColor: colors.primarySoft }]}>
        <IconBubble name="auto_awesome" size={64} filled />
        <Text style={[styles.title, { color: colors.text }]}>Selamat datang di SR App</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Asisten harian untuk tugas, rapat, dan fokus.
        </Text>
      </Animated.View>

      {FEATURES.map((f, i) => (
        <Animated.View key={f.text} entering={FadeInDown.delay(120 + i * 80).duration(350)} style={styles.feature}>
          <IconBubble name={f.icon} tone={f.tone} size={40} />
          <Text style={[styles.featureText, { color: colors.text }]}>{f.text}</Text>
        </Animated.View>
      ))}

      <Text style={[styles.section, { color: colors.text }]}>Izinkan agar alarm berbunyi</Text>
      <AlarmHealthChecks />

      <Button
        title="Mulai Pakai SR App"
        icon="arrow_forward"
        size="lg"
        onPress={() => router.replace('/(tabs)')}
        style={styles.cta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: tokens.spacing.md,
    paddingTop: tokens.spacing.xl * 1.5,
    paddingBottom: tokens.spacing.xl,
  },
  hero: {
    alignItems: 'center',
    borderRadius: tokens.borderRadius.xl,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.lg,
  },
  title: {
    ...tokens.typography.h1,
    textAlign: 'center',
    marginTop: tokens.spacing.sm,
  },
  subtitle: {
    ...tokens.typography.body,
    textAlign: 'center',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm + tokens.spacing.xs,
    marginBottom: tokens.spacing.sm + tokens.spacing.xs,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    ...tokens.typography.h3,
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm + tokens.spacing.xs,
  },
  cta: {
    marginTop: tokens.spacing.lg,
  },
});
