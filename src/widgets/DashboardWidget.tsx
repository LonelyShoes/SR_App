import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { format, isToday } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { DashboardSummary } from './dashboard-data';
import { DEEP_LINKS, WidgetPalette } from './theme';

function Stat({ value, label, palette }: { value: number; label: string; palette: WidgetPalette }) {
  return (
    <FlexWidget style={{ flex: 1, alignItems: 'center' }}>
      <TextWidget text={String(value)} style={{ fontSize: 22, fontWeight: 'bold', color: palette.primary }} />
      <TextWidget text={label} style={{ fontSize: 11, color: palette.textSecondary }} />
    </FlexWidget>
  );
}

const formatStart = (startAt: number) =>
  isToday(startAt) ? format(startAt, 'HH:mm') : format(startAt, 'EEE HH:mm', { locale: localeId });

export function DashboardWidget({ summary, palette }: { summary: DashboardSummary; palette: WidgetPalette }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: DEEP_LINKS.dashboard }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        padding: 12,
        borderRadius: 16,
        backgroundColor: palette.background,
      }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
        <Stat value={summary.agendaToday} label="Agenda hari ini" palette={palette} />
        <Stat value={summary.confirmedToday} label="Terkonfirmasi" palette={palette} />
        <Stat value={summary.urgentTasks} label="Tugas mendesak" palette={palette} />
      </FlexWidget>

      <FlexWidget
        style={{
          width: 'match_parent',
          flex: 1,
          flexDirection: 'column',
          marginTop: 8,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: palette.border,
        }}
      >
        {summary.upcoming.length === 0 ? (
          <TextWidget text="Tidak ada agenda terdekat" style={{ fontSize: 12, color: palette.textSecondary }} />
        ) : (
          summary.upcoming.map((m) => (
            <FlexWidget
              key={`${m.startAt}-${m.title}`}
              style={{ width: 'match_parent', flexDirection: 'row', marginTop: 2 }}
            >
              <TextWidget
                text={formatStart(m.startAt)}
                style={{ fontSize: 12, fontWeight: 'bold', color: palette.primary, width: 72 }}
              />
              <TextWidget text={m.title} maxLines={1} truncate="END" style={{ fontSize: 12, color: palette.text }} />
            </FlexWidget>
          ))
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
