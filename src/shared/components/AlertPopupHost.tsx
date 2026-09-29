import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import { AnimatePresence, MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { subscribeAlert, type AlertPopup, type AlertType } from '../utils/alertBus';
import { Easing } from 'react-native-reanimated';

const AUTO_DISMISS_MS = 4500;
const MAX_AUTO_DISMISS_MS = 12000;

const STYLE_BY_TYPE: Record<AlertType, { icon: string; border: string; iconColor: string }> = {
  error: { icon: 'warning-outline', border: 'rgba(185,28,28,0.6)', iconColor: '#f87171' }, // star-danger-700/60, 400
  success: { icon: 'checkmark-circle-outline', border: 'rgba(21,128,61,0.6)', iconColor: '#4ade80' }, // green-700/60, green-400
  info: { icon: 'information-circle-outline', border: 'rgba(67,56,202,0.6)', iconColor: '#818cf8' }, // star-primary-700/60, 400
};

/**
 * Raw alert() ki jagah styled, stacked toast-style popups. Koi bhi file
 * `showAlert("message")` (utils/alertBus) bula sakti hai - prop drilling nahi.
 * Root _layout.tsx mein EK baar mount karo (sabse last child ki tarah).
 *
 * WEB -> RN CHANGES:
 * - `createPortal(document.body)` + z-index 1000000 hata diya. Ab yeh root
 *   ke upar ek absolute overlay hai; iOS par `FullWindowOverlay` (react-native-screens)
 *   use hota hai taaki yeh <Modal> ke UPAR bhi dikhe.
 * - ANDROID LIMITATION: RN <Modal> apni alag native window mein hota hai, aur
 *   in-tree overlay us window ke upar nahi aa sakta. Matlab agar koi <Modal>
 *   khula ho aur us waqt showAlert() chale to Android par toast Modal ke
 *   PEECHE chhup sakta hai. Zyada tar screens ke liye theek hai; agar kisi
 *   Modal ke andar se alert chahiye to bata dena, wahan alag handling laga denge.
 * - Safe-area top inset (notch/status bar) ab add hota hai.
 * - Popup par tap karne se bhi dismiss ho jaata hai (web mein sirf X button tha).
 * - Unmount par saare pending timers clear hote hain (web version mein leak tha).
 */
const AlertPopupHost = () => {
  const insets = useSafeAreaInsets();
  const [popups, setPopups] = useState<AlertPopup[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAlert((popup) => {
      setPopups((prev) => [...prev, popup]);
      // Lambe messages (ban notice etc.) ko padhne ke liye zyada time.
      const dismissAfter = Math.min(
        MAX_AUTO_DISMISS_MS,
        Math.max(AUTO_DISMISS_MS, popup.message.length * 60)
      );
      timers.current.set(popup.id, setTimeout(() => dismiss(popup.id), dismissAfter));
    });
    const activeTimers = timers.current;
    return () => {
      unsubscribe();
      activeTimers.forEach((t) => clearTimeout(t));
      activeTimers.clear();
    };
  }, [dismiss]);

  const layer = (
    <View style={[styles.layer, { top: insets.top + 8 }]} pointerEvents="box-none">
      <AnimatePresence>
        {popups.map((popup) => {
          const { icon, border, iconColor } = STYLE_BY_TYPE[popup.type] ?? STYLE_BY_TYPE.error;
          return (
            <MotiView
              key={popup.id}
              from={{ translateY: -30, opacity: 0 }}
              animate={{ translateY: 0, opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'timing', duration: 240, easing: Easing.out(Easing.cubic) }}
              style={styles.cardWrap}
            >
              <Pressable
                onPress={() => dismiss(popup.id)}
                style={[styles.card, { borderColor: border }]}
              >
                <Ionicons name={icon as any} size={18} color={iconColor} style={styles.icon} />
                <Text style={styles.message}>{popup.message}</Text>
                <Pressable onPress={() => dismiss(popup.id)} hitSlop={10} accessibilityLabel="Dismiss">
                  <Ionicons name="close" size={14} color="#71717a" />
                </Pressable>
              </Pressable>
            </MotiView>
          );
        })}
      </AnimatePresence>
    </View>
  );

  if (Platform.OS === 'ios') {
    // Sirf jab popup ho tab mount - khaali overlay touches na roke.
    return popups.length > 0 ? <FullWindowOverlay>{layer}</FullWindowOverlay> : null;
  }
  return layer;
};

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000000,
    elevation: 50, // Android par zIndex ke saath elevation bhi chahiye
  },
  cardWrap: {
    width: '90%',
    maxWidth: 384,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#1e1e2a', // star-800
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  icon: {
    marginTop: 2,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: '#ffffff',
  },
});

export default memo(AlertPopupHost);