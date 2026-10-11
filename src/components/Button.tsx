import React from 'react';
import { Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { tokens } from '../theme/tokens';
import { Tap } from './Tap';
import { Icon, IconName } from './Icon';

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** primary: filled · secondary: pastel · ghost: text only · danger: filled red */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  size?: 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Pill button with press animation. */
export const Button = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  size = 'md',
  loading,
  disabled,
  style,
  accessibilityLabel,
}: ButtonProps) => {
  const { colors } = useTheme();

  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    secondary: { bg: colors.primarySoft, fg: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary },
    danger: { bg: colors.errorSoft, fg: colors.error },
  }[variant];

  return (
    <Tap
      style={[styles.button, size === 'lg' && styles.large, { backgroundColor: palette.bg }, style]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'lg' ? 22 : 20} color={palette.fg} />}
          <Text style={[styles.text, size === 'lg' && styles.largeText, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Tap>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: tokens.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  large: {
    paddingVertical: 16,
    minHeight: 56,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
  largeText: {
    fontSize: 17,
  },
});
