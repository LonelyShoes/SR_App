import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const Card = ({ style, children, ...props }: ViewProps) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
});
