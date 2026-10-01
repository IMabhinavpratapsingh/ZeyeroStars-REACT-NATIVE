import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient as SvgLinear, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BluffCard from './BluffCard';
import { sigilById, type SigilId } from '../theme/bluffTheme';

// Oval "Shadow's Table" - beech mein pile (card backs), left mein "N in pile",
// right mein round chip. Pile ka center card-play animation ka landing point hai.
interface Props {
  callSigilId?: SigilId | null;
  pileCount: number;
  round: number;
  alive: number;
  /** flying cards ka target measure karne ke liye */
  pileRef: React.RefObject<View | null>;
  /** har baar card pile par land ho to badhta hai -> pile "thump" karti hai */
  landTick: number;
}

const BluffArena = ({ callSigilId, pileCount, round, alive, pileRef, landTick }: Props) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const call = callSigilId ? sigilById(callSigilId) : null;
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!landTick) return;
    scale.value = withSequence(withTiming(1.1, { duration: 110 }), withTiming(1, { duration: 160 }));
  }, [landTick, scale]);
  const pileStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const stack = Math.min(pileCount, 5);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="felt" cx="50%" cy="48%" rx="60%" ry="60%">
              <Stop offset="0" stopColor="#2c1760" />
              <Stop offset="1" stopColor="#120a2a" />
            </RadialGradient>
            <SvgLinear id="rim" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#f59e0b" />
              <Stop offset="0.5" stopColor="#7c3aed" />
              <Stop offset="1" stopColor="#f59e0b" />
            </SvgLinear>
          </Defs>
          <Ellipse cx={size.w / 2} cy={size.h / 2} rx={size.w / 2 - 6} ry={size.h / 2 - 6} fill="url(#felt)" stroke="url(#rim)" strokeWidth={4} />
          <Ellipse cx={size.w / 2} cy={size.h / 2} rx={size.w / 2 - 26} ry={size.h / 2 - 22} fill="none" stroke="rgba(167,139,250,0.28)" strokeWidth={1.5} />
        </Svg>
      )}

      <View style={styles.titleWrap} pointerEvents="none">
        <MaterialCommunityIcons name="crown" size={30} color="rgba(139,92,246,0.7)" />
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
          {call ? `${call.name.toUpperCase()}'S TABLE` : 'THE TABLE'}
        </Text>
      </View>

      <View ref={pileRef} collapsable={false} style={styles.pileSpot}>
        <Animated.View style={[styles.pile, pileStyle]}>
          {stack === 0 ? (
            <View style={styles.emptyPile} />
          ) : (
            Array.from({ length: stack }).map((_, i) => (
              <View key={i} style={{ position: 'absolute', top: -i * 3, left: i % 2 === 0 ? 0 : 2 }}>
                <BluffCard dims={{ w: 56, h: 76 }} />
              </View>
            ))
          )}
        </Animated.View>
      </View>

      <View style={styles.pileChip}>
        <Ionicons name="albums-outline" size={20} color="#c4b5fd" />
        <View>
          <Text style={styles.chipBig}>{pileCount}</Text>
          <Text style={styles.chipSmall}>in pile</Text>
        </View>
      </View>

      <View style={styles.roundChip}>
        <MaterialCommunityIcons name="crown" size={12} color="#f59e0b" />
        <Text style={styles.chipSmall}>Round</Text>
        <Text style={styles.chipBig}>{round}</Text>
        <View style={styles.dots}>
          {Array.from({ length: Math.max(alive, 1) }).map((_, i) => (
            <View key={i} style={[styles.dot, i === 0 && { backgroundColor: '#a78bfa' }]} />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, marginHorizontal: -6, marginVertical: 6, minHeight: 200 },
  titleWrap: { position: 'absolute', top: '16%', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 44 },
  title: {
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
    color: 'rgba(139,92,246,0.75)',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  pileSpot: { position: 'absolute', top: '52%', left: '50%', width: 60, height: 82, marginLeft: -30, marginTop: -4 },
  pile: { width: 60, height: 82, alignItems: 'center', justifyContent: 'center' },
  emptyPile: { width: 56, height: 76, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(167,139,250,0.35)' },
  pileChip: {
    position: 'absolute',
    left: '5%',
    bottom: '14%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(12,6,24,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  roundChip: {
    position: 'absolute',
    right: '4%',
    bottom: '12%',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(12,6,24,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  chipBig: { fontSize: 18, fontWeight: '800', color: '#fff', lineHeight: 20 },
  chipSmall: { fontSize: 10, color: '#a78bfa' },
  dots: { flexDirection: 'row', gap: 4, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
});

export default memo(BluffArena);