import React from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';

export type IconName = AndroidSymbol;

type IconProps = {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

/** Material Symbols line icon (bundled font, works offline). */
export const Icon = ({ name, size = 22, color, style }: IconProps) => (
  <SymbolView name={{ android: name, web: name }} size={size} tintColor={color} style={style} />
);
