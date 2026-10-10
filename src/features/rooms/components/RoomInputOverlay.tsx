import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
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

  const animatedStyle = useAnimatedStyle(() => ({
    // FIX (asli root cause): RoomChatWindow khud PARENT (RoomsOverlayScreen
    // -> PersistentSlide) ke andar hai jo pehle se hi `bottom: BOTTOM_NAV_PX`
    // par khatam ho jaata hai (taaki neeche BottomNav dikhta rahe - dekho
    // ScreenTransition.tsx ka comment). Yani is component ka apna "bottom:0"
    // matlab hi "BottomNav ke top" hai. Yahan phir se BOTTOM_NAV_PX jodna
    // DOUBLE-COUNT tha (InboxModal.tsx mein bilkul yahi bug pehle fix ho
    // chuka hai, comment dekho) - isi wajah se input BottomNav se bohot
    // upar, khaali gap ke saath dikh raha tha.
    // Idle mein ab bas 0 (parent ki bounded height poori fill) - keyboard
    // khulne par sirf utna hi upar uthao jitna keyboard is (pehle se
    // BOTTOM_NAV_PX upar shift) container ke andar ghus raha hai.
    bottom: Math.max(0, keyboard.height.value - BOTTOM_NAV_PX),
  }));

  // Hide/unhide (unmount nahi): TextInput + keyboard hook mounted rehte hain,
  // room minimize/restore par input dobara build nahi hota.
  return (
    <View
      style={[styles.wrapper, { zIndex }, !show && styles.hidden]}
      pointerEvents={show ? 'box-none' : 'none'}
    >
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
  hidden: { display: 'none' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});

export default RoomInputOverlay;