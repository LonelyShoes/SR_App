import React from 'react';
import type { WidgetRepresentation, WidgetTaskHandlerProps } from 'react-native-android-widget';
import { QuickActionWidget } from './QuickActionWidget';
import { DashboardWidget } from './DashboardWidget';
import { loadDashboardSummary } from './dashboard-data';
import { widgetPalettes } from './theme';

// Names must match the widgets declared in app.config.ts
export const WIDGET_NAMES = {
  quickAction: 'QuickAction',
  dashboard: 'Dashboard',
} as const;

/** Light + dark variants: Android picks the one matching the system theme. */
export const renderWidgetByName = async (widgetName: string): Promise<WidgetRepresentation | null> => {
  switch (widgetName) {
    case WIDGET_NAMES.quickAction:
      return {
        light: <QuickActionWidget palette={widgetPalettes.light} />,
        dark: <QuickActionWidget palette={widgetPalettes.dark} />,
      };
    case WIDGET_NAMES.dashboard: {
      const summary = await loadDashboardSummary();
      return {
        light: <DashboardWidget summary={summary} palette={widgetPalettes.light} />,
        dark: <DashboardWidget summary={summary} palette={widgetPalettes.dark} />,
      };
    }
    default:
      return null;
  }
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE': // periodic refresh (updatePeriodMillis)
    case 'WIDGET_RESIZED': {
      const widget = await renderWidgetByName(props.widgetInfo.widgetName);
      if (widget) props.renderWidget(widget);
      break;
    }
    default:
      // Clicks use OPEN_URI deep links, handled natively
      break;
  }
}
