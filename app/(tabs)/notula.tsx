import React from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useTheme } from '../../src/theme/ThemeProvider';
import { tokens } from '../../src/theme/tokens';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import {
  getMeetingsWithoutMinutesQuery,
  getMinutesWithMeetingQuery,
} from '../../src/features/minutes/repository';
import { useTablesVersion } from '../../src/db/use-tables-version';

type Row = { key: string; meetingId: string; title: string; startAt: number; caption: string };

export default function Notula() {
  const { colors } = useTheme();
  // Both queries join minutes + meetings, so refetch on changes to either table
  const version = useTablesVersion(['minutes', 'meetings']);
  const { data: minuteRows } = useLiveQuery(getMinutesWithMeetingQuery(), [version]);
  const { data: pendingRows } = useLiveQuery(getMeetingsWithoutMinutesQuery(), [version]);

  const sections = [
    {
      title: 'Belum ada notula',
      data: pendingRows.map<Row>((m) => ({
        key: `m-${m.id}`,
        meetingId: m.id,
        title: m.title,
        startAt: m.start_at,
        caption: `Status: ${m.status} · Ketuk untuk membuat notula`,
      })),
    },
    {
      title: 'Notula',
      data: minuteRows.map<Row>((n) => ({
        key: `n-${n.id}`,
        meetingId: n.meeting_id,
        title: n.title,
        startAt: n.start_at,
        caption: `Diperbarui ${format(n.updated_at, 'd MMM yyyy, HH:mm', { locale: localeId })}`,
      })),
    },
  ].filter((s) => s.data.length > 0);

  if (sections.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState title="Belum ada rapat" description="Tambahkan rapat di tab Matrix, lalu buat notulanya di sini." />
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
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => router.push(`/notula/${item.meetingId}`)} activeOpacity={0.7}>
          <Card>
            <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.title}</Text>
            <Text style={{ color: colors.textSecondary, marginTop: tokens.spacing.xs }}>
              {format(item.startAt, 'EEEE, d MMM yyyy · HH:mm', { locale: localeId })}
            </Text>
            <Text style={{ color: colors.primary, marginTop: tokens.spacing.xs, ...tokens.typography.small }}>
              {item.caption}
            </Text>
          </Card>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: tokens.spacing.md,
  },
  sectionTitle: {
    ...tokens.typography.caption,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: tokens.spacing.sm,
  },
});
