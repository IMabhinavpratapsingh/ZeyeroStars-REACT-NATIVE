import { useRef, useCallback, useMemo } from 'react';
import { Vibration, type GestureResponderEvent } from 'react-native';

// Instagram/WhatsApp jaisa "long press to open menu" gesture.
//
// WEB -> RN CHANGE:
// Web version touchstart/touchmove/mouse events par khud timer, move-cancel
// (10px) aur right-click (contextmenu) sambhalta tha. RN mein <Pressable>
// yeh sab NATIVELY karta hai - long-press timing, scroll/move par
// auto-cancel (ScrollView/FlatList ke andar bhi), isliye hum khud ka timer
// nahi chalate. Right-click/mouse ka concept mobile par hai hi nahi.
//
// Coordinates: web mein clientX/clientY the, yahan `pageX/pageY` (screen
// coords) - LongPressActionSheet/QuickActionsSheet ko menu usi jagah
// "anchor" karne ke liye chahiye jahan press hua.
//
// USAGE:
//   const { pressableProps, wasLongPress } = useLongPress((pos) => openMenu(pos));
//   <Pressable {...pressableProps} onPress={() => { if (wasLongPress()) return; ... }}>
//
// NOTE: Pressable mein long-press fire hone par onPress khud hi nahi
// chalta, isliye wasLongPress() ki zaroorat aksar nahi padti - web-API
// se compat ke liye rakha hai (custom Touchable/gesture wrappers ke liye).
const LONG_PRESS_MS = 450;
const VIBRATE_MS = 12;

export interface LongPressPosition {
  x: number;
  y: number;
}

export default function useLongPress(
  onLongPress: (pos: LongPressPosition) => void,
  { disabled = false }: { disabled?: boolean } = {}
) {
  const firedRef = useRef(false);
  const startPos = useRef<LongPressPosition>({ x: 0, y: 0 });

  const onPressIn = useCallback((e: GestureResponderEvent) => {
    firedRef.current = false;
    startPos.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  }, []);

  const handleLongPress = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled) return;
      firedRef.current = true;
      Vibration.vibrate(VIBRATE_MS);
      // Long-press ke waqt ki position; nahi mili to press-start wali use karo
      const x = e?.nativeEvent?.pageX ?? startPos.current.x;
      const y = e?.nativeEvent?.pageY ?? startPos.current.y;
      onLongPress({ x, y });
    },
    [disabled, onLongPress]
  );

  const wasLongPress = useCallback(() => firedRef.current, []);

  const pressableProps = useMemo(
    () => ({
      onPressIn,
      onLongPress: handleLongPress,
      delayLongPress: LONG_PRESS_MS,
    }),
    [onPressIn, handleLongPress]
  );

  return { pressableProps, wasLongPress };
}