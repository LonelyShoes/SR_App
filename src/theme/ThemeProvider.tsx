import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { tokens, ThemeColors, ThemeMode } from './tokens';

type ThemeContextType = {
  colors: ThemeColors;
  mode: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  const activeMode = themeMode === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const colors = tokens.colors[activeMode];

  return (
    <ThemeContext.Provider value={{ colors, mode: activeMode, setThemeMode }}>
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
