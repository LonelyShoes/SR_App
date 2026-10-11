import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { DEEP_LINKS, WidgetPalette } from './theme';

const ACTIONS = [
  { label: '＋ Tugas Baru', uri: DEEP_LINKS.newTask },
  { label: '🎤 Quick Plan', uri: DEEP_LINKS.quickPlan },
  { label: '🎯 Mulai Fokus', uri: DEEP_LINKS.startFocus },
];

export function QuickActionWidget({ palette }: { palette: WidgetPalette }) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        flexGap: 8,
        padding: 8,
        borderRadius: 16,
        backgroundColor: palette.background,
      }}
    >
      {ACTIONS.map((action) => (
        <FlexWidget
          key={action.uri}
          clickAction="OPEN_URI"
          clickActionData={{ uri: action.uri }}
          style={{
            flex: 1,
            height: 'match_parent',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            backgroundColor: palette.surface,
          }}
        >
          <TextWidget text={action.label} style={{ fontSize: 13, color: palette.text, fontWeight: 'bold' }} />
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
