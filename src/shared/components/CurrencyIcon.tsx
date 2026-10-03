import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { CURRENCY_SYMBOLS, type CurrencyType } from '../constants/currency';

/**
 * Coin / Z Money ka symbol. Pehle har jagah Ionicons (cash-outline,
 * logo-bitcoin) ya "ⓩ" text hardcoded tha - ab sab yahin se aata hai.
 * Symbol badalna ho to `shared/constants/currency.ts` edit karo.
 *
 * `size` Ionicons wale size ke barabar rakha hai taaki purane layouts
 * (rows, chips, pills) waise hi align rahein.
 */
type Props = {
  type: CurrencyType;
  size?: number;
  style?: StyleProp<TextStyle>;
};

export default function CurrencyIcon({ type, size = 14, style }: Props) {
  return (
    <Text
      allowFontScaling={false}
      style={[{ fontSize: size, lineHeight: Math.round(size * 1.25), includeFontPadding: false }, style]}
    >
      {CURRENCY_SYMBOLS[type]}
    </Text>
  );
}