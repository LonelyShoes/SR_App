import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { tokens, Accent } from '../theme/tokens';
import { Icon, IconName } from './Icon';

type IconBubbleProps = {
  name: IconName;
  tone?: Accent;
  size?: number;
  /** Filled with the deep shade (selected state) instead of the pastel one */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Line icon on a rounded pastel square. */
export const IconBubble = ({ name, tone = 'primary', size = 44, filled, style }: IconBubbleProps) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.bubble,
        { width: size, height: size, backgroundColor: filled ? colors[tone] : colors[`${tone}Soft`] },
        style,
      ]}
    >
      <Icon name={name} size={Math.round(size * 0.52)} color={filled ? colors.onPrimary : colors[tone]} />
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    borderRadius: tokens.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
