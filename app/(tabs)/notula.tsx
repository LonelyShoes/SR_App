import React from 'react';
import { View, Text, StyleSheet, SectionList } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens } from '../../src/theme/tokens';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { IconBubble } from '../../src/components/IconBubble';
import { Icon } from '../../src/components/Icon';
import { getMeetingsWithoutMinutesQuery, getMinutesWithMeetingQuery } from '../../src/features/minutes/repository';
import { useTablesVersion } from '../../src/db/use-tables-version';

type Row = { key: string; meetingId: string; title: string; startAt: number; caption: string; pending: boolean };

export default function Notula() {
  const { colors } = useTheme();
  // Both queries join minutes + meetings, so refetch on changes to either table
  const version = useTablesVersion(['minutes', 'meetings']);
  const { data: minuteRows } = useLiveQuery(getMinutesWithMeetingQuery(), [version]);
  const { data: pendingRows } = useLiveQuery(getMeetingsWithoutMinutesQuery(), [version]);

  const sections = [
    {
      title: 'Menunggu notula',
      data: pendingRows.map<Row>((m) => ({
        key: `m-${m.id}`,
        meetingId: m.id,
        title: m.title,
        startAt: m.start_at,
        caption: 'Ketuk untuk menulis notula',
        pending: true,
      })),
    },
    {
      title: 'Notula tersimpan',
      data: minuteRows.map<Row>((n) => ({
        key: `n-${n.id}`,
        meetingId: n.meeting_id,
        title: n.title,
        startAt: n.start_at,
        caption: `Diperbarui ${format(n.updated_at, 'd MMM yyyy, HH:mm', { locale: localeId })}`,
        pending: false,
      })),
    },
  ].filter((s) => s.data.length > 0);

  if (sections.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="description"
          tone="q4"
          title="Belum ada rapat"
          description="Tambahkan rapat di tab Matrix, lalu tulis notulanya di sini."
        >
          <Button title="Buat Rapat" icon="add" variant="secondary" onPress={() => router.push('/matrix?tab=rapat')} />
        </EmptyState>
      </View>
    );
  }

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(row) => row.key}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {section.title} · {section.data.length}
        </Text>
      )}
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(280)}>
          <Card onPress={() => router.push(`/notula/${item.meetingId}`)} accessibilityLabel={`Notula ${item.title}`}>
            <View style={styles.row}>
              <IconBubble name={item.pending ? 'edit_note' : 'description'} tone={item.pending ? 'q3' : 'q4'} />
              <View style={styles.flex}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {format(item.startAt, 'EEE, d MMM yyyy · HH:mm', { locale: localeId })}
                </Text>
                <Text style={[styles.meta, { color: item.pending ? colors.q3 : colors.primary }]}>{item.caption}</Text>
              </View>
              <Icon name="chevron_right" size={22} color={colors.textSecondary} />
            </View>
          </Card>
        </Animated.View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  sectionTitle: {
    ...tokens.typography.small,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm + tokens.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm + tokens.spacing.xs,
  },
  flex: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    ...tokens.typography.small,
    marginTop: 2,
  },
});
