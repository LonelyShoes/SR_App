import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { tokens, elevation, Accent } from '../theme/tokens';
import { Tap } from './Tap';

type CardProps = ViewProps & {
  /** Makes the whole card tappable with press feedback */
  onPress?: () => void;
  onLongPress?: () => void;
  /** Pastel tint instead of the plain surface */
  tone?: Accent;
  accessibilityLabel?: string;
};

/** Borderless rounded surface with a soft shadow. */
export const Card = ({ style, children, onPress, onLongPress, tone, accessibilityLabel, ...props }: CardProps) => {
  const { colors } = useTheme();
  const surface = [
    styles.card,
    { backgroundColor: tone ? colors[`${tone}Soft`] : colors.surface },
    !tone && elevation(colors),
    style,
  ];

  if (onPress || onLongPress) {
    return (
      <Tap
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={surface}
        {...props}
      >
        {children}
      </Tap>
    );
  }

  return (
    <View style={surface} accessibilityLabel={accessibilityLabel} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
    marginBottom: tokens.spacing.sm + tokens.spacing.xs,
  },
});
