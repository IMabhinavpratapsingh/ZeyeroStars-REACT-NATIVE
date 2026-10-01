import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { sigilById, type SigilId } from '../theme/bluffTheme';

// Ek card - teen states:
// - face-down (dark purple back + crown emblem, kisi sigil ki hint nahi)
// - face-up-self (apna hi hand, neon sigil border)
// - revealed (challenge ke baad, doosron ko bhi dikhta hai)
interface BluffCardProps {
  sigilId?: SigilId | null;
  faceUp?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** size preset ki jagah exact dimensions (pile / flying cards ke liye) */
  dims?: { w: number; h: number };
  selected?: boolean;
  revealed?: boolean;
  onPress?: () => void;
}

const DIMS = {
  sm: { w: 32, h: 44 },
  md: { w: 44, h: 60 },
  lg: { w: 68, h: 96 },
};

const BluffCard = ({ sigilId, faceUp = false, size = 'md', dims: dimsProp, selected = false, revealed = false, onPress }: BluffCardProps) => {
  const dims = dimsProp || DIMS[size];
  const sigil = faceUp || revealed ? sigilById(sigilId) : null;
  const big = dims.w >= 60;
  const iconSize = Math.round(dims.w * (big ? 0.38 : 0.42));

  const content = (
    <View
      style={[
        styles.card,
        { width: dims.w, height: dims.h },
        sigil
          ? { borderColor: selected ? '#c4b5fd' : sigil.color, shadowColor: selected ? '#a78bfa' : sigil.color }
          : styles.backBorder,
        sigil && styles.glow,
        selected && styles.glowSelected,
      ]}
    >
      {sigil ? (
        <LinearGradient colors={[`${sigil.color}38`, '#0a1020']} style={styles.fill}>
          <Ionicons name={sigil.icon as any} size={iconSize} color={sigil.color} style={styles.sigilIcon} />
          {dims.w >= 40 && (
            <Text style={[styles.sigilName, { color: sigil.color, fontSize: big ? 10 : 7 }]} numberOfLines={1}>
              {sigil.name.toUpperCase()}
            </Text>
          )}
        </LinearGradient>
      ) : (
        <LinearGradient colors={['#2b1650', '#10081f']} style={styles.fill}>
          <View style={styles.backInner}>
            <MaterialCommunityIcons name="crown" size={Math.round(dims.w * 0.42)} color="rgba(167,139,250,0.55)" />
          </View>
        </LinearGradient>
      )}

      {selected && (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={11} color="#fff" />
        </View>
      )}
      {revealed && <View style={styles.revealedRing} />}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} hitSlop={4}>
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 2, overflow: 'visible' },
  fill: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' },
  glow: { shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  glowSelected: { shadowOpacity: 0.95, shadowRadius: 14, elevation: 12 },
  backBorder: { borderColor: '#6d4bb0' },
  backInner: {
    width: '78%',
    height: '82%',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilIcon: { marginTop: 4 },
  sigilName: { fontWeight: '800', letterSpacing: 0.4 },
  checkBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8b5cf6',
    borderWidth: 1.5,
    borderColor: '#ddd6fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealedRing: { ...StyleSheet.absoluteFill, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
});

export default memo(BluffCard);