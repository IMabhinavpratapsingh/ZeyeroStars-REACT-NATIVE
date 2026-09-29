import React, { type ReactNode } from 'react';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom input bar jo keyboard ke theek upar OVERLAY ki tarah float karta hai.
 * Parent screen/list apni jagah se nahi hilti - sirf yeh bar keyboard height
 * ke saath UI thread par slide karti hai (RoomInputOverlay wala same pattern).
 *
 * Parent ko list ke bottom mein `onHeightChange` se mili height ka padding
 * dena hai, taaki last comment bar ke peeche na chhupe.
 *
 * Zaroori: app.json mein android.softwareKeyboardLayoutMode = "resize"
 * (pan nahi) - warna Android poori screen upar kheench leta hai.
 */
interface Props {
  children: ReactNode;
  onHeightChange?: (h: number) => void;
  backgroundColor?: string;
}

const KeyboardComposerOverlay = ({ children, onHeightChange, backgroundColor = '#000000' }: Props) => {
  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => ({
    bottom: Math.max(insets.bottom, keyboard.height.value),
  }));

  const onLayout = (e: LayoutChangeEvent) => onHeightChange?.(e.nativeEvent.layout.height);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.bar, { backgroundColor }, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0 },
});

export default KeyboardComposerOverlay;