import React, { type ReactNode, useLayoutEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatePresence, MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';

const MARGIN = 10; // screen edge se minimum gap
const GAP = 8; // anchor point se menu ke beech gap
const ANCHORED_WIDTH = 220;

/**
 * Instagram/WhatsApp jaisa context menu.
 * - `anchor` = {x, y} diya ho (message/comment long-press) to menu
 *   usi point ke paas ek chhota floating card ban ke khulta hai.
 * - `anchor` na ho (jaise inbox row ka kebab menu) to ek native
 *   Instagram-jaisa full-width bottom sheet khulta hai, jo screen
 *   ke bottom se hi chipka rehta hai.
 *
 * `items`: [{ label, icon, danger, onClick }].
 *
 * WEB -> RN CHANGE:
 * - Web version `createPortal(document.body)` + hardcoded z-index
 *   (1,000,000+) se FAB/other overlays ke upar aata tha. RN mein
 *   `<Modal>` khud apni ALAG native window mein render hota hai - woh
 *   automatically har in-tree View (FAB included) ke upar hoti hai,
 *   isliye portal/z-index hacks ki zaroorat hi nahi.
 * - "REACT PORTAL GOTCHA" (event bubbling row tak pahunchna) bhi isi
 *   wajah se khatam ho jaata hai - Modal ke andar ke Pressable taps
 *   parent row tak bubble nahi karte, isliye `stopPropagation`-jaisा
 *   defensive code yahan zaroori nahi (phir bhi item taps modal close
 *   karke hi onClick chalate hain, jaisa pehle tha).
 * - `getBoundingClientRect` (sync, turant) -> RN mein `onLayout` (ek
 *   render ke baad aata hai) - isliye panel ko measure hone tak
 *   `opacity: 0` rakha hai (jaisa web bhi `visibility: hidden` karta
 *   tha), taaki galat jagah ek frame ke liye flash na ho.
 * - `backdrop-blur` ka RN mein free equivalent nahi hai (chahiye to
 *   `expo-blur`'s `<BlurView>` use karo) - abhi plain semi-transparent
 *   black backdrop rakha hai.
 */
export interface ActionSheetItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: () => void;
}

interface LongPressActionSheetProps {
  open: boolean;
  title?: string;
  items?: ActionSheetItem[];
  onClose: () => void;
  anchor?: { x: number; y: number } | null;
}

const LongPressActionSheet = ({ open, title, items = [], onClose, anchor }: LongPressActionSheetProps) => {
  const insets = useSafeAreaInsets();
  const anchored = !!anchor;
  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(null);
  const [measuredSize, setMeasuredSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      setMeasuredSize(null);
      return;
    }
    if (!anchor || !measuredSize) return;

    const { width: vw, height: vh } = Dimensions.get('window');
    const w = measuredSize.w || ANCHORED_WIDTH;
    const h = measuredSize.h || 200;

    let left = anchor.x - w / 2;
    left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));

    const spaceBelow = vh - anchor.y - GAP - MARGIN;
    const spaceAbove = anchor.y - GAP - MARGIN;
    let top: number;
    if (h <= spaceBelow || spaceBelow >= spaceAbove) {
      top = Math.min(anchor.y + GAP, vh - h - MARGIN);
    } else {
      top = Math.max(MARGIN, anchor.y - GAP - h);
    }
    top = Math.max(MARGIN, top);

    setPanelPos({ left, top });
  }, [open, anchor?.x, anchor?.y, measuredSize]);

  const close = () => onClose();

  if (!open) return null;

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <AnimatePresence>
        {open && (
          <>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={styles.backdropFill}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={close} />
            </MotiView>

            <MotiView
              from={anchored ? { opacity: 0, scale: 0.9 } : { translateY: 600 }}
              animate={anchored ? { opacity: 1, scale: 1 } : { translateY: 0 }}
              exit={anchored ? { opacity: 0, scale: 0.9 } : { translateY: 600 }}
              transition={{ type: 'timing', duration: 240, easing: Easing.out(Easing.cubic) }}
              onLayout={(e: { nativeEvent: { layout: { width: any; height: any; }; }; }) => {
                if (anchored && !measuredSize) {
                  const { width, height } = e.nativeEvent.layout;
                  setMeasuredSize({ w: width, h: height });
                }
              }}
              style={[
                anchored ? styles.anchoredPanel : styles.sheetPanel,
                anchored
                  ? {
                      width: ANCHORED_WIDTH,
                      opacity: panelPos ? 1 : 0,
                      left: panelPos?.left ?? 0,
                      top: panelPos?.top ?? 0,
                    }
                  : { paddingBottom: insets.bottom },
              ]}
            >
              {!anchored && <View style={styles.grabber} />}
              {!!title && (
                <Text style={[styles.title, anchored ? styles.titleAnchored : styles.titleSheet]}>{title}</Text>
              )}
              <View style={styles.itemsWrap}>
                {items.map((item, i) => (
                  <Pressable
                    key={i}
                    onPress={() => {
                      close();
                      item.onClick();
                    }}
                    style={({ pressed }) => [
                      anchored ? styles.itemAnchored : styles.itemSheet,
                      i !== items.length - 1 && styles.itemBorder,
                      pressed && styles.itemPressed,
                    ]}
                  >
                    {item.icon}
                    <Text style={[styles.itemLabel, item.danger && styles.itemLabelDanger]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              {!anchored && (
                <Pressable onPress={close} style={({ pressed }) => [styles.cancelBtn, pressed && styles.itemPressed]}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              )}
            </MotiView>
          </>
        )}
      </AnimatePresence>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdropFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  anchoredPanel: {
    position: 'absolute',
    borderRadius: 16,
    backgroundColor: 'rgba(20,20,28,0.97)', // star-900/95
    borderWidth: 1,
    borderColor: '#2a2a38', // star-700
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
  },
  sheetPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#141420', // star-900
    borderTopWidth: 1,
    borderColor: '#2a2a38', // star-700
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#2a2a38', // star-700
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  title: {
    color: '#f4f4f5', // star-100
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2a', // star-800
  },
  titleAnchored: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af', // star-400
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  titleSheet: {
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  itemsWrap: {
    paddingVertical: 4,
  },
  itemAnchored: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemSheet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2a', // star-800
  },
  itemPressed: {
    backgroundColor: '#1e1e2a', // star-800
  },
  itemLabel: {
    color: '#f4f4f5', // star-100
    fontWeight: '600',
    fontSize: 14,
  },
  itemLabelDanger: {
    color: '#f87171', // star-danger-400
  },
  cancelBtn: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1e1e2a', // star-800
    alignItems: 'center',
  },
  cancelText: {
    color: '#9ca3af', // star-400
    fontWeight: '700',
    fontSize: 15,
  },
});

export default LongPressActionSheet;