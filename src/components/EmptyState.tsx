import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { tokens, Accent } from '../theme/tokens';
import { Icon, IconName } from './Icon';

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: IconName;
  tone?: Accent;
  children?: React.ReactNode;
};

export const EmptyState = ({ title, description, icon = 'inbox', tone = 'primary', children }: EmptyStateProps) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.bubble, { backgroundColor: colors[`${tone}Soft`] }]}>
        <Icon name={icon} size={34} color={colors[tone]} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  bubble: {
    width: 76,
    height: 76,
    borderRadius: tokens.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
  },
  title: {
    ...tokens.typography.h3,
    textAlign: 'center',
  },
  description: {
    ...tokens.typography.caption,
    textAlign: 'center',
    lineHeight: 20,
  },
});
