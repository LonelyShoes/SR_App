import React from 'react';
import { View, Text, TextInput, TextInputProps, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { tokens } from '../theme/tokens';

type FieldProps = TextInputProps & { label: string; flex?: boolean };

/** Labeled text input styled from the theme. */
export const Field = ({ label, flex, multiline, style, ...input }: FieldProps) => {
  const { colors } = useTheme();
  return (
    <View style={flex ? styles.flex : undefined}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        accessibilityLabel={label}
        style={[styles.input, { color: colors.text, borderColor: colors.border }, multiline && styles.multiline, style]}
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

/** Row of mutually exclusive choices. */
export const Segmented = <T extends string>({ label, options, value, onChange }: SegmentedProps<T>) => {
  const { colors } = useTheme();
  return (
    <View>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <View style={styles.row}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.segment,
                { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.surface },
              ]}
            >
              <Text style={{ color: active ? colors.onPrimary : colors.text, fontWeight: active ? 'bold' : 'normal' }}>
                {o.label}
              </Text>
            </TouchableOpacity>
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
    ...tokens.typography.caption,
    fontWeight: 'bold',
    marginBottom: tokens.spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.sm + tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: tokens.spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.borderRadius.md,
    alignItems: 'center',
  },
});
