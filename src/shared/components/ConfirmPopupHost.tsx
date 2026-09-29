import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { subscribeConfirm, type ConfirmRequest } from '../utils/confirmBus';
import { Easing } from 'react-native-reanimated';

/**
 * Styled Yes/No dialog (window.confirm ki jagah). Root _layout.tsx mein EK
 * baar mount karo. Koi bhi file `await confirmAction({...})` (utils/confirmBus)
 * bula ke true/false le sakti hai.
 *
 * WEB -> RN CHANGES:
 * - Portal + z-index ki jagah RN `<Modal transparent>` - yeh apni native
 *   window mein khulta hai, isliye dusre <Modal>s ke upar bhi dikhta hai.
 * - Android hardware back = Cancel (`onRequestClose`), backdrop tap = Cancel.
 * - `finish()` ke andar setState updater se resolve() bulana (web mein tha)
 *   side-effect in updater tha - ab ref se safe tareeke se hota hai.
 * - Agar pehla dialog khula ho aur dusra request aa jaye to pehle wala
 *   `false` se resolve ho jaata hai (promise kabhi latakta nahi).
 */
const ConfirmPopupHost = () => {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const currentRef = useRef<ConfirmRequest | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback((result: boolean) => {
    const req = currentRef.current;
    if (!req) return;
    currentRef.current = null;
    setVisible(false); // fade-out chalne do, phir content clear
    clearTimer.current = setTimeout(() => setRequest(null), 250);
    req.resolve(result);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeConfirm((req) => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      currentRef.current?.resolve(false); // purana pending dialog cancel
      currentRef.current = req;
      setRequest(req);
      setVisible(true);
    });
    return () => {
      unsubscribe();
      if (clearTimer.current) clearTimeout(clearTimer.current);
      currentRef.current?.resolve(false);
      currentRef.current = null;
    };
  }, []);

  const danger = request?.danger !== false;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => finish(false)}
    >
      <Pressable style={styles.backdrop} onPress={() => finish(false)}>
        {/* Andar wale Pressable ka khaali onPress - backdrop tak tap bubble hone se rokta hai */}
        <Pressable onPress={() => {}} style={styles.dialogWrap}>
          <MotiView
            from={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: visible ? 1 : 0.95, opacity: visible ? 1 : 0 }}
            transition={{ type: 'timing', duration: 240, easing: Easing.out(Easing.cubic) }}
            style={styles.dialog}
          >
            <View style={styles.header}>
              <View style={[styles.iconWrap, danger ? styles.iconWrapDanger : styles.iconWrapPrimary]}>
                <Ionicons name="warning-outline" size={18} color={danger ? '#f87171' : '#818cf8'} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.title}>{request?.title || 'Are you sure?'}</Text>
                {!!request?.message && <Text style={styles.message}>{request.message}</Text>}
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => finish(false)}
                style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.btnCancelPressed]}
              >
                <Text style={styles.btnText}>{request?.cancelLabel || 'Cancel'}</Text>
              </Pressable>
              <Pressable
                onPress={() => finish(true)}
                style={({ pressed }) => [
                  styles.btn,
                  danger ? styles.btnDanger : styles.btnPrimary,
                  pressed && (danger ? styles.btnDangerPressed : styles.btnPrimaryPressed),
                ]}
              >
                <Text style={styles.btnText}>{request?.confirmLabel || 'Delete'}</Text>
              </Pressable>
            </View>
          </MotiView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 24,
  },
  dialogWrap: {
    width: '100%',
    maxWidth: 384,
  },
  dialog: {
    backgroundColor: '#1e1e2a', // star-800
    borderWidth: 1,
    borderColor: '#2a2a38', // star-700
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  iconWrap: {
    padding: 8,
    borderRadius: 999,
  },
  iconWrapDanger: { backgroundColor: 'rgba(127,29,29,0.3)' }, // star-danger-900/30
  iconWrapPrimary: { backgroundColor: 'rgba(49,46,129,0.3)' }, // star-primary-900/30
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  message: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19,
    color: '#9ca3af', // star-400
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  btnCancel: { backgroundColor: '#2a2a38' }, // star-700
  btnCancelPressed: { backgroundColor: '#3a3a4a' }, // star-600
  btnDanger: { backgroundColor: '#dc2626' }, // star-danger-600
  btnDangerPressed: { backgroundColor: '#ef4444' }, // star-danger-500
  btnPrimary: { backgroundColor: '#4f46e5' }, // star-primary-600
  btnPrimaryPressed: { backgroundColor: '#6366f1' }, // star-primary-500
});

export default memo(ConfirmPopupHost);