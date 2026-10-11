import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { tokens, ThemeColors, ThemeMode } from './tokens';
import { getSettingSync, setSetting } from '../features/settings/repository';

type ThemeContextType = {
  colors: ThemeColors;
  /** Resolved theme actually shown */
  mode: 'light' | 'dark';
  /** User's choice in Pengaturan */
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark';

// Rendered only after migrations finish, so the settings table exists.
// Read synchronously to avoid flashing the wrong theme on launch.
const readStoredThemeMode = (): ThemeMode => {
  const stored = getSettingSync('theme_mode');
  return isThemeMode(stored) ? stored : 'system';
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readStoredThemeMode);

  const setThemeMode = (next: ThemeMode) => {
    setThemeModeState(next);
    setSetting('theme_mode', next).catch((e) => console.warn('Failed to save theme_mode:', e));
  };

  const activeMode = themeMode === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const colors = tokens.colors[activeMode];

  // Root view background (visible behind screens and the Android navigation bar)
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <ThemeContext.Provider value={{ colors, mode: activeMode, themeMode, setThemeMode }}>
      <StatusBar style={activeMode === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
