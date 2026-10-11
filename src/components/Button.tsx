import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

export const Button = ({ title, onPress, variant = 'primary', loading, disabled }: ButtonProps) => {
  const { colors } = useTheme();

  let backgroundColor = colors.primary;
  let textColor = colors.onPrimary;

  if (variant === 'secondary') {
    backgroundColor = colors.surface;
    textColor = colors.text;
  } else if (variant === 'danger') {
    backgroundColor = colors.error;
    textColor = colors.onError;
  }

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: disabled ? colors.border : backgroundColor }]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
