import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sigilById, type SigilId } from '../theme/bluffTheme';

// Ek card - teen states:
// - face-down (back design, sirf ek generic diamond pattern - kisi bhi
//   sigil ki hint nahi deta)
// - face-up-self (apna hi hand, sigil dikhta hai)
// - revealed (challenge ke baad, doosron ko bhi dikhta hai)
interface BluffCardProps {
  sigilId?: SigilId | null;
  faceUp?: boolean;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  revealed?: boolean;
  onPress?: () => void;
}

const DIMS = {
  sm: { w: 32, h: 44 },
  md: { w: 44, h: 60 },
  lg: { w: 64, h: 88 },
};

const BluffCard = ({ sigilId, faceUp = false, size = 'md', selected = false, revealed = false, onPress }: BluffCardProps) => {
  const dims = DIMS[size];
  const sigil = faceUp || revealed ? sigilById(sigilId) : null;

  const content = (
    <View
      style={[
        styles.card,
        { width: dims.w, height: dims.h },
        selected ? styles.selected : styles.notSelected,
        sigil
          ? { backgroundColor: `${sigil.color}22`, borderColor: sigil.color }
          : styles.backDesign,
        selected && { transform: [{ translateY: -8 }] },
      ]}
    >
      {sigil ? (
        <View style={styles.sigilWrap}>
          <Ionicons name={sigil.icon as any} size={size === 'lg' ? 22 : size === 'sm' ? 12 : 16} color={sigil.color} />
          {size !== 'sm' && (
            <Text style={[styles.sigilName, { color: sigil.color }]} numberOfLines={1}>
              {sigil.name}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.backPattern} />
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
  card: {
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    borderColor: '#facc15',
    shadowColor: '#facc15',
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  notSelected: {
    borderColor: '#262626',
  },
  backDesign: {
    backgroundColor: '#0f0f0f',
  },
  sigilWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  sigilName: {
    fontSize: 7,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  backPattern: {
    width: '45%',
    height: '45%',
    borderWidth: 1,
    borderColor: '#3f3f3f',
    transform: [{ rotate: '45deg' }],
    opacity: 0.6,
  },
  revealedRing: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

export default memo(BluffCard);
