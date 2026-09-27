import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FadeIn } from './motion/ScreenTransition';

/**
 * Jab bhi WebSocket connection drop ho jaye (mobile screen band hona,
 * network switch hona, app background mein jaana, etc.) - poori app
 * silently "dead" state mein nahi rehni chahiye (messages/matchmaking
 * kaam na karna bina kisi wajah ke). Iske bajaye ek clear overlay
 * dikhao: "You are disconnected" + "Reconnect" button.
 *
 * WEB -> RN CHANGE: `fixed inset-0` -> `position: 'absolute', ...0` (RN
 * mein koi `fixed` nahi hota; parent ko poori screen cover karne wale
 * root View ke andar render karna, jaisa web mein bhi tha - z-index still
 * caller `zIndex` prop se control karta hai, jaisa pehle tha).
 */
interface DisconnectedOverlayProps {
  show: boolean;
  onReconnect: () => void;
  zIndex?: number;
}

const DisconnectedOverlay = ({ show, onReconnect, zIndex }: DisconnectedOverlayProps) => {
  return (
    <FadeIn show={show} style={[styles.backdrop, { zIndex }]}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-offline-outline" size={40} color="#f87171" />
        </View>
        <Text style={styles.title}>You are disconnected</Text>
        <Text style={styles.subtitle}>
          The connection to the server has dropped - messages, matchmaking, and trades won&apos;t work right now.
        </Text>
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={onReconnect}>
          <Ionicons name="refresh-outline" size={16} color="#ffffff" />
          <Text style={styles.buttonText}>Reconnect</Text>
        </Pressable>
      </View>
    </FadeIn>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#1e1e2a', // star-800
    borderWidth: 1,
    borderColor: '#2a2a38', // star-700
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 384,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  iconWrap: {
    marginBottom: 12,
  },
  title: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#9ca3af', // star-400
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 18,
  },
  button: {
    width: '100%',
    backgroundColor: '#4f46e5', // star-primary-600
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPressed: {
    backgroundColor: '#6366f1', // star-primary-500
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default memo(DisconnectedOverlay);