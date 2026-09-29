import React, { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BluffCard from './BluffCard';
import type { SigilId } from '../theme/bluffTheme';

// Apna hand - hamesha face-up dikhta hai (sirf khud ko). Player 1 ya
// zyada cards select kar sakta hai (limit = maxPlayCount), phir PLAY
// dabaakar unhe face-down table pe daal deta hai.
interface BluffHandTrayProps {
  hand?: (SigilId | null)[];
  canPlay: boolean;
  maxPlayCount?: number;
  onPlay: (indexes: number[]) => void;
}

const BluffHandTray = ({ hand = [], canPlay, maxPlayCount = 3, onPlay }: BluffHandTrayProps) => {
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setSelected([]);
  }, [hand]);

  const toggle = (idx: number) => {
    if (!canPlay) return;
    setSelected((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      if (prev.length >= maxPlayCount) return prev;
      return [...prev, idx];
    });
  };

  const handlePlay = () => {
    if (!canPlay || selected.length === 0) return;
    onPlay(selected);
    setSelected([]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.hint}>{canPlay ? `Select up to ${maxPlayCount} cards` : 'Waiting...'}</Text>
        <Text style={styles.count}>{selected.length} selected</Text>
      </View>

      <View style={styles.fan}>
        {hand.map((sigilId, idx) => {
          const mid = (hand.length - 1) / 2;
          const offset = idx - mid;
          const rotate = offset * 8;
          const isSelected = selected.includes(idx);
          const lift = isSelected ? -10 : Math.abs(offset) * 4;
          return (
            <View
              key={`${sigilId}-${idx}`}
              style={{
                transform: [{ rotate: `${rotate}deg` }, { translateY: lift }],
                marginLeft: idx === 0 ? 0 : -18,
                zIndex: idx,
              }}
            >
              <BluffCard
                sigilId={sigilId}
                faceUp
                size="lg"
                selected={isSelected}
                onPress={canPlay ? () => toggle(idx) : undefined}
              />
            </View>
          );
        })}
        {hand.length === 0 && <Text style={styles.empty}>Your hand is empty.</Text>}
      </View>

      <Pressable
        onPress={handlePlay}
        disabled={!canPlay || selected.length === 0}
        style={[styles.playButton, (!canPlay || selected.length === 0) && styles.playButtonDisabled]}
      >
        <Text style={[styles.playButtonText, (!canPlay || selected.length === 0) && styles.playButtonTextDisabled]}>
          Play {selected.length > 0 ? `${selected.length} Card${selected.length > 1 ? 's' : ''}` : 'Cards'} Face-Down
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: '#1c1c1c',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  hint: { fontSize: 11, color: '#9a9a9a' },
  count: { fontSize: 11, color: '#6e6e6e' },
  fan: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, minHeight: 96, alignItems: 'flex-end' },
  empty: { fontSize: 12, color: '#3f3f3f', paddingVertical: 16 },
  playButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#e0883a',
  },
  playButtonDisabled: { backgroundColor: '#161616' },
  playButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  playButtonTextDisabled: { color: '#3f3f3f' },
});

export default memo(BluffHandTray);
