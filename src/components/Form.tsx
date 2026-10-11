import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { tokens } from '../theme/tokens';
import { Tap } from './Tap';

type FieldProps = TextInputProps & { label: string; flex?: boolean };

/** Labeled text input on a soft filled background; outlined in the accent while focused. */
export const Field = ({ label, flex, multiline, style, onFocus, onBlur, ...input }: FieldProps) => {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={flex ? styles.flex : undefined}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surfaceAlt,
            borderColor: focused ? colors.primary : colors.surfaceAlt,
          },
          multiline && styles.multiline,
          style,
        ]}
        {...input}
      />
    </View>
  );
};

type SegmentedProps<T extends string> = {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Pill track of mutually exclusive choices. */
export const Segmented = <T extends string>({ label, options, value, onChange }: SegmentedProps<T>) => {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Tap
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              scaleTo={0.94}
              style={[styles.segment, active && { backgroundColor: colors.primary }]}
            >
              <Text
                numberOfLines={1}
                style={{ color: active ? colors.onPrimary : colors.text, fontWeight: active ? '700' : '500' }}
              >
                {o.label}
              </Text>
            </Tap>
          );
        })}
      </View>
    </View>
  );
};

export const FormRow = ({ children }: { children: React.ReactNode }) => <View style={styles.row}>{children}</View>;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  label: {
    ...tokens.typography.small,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: tokens.spacing.xs + 2,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
    fontSize: 15,
  },
  multiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  group: {
    marginBottom: tokens.spacing.md,
  },
  track: {
    flexDirection: 'row',
    padding: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.full,
    gap: tokens.spacing.xs,
  },
  // Fields inside carry their own bottom margin
  row: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: tokens.spacing.sm + 2,
    paddingHorizontal: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.full,
    alignItems: 'center',
  },
});
