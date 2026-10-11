export const tokens = {
  colors: {
    // Light colors are dark enough for WCAG AA (≥ 4.5:1) both as text on
    // white and behind `onPrimary` text; dark colors pair with black text.
    light: {
      background: '#FFFFFF',
      surface: '#F5F5F5',
      primary: '#1A6FC9',
      onPrimary: '#FFFFFF', // text/icons on primary, error and timer-kind colors
      text: '#1A1A1A',
      textSecondary: '#666666',
      border: '#E0E0E0',
      error: '#B91C1C',
      onError: '#FFFFFF',
      success: '#047857',
      warning: '#B45309',
      overlay: 'rgba(0,0,0,0.4)', // behind bottom sheets
      q1: '#B91C1C', // Important & Urgent
      q2: '#047857', // Important & Not Urgent
      q3: '#B45309', // Not Important & Urgent
      q4: '#4B5563', // Not Important & Not Urgent
      fokus: '#B91C1C',
      rehat: '#047857',
      santai: '#1A6FC9',
    },
    dark: {
      background: '#121212',
      surface: '#1E1E1E',
      primary: '#3BA0FF',
      onPrimary: '#000000',
      text: '#F5F5F5',
      textSecondary: '#A0A0A0',
      border: '#333333',
      error: '#F87171',
      onError: '#000000',
      success: '#34D399',
      warning: '#FBBF24',
      overlay: 'rgba(0,0,0,0.6)',
      q1: '#F87171',
      q2: '#34D399',
      q3: '#FBBF24',
      q4: '#9CA3AF',
      fokus: '#F87171',
      rehat: '#34D399',
      santai: '#3BA0FF',
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
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 24, fontWeight: 'bold' as const },
    h2: { fontSize: 20, fontWeight: 'bold' as const },
    h3: { fontSize: 18, fontWeight: 'bold' as const },
    body: { fontSize: 16, fontWeight: 'normal' as const },
    caption: { fontSize: 14, fontWeight: 'normal' as const },
    small: { fontSize: 12, fontWeight: 'normal' as const },
  },
};

export type ThemeColors = typeof tokens.colors.light;
export type ThemeMode = 'light' | 'dark' | 'system';
