import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LongPressActionSheet, { type ActionSheetItem } from './LongPressActionSheet';

/**
 * Chhota "..." (3-dot) menu - post/comment/message rows ke liye common
 * component. Do tareeke se khulta hai:
 *   1. Dots button par direct tap (agar `hideButton` nahi diya).
 *   2. Row par long-press se - parent apna `useLongPress` row par laga
 *      ke, uske callback mein `ref.current.open()` bula sakta hai
 *      (isliye forwardRef + useImperativeHandle).
 *
 * `items`: [{ label, icon, danger, onClick }] - LongPressActionSheet ko
 * seedha forward ho jaate hain. Destructive item (delete) apne onClick
 * ke andar khud confirmAction popup se gated rehta hai - yeh component
 * sirf list dikhata/khulta hai.
 *
 * WEB -> RN CHANGE: `e.stopPropagation()` (button click ko parent row ke
 * onClick tak bubble hone se rokna) hata diya - RN mein `<Modal>`-based
 * LongPressActionSheet apni alag native window mein hai aur button ka
 * onPress bhi khud row ke Pressable ke andar "nested Pressable" ban jaata
 * hai jisse RN gesture responder system khud row ka press-handler fire
 * nahi hone deta (jab tak row khud `pointerEvents`/custom gesture use na
 * kare). Agar aapka row wrapper touchable hai aur dono fire ho rahe hon,
 * bata dena - `onStartShouldSetResponder`-based fix laga denge.
 */
export interface KebabMenuHandle {
  open: () => void;
  close: () => void;
}

interface KebabMenuProps {
  items?: ActionSheetItem[];
  title?: string;
  size?: number;
  hideButton?: boolean;
}

const KebabMenu = forwardRef<KebabMenuHandle, KebabMenuProps>(
  ({ items, title, size = 15, hideButton = false }, ref) => {
    const [open, setOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
    }));

    if (!items || items.length === 0) return null;

    return (
      <>
        {!hideButton && (
          <Pressable
            onPress={() => setOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-vertical" size={size} color="#71717a" />
          </Pressable>
        )}
        <LongPressActionSheet open={open} title={title} items={items} onClose={() => setOpen(false)} />
      </>
    );
  }
);

KebabMenu.displayName = 'KebabMenu';

const styles = StyleSheet.create({
  button: {
    padding: 6,
    borderRadius: 999,
  },
  buttonPressed: {
    backgroundColor: '#1e1e2a', // star-800
  },
});

export default KebabMenu;