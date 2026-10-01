import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import BluffCard from './BluffCard';
import type { SigilId } from '../theme/bluffTheme';

// Apna hand - hamesha face-up fan. Selection state parent (BluffGamePage)
// rakhta hai (bottom bar ka CALL button usi se enable hota hai).
interface BluffHandTrayProps {
  hand?: (SigilId | null)[];
  selected: number[];
  canPlay: boolean;
  maxPlayCount?: number;
  onToggle: (idx: number) => void;
  /** card-play animation ka origin measure karne ke liye */
  containerRef?: React.RefObject<View | null>;
}

const BluffHandTray = ({ hand = [], selected, canPlay, maxPlayCount = 3, onToggle, containerRef }: BluffHandTrayProps) => {
  const overlap = hand.length > 6 ? -34 : hand.length > 5 ? -22 : -12;

  return (
    <View ref={containerRef} collapsable={false} style={styles.fan}>
      {hand.map((sigilId, idx) => {
        const mid = (hand.length - 1) / 2;
        const offset = idx - mid;
        const isSelected = selected.includes(idx);
        return (
          <MotiView
            key={`${sigilId}-${idx}`}
            animate={{
              translateY: isSelected ? -18 : Math.abs(offset) * 6,
              rotate: `${offset * 7}deg`,
            }}
            transition={{ type: 'timing', duration: 160, easing: Easing.out(Easing.cubic) }}
            style={{ marginLeft: idx === 0 ? 0 : overlap, zIndex: isSelected ? 50 : idx }}
          >
            <BluffCard
              sigilId={sigilId}
              faceUp
              size="lg"
              selected={isSelected}
              onPress={canPlay ? () => onToggle(idx) : undefined}
            />
          </MotiView>
        );
      })}
      {hand.length === 0 && <Text style={styles.empty}>Your hand is empty.</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  fan: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', minHeight: 118, paddingTop: 22 },
  empty: { fontSize: 12, color: '#6b5b8f', paddingVertical: 24 },
});

export default memo(BluffHandTray);