import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { SlideUp } from '../../../shared/components/motion/ScreenTransition';

/**
 * request: { trade_id, from_id, from_username } | null
 *
 * Pehle yeh ek bada full-screen overlay tha jo poori screen block kar deta
 * tha - koi bhi random user trade request bhej ke doosre ko pareshan kar
 * sakta tha. Ab yeh mention-notification jaisa hi ek chhota, non-blocking
 * banner hai - "X started a trade with you" - saath mein hi Accept/Decline
 * ke chhote buttons. Baaki app ke saath interact karna block nahi hota.
 *
 * WEB -> RN CHANGES:
 * - Web version ne alag se ek plain positioning div + andar motion.div
 *   (sirf y/opacity) rakha tha taaki x-centering aur framer-motion ka
 *   transform ek doosre se clash na karein. RN mein yeh clash hota hi
 *   nahi (transform yahan properly composable hai), isliye seedha
 *   `SlideUp`-jaisa ek `y+opacity` transition (shared ScreenTransition
 *   se) top-centered wrapper ke andar - same NotificationToast.tsx wala
 *   pattern.
 * - `lucide-react` (X/Check) -> `Ionicons`.
 * - `e.stopPropagation()` -> RN mein Pressable events bubble nahi hote
 *   web jaisे (koi DOM event-bubbling nahi), isliye Accept/Decline
 *   buttons ke apne `onPress` already outer card ka `onPress` trigger
 *   nahi karte - stopPropagation ki zaroorat hi nahi padi.
 */
interface TradeRequest {
  trade_id: number | string;
  from_id: number | string;
  from_username?: string;
}
interface TradeRequestModalProps {
  request: TradeRequest | null;
  onAccept: (request: TradeRequest) => void;
  onDecline: (request: TradeRequest) => void;
  onOpenChat?: (request: TradeRequest) => void;
}

const TradeRequestModal = ({ request, onAccept, onDecline, onOpenChat }: TradeRequestModalProps) => {
  const __z = useTopZIndex(request);

  if (!request) return null;

  const initial = (request.from_username || '?').charAt(0).toUpperCase();

  return (
    <View style={[styles.outer, { zIndex: __z }]} pointerEvents="box-none">
      <SlideUp show={!!request} style={styles.wrap}>
        <Pressable onPress={() => onOpenChat && onOpenChat(request)} style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {request.from_username || 'Someone'} started a trade with you
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => onDecline(request)} style={styles.declineBtn}>
              <Ionicons name="close" size={14} color="#ffffff" />
            </Pressable>
            <Pressable onPress={() => onAccept(request)} style={styles.acceptBtn}>
              <Ionicons name="checkmark" size={14} color="#ffffff" />
            </Pressable>
          </View>
        </Pressable>
      </SlideUp>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  wrap: {
    width: '90%',
    maxWidth: 384,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e1e2a',
    borderWidth: 1,
    borderColor: '#2a2a38',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4f46e5',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarLetter: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  textWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  actions: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  declineBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#3a3a4a', alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center',
  },
});

export default memo(TradeRequestModal);