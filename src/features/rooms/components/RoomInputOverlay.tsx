import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_PX } from '../../../shared/constants/layout';

/**
 * Room ke message-input / item-edit-palette footer ko RoomChatWindow ki
 * apni render-tree se ALAG rakhta hai, taaki keyboard show/hide ke
 * DAURAAN har frame par poora (bada) RoomChatWindow re-render na ho -
 * sirf yeh chhota component reanimated ke UI thread par khud shift hota
 * hai.
 *
 * WEB -> RN CHANGES:
 * - Web version `createPortal(document.body)` + apna khud ka
 *   `useViewportKeyboard` (resize-event polling) use karta tha, kyunki
 *   browser mein keyboard ek window-resize jaisa dikhta hai. RN mein
 *   iske liye native, jank-free primitive already hai -
 *   `useAnimatedKeyboard()` (reanimated) seedha UI thread par keyboard
 *   height deta hai, koi JS-thread resize-polling/portal ki zaroorat
 *   nahi.
 * - `position:fixed` + document.body portal -> RN mein is component ko
 *   screen ke ROOT (jahan RoomChatWindow render hota hai, uske sibling
 *   ya upar) par mount karo taaki woh sabke upar overlay ho jaaye.
 * - `bottom: max(BOTTOM_NAV_PX, keyboardInset)` wahi formula, ab
 *   `useAnimatedStyle` ke andar (UI thread par, smooth automatically -
 *   alag se CSS transition/willChange ki zaroorat nahi, reanimated khud
 *   har frame native side par update karta hai).
 * - Focus-blur-on-keyboard-close hack (web ka Problem #3) RN mein
 *   zaroori nahi - Android back-press se keyboard band hone par RN
 *   TextInput khud hi blur ho jaata hai, wapas focus/keyboard-reopen
 *   wala loop yahan nahi banta.
 */
interface RoomInputOverlayProps {
  show: boolean;
  zIndex: number;
  children: ReactNode;
}

const RoomInputOverlay = ({ show, zIndex, children }: RoomInputOverlayProps) => {
  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => ({
    bottom: Math.max(BOTTOM_NAV_PX + insets.bottom, keyboard.height.value),
  }));

  if (!show) return null;

  return (
    <View style={[styles.wrapper, { zIndex }]} pointerEvents="box-none">
      <Animated.View style={[styles.bar, animatedStyle]} pointerEvents="auto">
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});

export default RoomInputOverlay;