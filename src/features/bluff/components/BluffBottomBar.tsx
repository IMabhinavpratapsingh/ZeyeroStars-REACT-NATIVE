import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { sigilById, ACCUSE_LABEL, type SigilId } from '../theme/bluffTheme';

// Neeche ke do bade buttons:
//  CALL <SIGIL>  - selected cards face-down table par khelo (call ka claim)
//  ACCUSE        - pichhle player ka play challenge karo
interface Props {
  callSigilId?: SigilId | null;
  canPlay: boolean;
  canAccuse: boolean;
  onPlay: () => void;
  onAccuse: () => void;
  bottomInset?: number;
}

const BluffBottomBar = ({ callSigilId, canPlay, canAccuse, onPlay, onAccuse, bottomInset = 0 }: Props) => {
  const call = callSigilId ? sigilById(callSigilId) : null;

  return (
    <View style={[styles.wrap, { paddingBottom: 10 + bottomInset }]}>
      <Pressable onPress={onPlay} disabled={!canPlay} style={[styles.callBtn, !canPlay && styles.disabled]}>
        <Ionicons name={(call?.icon || 'moon') as any} size={22} color={call?.color || '#c4b5fd'} />
        <Text style={styles.callText} numberOfLines={1}>
          CALL {call ? call.name.toUpperCase() : ''}
        </Text>
      </Pressable>

      <Pressable onPress={onAccuse} disabled={!canAccuse} style={[styles.accuseOuter, !canAccuse && styles.disabled]}>
        <LinearGradient colors={['#ff4d3d', '#b91c1c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.accuseBtn}>
          <Ionicons name="flame" size={28} color="#fff" />
          <Text style={styles.accuseText}>{ACCUSE_LABEL}</Text>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: 'rgba(6,3,14,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(124,58,237,0.25)',
  },
  disabled: { opacity: 0.38 },
  callBtn: {
    flex: 0.9,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#24124a',
    borderWidth: 1.5,
    borderColor: '#6d4bb0',
  },
  callText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, color: '#e9d5ff' },
  accuseOuter: {
    flex: 1.25,
    height: 56,
    borderRadius: 28,
    shadowColor: '#ff3b30',
    shadowOpacity: 0.8,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  accuseBtn: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#ff8a7a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  accuseText: { fontSize: 24, fontWeight: '900', fontStyle: 'italic', color: '#fff', letterSpacing: 1 },
});

export default memo(BluffBottomBar);