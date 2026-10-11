import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { tokens } from '../theme/tokens';
import { Tap } from './Tap';
import { Icon, IconName } from './Icon';

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  first?: boolean;
};

/** Section title with an optional pastel action chip on the right. */
export const SectionHeader = ({ title, actionLabel, actionIcon = 'add', onAction, first }: SectionHeaderProps) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, first && styles.first]}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {onAction && actionLabel && (
        <Tap
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} ${title}`}
          hitSlop={6}
          style={[styles.chip, { backgroundColor: colors.primarySoft }]}
        >
          <Icon name={actionIcon} size={18} color={colors.primary} />
          <Text style={[styles.chipText, { color: colors.primary }]}>{actionLabel}</Text>
        </Tap>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm + tokens.spacing.xs,
  },
  first: {
    marginTop: 0,
  },
  title: {
    ...tokens.typography.h3,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: tokens.borderRadius.full,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
