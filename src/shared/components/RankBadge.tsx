import React, { memo, useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { getRankStyle } from '../utils/rankStyles';

const AnimatedText = Animated.createAnimatedComponent(Text);

/**
 * Rank number ko uske tier-color ke saath shine effect me dikhata hai.
 * size: "sm" (feed/comments me chhota) ya "lg" (profile page me bada)
 *
 * WEB -> RN CHANGE:
 * Web version mein do hisse the: (1) `background-clip: text` gradient
 * SHIMMER jo sirf high-tier (rank > 50) ranks par text ke andar chamakta
 * tha, aur (2) `filter: drop-shadow` GLOW pulse. RN Text `background-clip`
 * support nahi karta (gradient-fill text ke liye MaskedView + LinearGradient
 * chahiye - extra native deps), isliye abhi sirf GLOW-pulse part convert
 * kiya hai (RN `textShadowColor/Radius` se, jo Text par directly kaam
 * karta hai). Text solid rank-color mein flat rehta hai, gradient-shimmer
 * nahi hota.
 * -> Agar shimmer bhi chahiye: `@react-native-masked-view/masked-view` +
 *    `expo-linear-gradient` install karke bata dena, wo version bana dunga.
 *
 * PERF: web wala comment - "30s cycle, sirf shuru ke ~1s mein burst, baaki
 * static" - wahi philosophy yahan bhi follow ki hai. `withRepeat` reanimated
 * ke UI thread par chalta hai (JS thread block nahi hoti), aur cycle lamba
 * (30s) hai isliye baar-baar repaint/battery-drain nahi hota jaisa pehle
 * (chhote per-tier duration wale) version mein hota tha.
 */
interface RankBadgeProps {
  rank: number | string | null | undefined;
  size?: 'sm' | 'lg';
}

const RankBadge = ({ rank, size = 'lg' }: RankBadgeProps) => {
  const glowRadius = useSharedValue(4);

  const isHighTier = rank !== null && rank !== undefined && Number(rank) > 50;
  const isInferno = isHighTier && getRankStyle(rank as number).tierSlug === 'inferno';

  useEffect(() => {
    if (!isHighTier) {
      glowRadius.value = 4;
      return;
    }
    // Dormant (4px) -> burst (14px, ya inferno ke liye double-beat) ->
    // dormant, ek 30s cycle ke andar - baaki ~29s static rehta hai.
    if (isInferno) {
      glowRadius.value = withRepeat(
        withSequence(
          withTiming(4, { duration: 750 }),
          withTiming(20, { duration: 750, easing: Easing.out(Easing.ease) }),
          withTiming(3, { duration: 450 }),
          withTiming(4, { duration: 27600 })
        ),
        -1
      );
    } else {
      glowRadius.value = withRepeat(
        withSequence(
          withTiming(4, { duration: 750 }),
          withTiming(14, { duration: 750, easing: Easing.out(Easing.ease) }),
          withTiming(4, { duration: 28500 })
        ),
        -1
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHighTier, isInferno, rank]);

  const animatedStyle = useAnimatedStyle(() => ({
    textShadowRadius: glowRadius.value,
  }));

  if (rank === null || rank === undefined) return null;

  const { color, tierName } = getRankStyle(rank);

  return (
    <AnimatedText
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.lg,
        { color, textShadowColor: color },
        animatedStyle,
      ]}
      accessibilityLabel={`Rank ${rank}`}
    >
      {tierName.toUpperCase()} {rank}
    </AnimatedText>
  );
};

const styles = StyleSheet.create({
  base: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowOffset: { width: 0, height: 0 },
  },
  sm: {
    fontSize: 13,
    fontWeight: '700',
  },
  lg: {
    fontSize: 24,
  },
});

export default memo(RankBadge);