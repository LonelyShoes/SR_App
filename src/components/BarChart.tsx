import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { tokens } from '../theme/tokens';

type Bar = { label: string; value: number };

type BarChartProps = {
  data: Bar[];
  color?: string;
  height?: number;
  /** Show every n-th label so dense charts stay readable */
  labelEvery?: number;
  /** Accessible summary read by screen readers instead of each bar */
  accessibilityLabel: string;
};

/** Simple vertical bar chart built from Views; colors come from the theme. */
export const BarChart = ({ data, color, height = 120, labelEvery = 1, accessibilityLabel }: BarChartProps) => {
  const { colors } = useTheme();
  const barColor = color ?? colors.primary;
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <View style={[styles.plot, { height, borderBottomColor: colors.border }]}>
        {data.map((d, i) => (
          <View key={`${d.label}-${i}`} style={styles.slot}>
            <View
              style={{
                height: d.value > 0 ? Math.max(2, (d.value / max) * height) : 0,
                backgroundColor: barColor,
                borderTopLeftRadius: tokens.borderRadius.sm,
                borderTopRightRadius: tokens.borderRadius.sm,
              }}
            />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {/* Each shown label spans the `labelEvery` bars it stands for */}
        {data
          .map((d, i) => ({ ...d, i }))
          .filter((d) => d.i % labelEvery === 0)
          .map((d) => (
            <Text
              key={`${d.label}-${d.i}`}
              style={[styles.label, { color: colors.textSecondary, flex: Math.min(labelEvery, data.length - d.i) }]}
              numberOfLines={1}
            >
              {d.label}
            </Text>
          ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    gap: 2,
  },
  slot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  labels: {
    flexDirection: 'row',
    marginTop: tokens.spacing.xs,
  },
  label: {
    fontSize: 10,
  },
});
