import { tokens } from '../theme/tokens';

type Hex = `#${string}`;

/** Widget colors from the app tokens, typed as the hex colors the widget library expects. */
const toWidgetPalette = (colors: typeof tokens.colors.light) => ({
  background: colors.background as Hex,
  surface: colors.surface as Hex,
  primary: colors.primary as Hex,
  text: colors.text as Hex,
  textSecondary: colors.textSecondary as Hex,
  border: colors.border as Hex,
  onPrimary: colors.onPrimary as Hex,
});

export type WidgetPalette = ReturnType<typeof toWidgetPalette>;

export const widgetPalettes = {
  light: toWidgetPalette(tokens.colors.light),
  dark: toWidgetPalette(tokens.colors.dark),
};

// Deep links handled by expo-router (scheme from app.config.ts)
export const DEEP_LINKS = {
  newTask: 'srapp://matrix?baru=tugas',
  quickPlan: 'srapp://modals/quick-plan',
  startFocus: 'srapp://timer?mulai=fokus',
  dashboard: 'srapp://',
} as const;
