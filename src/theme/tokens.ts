export const tokens = {
  colors: {
    light: {
      background: '#FFFFFF',
      surface: '#F5F5F5',
      primary: '#208AEF',
      text: '#1A1A1A',
      textSecondary: '#666666',
      border: '#E0E0E0',
      error: '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
      q1: '#EF4444', // Important & Urgent
      q2: '#10B981', // Important & Not Urgent
      q3: '#F59E0B', // Not Important & Urgent
      q4: '#6B7280', // Not Important & Not Urgent
    },
    dark: {
      background: '#121212',
      surface: '#1E1E1E',
      primary: '#3BA0FF',
      text: '#F5F5F5',
      textSecondary: '#A0A0A0',
      border: '#333333',
      error: '#F87171',
      success: '#34D399',
      warning: '#FBBF24',
      q1: '#F87171',
      q2: '#34D399',
      q3: '#FBBF24',
      q4: '#9CA3AF',
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
