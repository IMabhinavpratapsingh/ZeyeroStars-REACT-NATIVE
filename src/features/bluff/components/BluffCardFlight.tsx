import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import BluffCard from './BluffCard';

// Card-play animation: jab koi player cards khelta hai to utne face-down
// cards uski seat (ya apne hand) se uthkar table ki pile par udte hue
// "rakhe" jaate hain. Coordinates root-relative hain (BluffGamePage measure karta hai).
const W = 52;
const H = 72;
const STAGGER = 90;
const DURATION = 460;

export const FLIGHT_TOTAL_MS = (count: number) => (Math.min(count, 3) - 1) * STAGGER + DURATION + 30;

const FlyingCard = ({ from, to, index, total }: { from: { x: number; y: number }; to: { x: number; y: number }; index: number; total: number }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(index * STAGGER, withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }));
  }, [index, p]);

  const spread = index - (total - 1) / 2;
  const style = useAnimatedStyle(() => {
    const k = 1 - p.value;
    return {
      opacity: interpolate(p.value, [0, 0.06, 1], [0, 1, 1]),
      transform: [
        { translateX: (from.x - to.x) * k + spread * 6 * p.value },
        { translateY: (from.y - to.y) * k - Math.sin(p.value * Math.PI) * 46 },
        { rotate: `${spread * 14 * k + spread * 4 * p.value}deg` },
        { scale: interpolate(p.value, [0, 1], [1.15, 0.86]) },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.card, { left: to.x - W / 2, top: to.y - H / 2 }, style]}>
      <BluffCard dims={{ w: W, h: H }} />
    </Animated.View>
  );
};

interface Props {
  flight: { id: number; from: { x: number; y: number }; to: { x: number; y: number }; count: number } | null;
}

const BluffCardFlight = ({ flight }: Props) => {
  if (!flight) return null;
  const total = Math.min(flight.count, 3);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: total }).map((_, i) => (
        <FlyingCard key={`${flight.id}-${i}`} from={flight.from} to={flight.to} index={i} total={total} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { position: 'absolute', width: W, height: H },
});

export default memo(BluffCardFlight);