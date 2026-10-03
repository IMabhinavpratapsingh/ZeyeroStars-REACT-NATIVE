import React, { memo, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import CurrencyIcon from './CurrencyIcon';
import { calculateZMoneyCost, isValidZMoneyAmount } from '../utils/zmoney';
import useTopZIndex from '../hooks/useTopZIndex';
import useBackButtonHandler from '../hooks/useBackButtonHandler';
import useStableCallback from '../hooks/useStableCallback';
import { Easing } from 'react-native-reanimated';

/**
 * target: { id, username } | null - jise tip karna hai
 *
 * Amount FREE TYPE hai. Upar bada "You will charge" box har keystroke par
 * live update hota hai (fee ke saath), taaki amount type karte hi clearly
 * pata chale ki kitna katega.
 *
 * WEB -> RN CHANGES:
 * - `fixed inset-0` -> in-tree absoluteFill overlay + useTopZIndex(target)
 *   (target ka naya object reference = naya sabse-upar z-index, pehle jaisa).
 *   Parent full-screen View ho.
 * - `<input type=number>` -> numeric TextInput (`keyboardType="number-pad"`),
 *   Enter = `onSubmitEditing`. `autoFocus` rakha hai.
 * - KeyboardAvoidingView (iOS) taaki keyboard card ko na dhake; card ab
 *   center mein hai (web ka `items-end` bottom-sheet keyboard ke saath
 *   phone par kharab lagta).
 * - Android hardware back = close.
 */
interface TipModalProps {
  show: boolean;
  target: { id: string | number; username?: string } | null;
  myBalance?: { coins?: number; z_money?: number } | null;
  onSend: (amount: number) => void;
  onClose: () => void;
}

const TipModal = ({ show, target, myBalance, onSend, onClose }: TipModalProps) => {
  const [amountInput, setAmountInput] = useState('');
  const zIndex = useTopZIndex(target);

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show && !!target, handleClose);

  // Naye target / dobara khulne par input reset
  useEffect(() => {
    if (show) setAmountInput('');
  }, [show, target]);

  if (!show || !target) return null;

  const amount = Number(amountInput);
  const valid = amountInput.trim() !== '' && isValidZMoneyAmount(amountInput);
  const cost = valid ? calculateZMoneyCost(amount) : 0;
  const cantAfford = valid && !!myBalance && cost > (myBalance.z_money || 0);
  const canSend = valid && !cantAfford;

  const handleSend = () => {
    if (!canSend) return;
    onSend(amount);
    setAmountInput('');
  };

  const boxStyle = cantAfford ? styles.boxDanger : valid ? styles.boxValid : styles.boxIdle;

  return (
    <View style={[styles.overlay, { zIndex, elevation: 20 }]}>
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <MotiView
          from={{ translateY: 24, opacity: 0, scale: 0.98 }}
          animate={{ translateY: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 240, easing: Easing.out(Easing.cubic) }}
          style={styles.card}
        >
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Tip {target.username || 'user'} ko</Text>
              <CurrencyIcon type="zmoney" size={14} />
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={16} color="#9ca3af" />
            </Pressable>
          </View>

          {/* BADA "You will charge" box - live update */}
          <View style={[styles.box, boxStyle]}>
            <Text style={styles.boxLabel}>YOU WILL CHARGE</Text>
            <Text style={[styles.boxAmount, cantAfford && { color: '#f87171' }]}>
              {valid ? cost : 0}
            </Text>
            <Text style={styles.boxHint}>
              {valid ? `(${amount} tip + ${cost - amount} fee)` : 'Enter amount below'}
            </Text>
            {cantAfford && <Text style={styles.boxError}>Not enough balance!</Text>}
          </View>

          <Text style={styles.inputLabel}>How much Z Money to send?</Text>
          <TextInput
            value={amountInput}
            onChangeText={setAmountInput}
            onSubmitEditing={handleSend}
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="send"
            autoFocus
            placeholder="Enter amount"
            placeholderTextColor="#71717a"
            style={styles.input}
          />

          {amountInput.trim() !== '' && !valid && (
            <Text style={styles.inputError}>Enter a whole number (1 or more)</Text>
          )}

          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendBtn,
              canSend ? styles.sendBtnOn : styles.sendBtnOff,
              pressed && canSend && { backgroundColor: '#6366f1' },
            ]}
          >
            <Text style={[styles.sendText, !canSend && { color: '#71717a' }]}>Send Tip</Text>
          </Pressable>

          <Text style={styles.feeNote}>A 10% fee applies (e.g. tipping 10 will deduct 11)</Text>
        </MotiView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 384,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  title: { fontWeight: '700', color: '#ffffff', fontSize: 15 },
  box: {
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  boxIdle: { borderColor: '#2a2a38', backgroundColor: 'rgba(20,20,32,0.6)' },
  boxValid: { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)' },
  boxDanger: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  boxLabel: { fontSize: 11, letterSpacing: 0.8, color: '#9ca3af', marginBottom: 4 },
  boxAmount: { fontSize: 36, fontWeight: '800', color: '#ffffff' },
  boxHint: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  boxError: { fontSize: 11, color: '#f87171', fontWeight: '700', marginTop: 4 },
  inputLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 6 },
  input: {
    backgroundColor: '#141420', // star-900
    borderWidth: 1,
    borderColor: '#2a2a38',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  inputError: { fontSize: 11, color: '#f87171', marginTop: 8 },
  sendBtn: { width: '100%', marginTop: 16, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  sendBtnOn: { backgroundColor: '#4f46e5' },
  sendBtnOff: { backgroundColor: '#2a2a38' },
  sendText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  feeNote: { fontSize: 11, color: '#71717a', marginTop: 12, textAlign: 'center' },
});

export default memo(TipModal);