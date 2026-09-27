import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import {
  subscribeRulesWarning,
  setDontShowRulesWarningAgain,
  type RulesWarningRequest,
} from '../utils/rulesWarningBus';

/**
 * Room join, World Chat join, Community join, ya Community Room join -
 * in char jagah se `showRulesWarning(context)` call hota hai. Root
 * _layout.tsx mein EK baar mount karo (ConfirmPopupHost jaisa hi).
 *
 * WEB -> RN CHANGES:
 * - Portal + z-index -> RN `<Modal transparent>` (sabse upar, dusre
 *   Modals ke upar bhi).
 * - `<input type=checkbox>` -> custom Pressable checkbox.
 * - Yeh permission-gate nahi, sirf reminder hai - isliye Android back /
 *   backdrop tap se dismiss NAHI hota; user "Continue" dabaye tabhi
 *   promise `true` se resolve hota hai (web jaisa hi behaviour).
 * - `finish()` mein setState-updater ke andar side-effect (web) hata kar
 *   ref use kiya. Unmount hone par pending promise `true` se resolve.
 */
const CONTEXT_LABELS: Record<string, string> = {
  room: 'this Room',
  'world chat': 'World Chat',
  community: 'this Community',
  'community room': 'this Community Room',
};

const RulesWarningHost = () => {
  const [request, setRequest] = useState<RulesWarningRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const currentRef = useRef<RulesWarningRequest | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    const req = currentRef.current;
    if (!req) return;
    currentRef.current = null;
    if (dontShowAgain) setDontShowRulesWarningAgain(true);
    setVisible(false);
    clearTimer.current = setTimeout(() => setRequest(null), 250);
    req.resolve(true);
  }, [dontShowAgain]);

  useEffect(() => {
    const unsubscribe = subscribeRulesWarning((req) => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      currentRef.current?.resolve(true); // purana pending (agar ho) latakta na rahe
      currentRef.current = req;
      setDontShowAgain(false);
      setRequest(req);
      setVisible(true);
    });
    return () => {
      unsubscribe();
      if (clearTimer.current) clearTimeout(clearTimer.current);
      currentRef.current?.resolve(true);
      currentRef.current = null;
    };
  }, []);

  const label = CONTEXT_LABELS[request?.context ?? ''] || 'here';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        /* reminder hai - sirf "Continue" se hi band hoga */
      }}
    >
      <View style={styles.backdrop}>
        <MotiView
          from={{ translateY: 24, opacity: 0, scale: 0.97 }}
          animate={{ translateY: visible ? 0 : 12, opacity: visible ? 1 : 0, scale: visible ? 1 : 0.98 }}
          transition={{ type: 'spring', damping: 20, stiffness: 240 }}
          style={styles.card}
        >
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="shield-outline" size={20} color="#f87171" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Community Guidelines</Text>
              <Text style={styles.headerSub}>Before you join {label}</Text>
            </View>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.body} bounces={false}>
            <Text style={styles.intro}>
              ZeyeroStars is a respectful community - these rules must always be followed:
            </Text>

            <View style={styles.ruleBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#facc15" style={styles.ruleIcon} />
              <Text style={styles.ruleText}>
                No abusive language, cursing, or disrespectful behavior is allowed.
              </Text>
            </View>

            <View style={styles.ruleBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#facc15" style={styles.ruleIcon} />
              <Text style={styles.ruleText}>
                No harassment, harmful, or inappropriate chat/behavior is allowed.
              </Text>
            </View>

            <View style={[styles.ruleBox, styles.ruleBoxDanger]}>
              <Ionicons name="ban-outline" size={16} color="#f87171" style={styles.ruleIcon} />
              <Text style={[styles.ruleText, styles.ruleTextDanger]}>
                Breaking these rules can get your account banned from ZeyeroStars immediately,
                without warning.
              </Text>
            </View>

            <Pressable
              onPress={() => setDontShowAgain((v) => !v)}
              style={styles.checkRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: dontShowAgain }}
            >
              <View style={[styles.checkbox, dontShowAgain && styles.checkboxOn]}>
                {dontShowAgain && <Ionicons name="checkmark" size={12} color="#ffffff" />}
              </View>
              <Text style={styles.checkLabel}>Don't show this again</Text>
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={finish}
              style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
            >
              <Text style={styles.continueText}>Continue</Text>
            </Pressable>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 384,
    maxHeight: '90%',
    backgroundColor: '#141420', // star-900
    borderWidth: 2,
    borderColor: 'rgba(220,38,38,0.7)', // star-danger-600/70
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(220,38,38,0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(220,38,38,0.4)',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,38,38,0.2)',
  },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  headerSub: { color: '#fca5a5', fontSize: 12, fontWeight: '600', marginTop: 1 },
  bodyScroll: { flexGrow: 0 },
  body: { paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  intro: { color: '#e4e4e7', fontSize: 14, lineHeight: 21 },
  ruleBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(30,30,42,0.6)', // star-800/60
    borderWidth: 1,
    borderColor: '#2a2a38', // star-700
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ruleBoxDanger: {
    backgroundColor: 'rgba(220,38,38,0.1)',
    borderColor: 'rgba(220,38,38,0.4)',
  },
  ruleIcon: { marginTop: 2 },
  ruleText: { flex: 1, color: '#e4e4e7', fontSize: 14, lineHeight: 20 },
  ruleTextDanger: { color: '#f4f4f5', fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#71717a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#6366f1', borderColor: '#6366f1' }, // star-primary-500
  checkLabel: { color: '#d4d4d8', fontSize: 12 },
  footer: { paddingHorizontal: 20, paddingBottom: 20 },
  continueBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#4f46e5', // star-primary-600
  },
  continueBtnPressed: { backgroundColor: '#6366f1' },
  continueText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});

export default memo(RulesWarningHost);