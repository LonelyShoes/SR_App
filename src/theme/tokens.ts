// Pastel palette. Each accent comes in two shades:
//   - `xxx`      deep tone for text, icons and filled buttons (≥ 4.5:1 on background,
//                surface, its own `xxxSoft`, and behind `onPrimary` text)
//   - `xxxSoft`  pastel tint for tiles, chips and highlighted cards
// Light accents are deep enough for white text; dark-theme accents are pastel and
// pair with the dark `onPrimary`.
export const tokens = {
  colors: {
    light: {
      background: '#F7F5F0', // warm off-white
      surface: '#FFFFFF',
      surfaceAlt: '#EFEDE6', // inputs, inactive tiles
      primary: '#4F6838', // sage
      primarySoft: '#E4EDD6',
      onPrimary: '#FFFFFF', // text/icons on primary, error, q1–q4 and timer-kind colors
      text: '#25272B',
      textSecondary: '#686B64',
      border: '#E6E3DA',
      error: '#B3261E',
      errorSoft: '#FBE3E0',
      onError: '#FFFFFF',
      success: '#2A6C4B',
      successSoft: '#DAF0E3',
      warning: '#8F5A00',
      warningSoft: '#FCEFD2',
      overlay: 'rgba(37,39,43,0.35)', // behind bottom sheets
      shadow: '#5B5545',
      q1: '#A93448', // Important & Urgent — rose
      q1Soft: '#FADCE0',
      q2: '#2A6C4B', // Important & Not Urgent — mint
      q2Soft: '#D8EFE3',
      q3: '#8F5A00', // Not Important & Urgent — butter
      q3Soft: '#FCECCB',
      q4: '#55598A', // Not Important & Not Urgent — lavender
      q4Soft: '#E4E5F6',
      fokus: '#A93448',
      fokusSoft: '#FADCE0',
      rehat: '#2A6C4B',
      rehatSoft: '#D8EFE3',
      santai: '#3A6894',
      santaiSoft: '#DCEAF8',
    },
    dark: {
      background: '#16171A',
      surface: '#212327',
      surfaceAlt: '#2B2D32',
      primary: '#BCD39C',
      primarySoft: '#323D27',
      onPrimary: '#1C2412',
      text: '#EEEEEA',
      textSecondary: '#A9ABA3',
      border: '#34363B',
      error: '#F2A49C',
      errorSoft: '#43282A',
      onError: '#2A1210',
      success: '#9FD8B6',
      successSoft: '#233A2E',
      warning: '#F1CB85',
      warningSoft: '#3F3420',
      overlay: 'rgba(0,0,0,0.6)',
      shadow: '#000000',
      q1: '#F4AFBB',
      q1Soft: '#3E2A2F',
      q2: '#9FD8B6',
      q2Soft: '#233A2E',
      q3: '#F1CB85',
      q3Soft: '#3F3420',
      q4: '#C3C5EE',
      q4Soft: '#2E3045',
      fokus: '#F4AFBB',
      fokusSoft: '#3E2A2F',
      rehat: '#9FD8B6',
      rehatSoft: '#233A2E',
      santai: '#A9CBEE',
      santaiSoft: '#26344A',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 26, fontWeight: '800' as const },
    h2: { fontSize: 20, fontWeight: '700' as const },
    h3: { fontSize: 17, fontWeight: '700' as const },
    body: { fontSize: 16, fontWeight: 'normal' as const },
    caption: { fontSize: 14, fontWeight: 'normal' as const },
    small: { fontSize: 12, fontWeight: 'normal' as const },
  },
};

export type ThemeColors = typeof tokens.colors.light;
export type ThemeMode = 'light' | 'dark' | 'system';

/** Accent families that have a deep + soft shade. */
export type Accent =
  'primary' | 'error' | 'success' | 'warning' | 'q1' | 'q2' | 'q3' | 'q4' | 'fokus' | 'rehat' | 'santai';

/** Soft elevation for cards; stronger on light where shadows are visible. */
export const elevation = (colors: ThemeColors, level: 1 | 2 = 1) => ({
  shadowColor: colors.shadow,
  shadowOpacity: level === 1 ? 0.06 : 0.12,
  shadowRadius: level === 1 ? 10 : 18,
  shadowOffset: { width: 0, height: level === 1 ? 3 : 8 },
  elevation: level === 1 ? 1 : 4,
});
