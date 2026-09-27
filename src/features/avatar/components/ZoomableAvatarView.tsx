import React, { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AvatarLayers, { type EquippedByCategory } from './AvatarLayers';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const STEP = 0.4;
const ANIM = { duration: 150 };

const clamp = (v: number, min: number, max: number) => {
  'worklet';
  return Math.min(max, Math.max(min, v));
};

// Zoom ke hisaab se pan ki limit: image apne box se bahar utna hi khisak
// sakti hai jitna zoom ne use bada kiya hai (web mein pan free tha - yahan
// clamp hai taaki avatar poori tarah frame se bahar na kho jaye).
const limitPan = (s: number, w: number, h: number, x: number, y: number) => {
  'worklet';
  const mx = (w * (s - 1)) / 2;
  const my = (h * (s - 1)) / 2;
  return { x: clamp(x, -mx, mx), y: clamp(y, -my, my) };
};

/**
 * AvatarLayers ke upar sirf ek VISUAL zoom/pan layer (transform: scale +
 * translate). AvatarLayers ka apna letterbox (onLayout wala) waisa hi
 * chalta rehta hai kyunki transform layout size nahi badalta.
 *
 * Zoom control:
 * 1. Do ungliyon se pinch
 * 2. Corner ke +/- buttons
 * Zoom > 1 ho to ek ungli se drag karke pan. Double-tap se 1x par reset.
 * (Web ka mouse scroll-wheel zoom RN mein nahi hota - hata diya.)
 *
 * `style` prop se bahar wale box ka size/shape control hota hai (web ka
 * `className` - jaise ProfileCard ka aspect 4/5 ya customize-modal ka
 * 256x320). Baaki (exactFit, equippedByCategory, photoUrl) seedha
 * AvatarLayers ko forward.
 *
 * WEB -> RN CHANGES:
 * - Pointer Events (pointerdown/move/up + manual pinch distance) ->
 *   react-native-gesture-handler (Pinch + Pan + Tap) + reanimated shared
 *   values - gesture UI thread par chalta hai, smooth rehta hai.
 * - Pan sirf tab enabled hai jab zoom > 1: warna avatar par swipe karne
 *   se parent ScrollView (profile/feed) ka scroll block ho jata.
 * - SETUP: app ke root (_layout.tsx) ko <GestureHandlerRootView
 *   style={{ flex: 1 }}> se wrap karna zaroori hai.
 */
interface ZoomableAvatarViewProps {
  equippedByCategory?: EquippedByCategory;
  photoUrl?: string | null;
  exactFit?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ZoomableAvatarView = ({ equippedByCategory, photoUrl, exactFit, style }: ZoomableAvatarViewProps) => {
  // UI mirror (buttons ka disabled state + pan enable) - asli animation
  // shared values se hoti hai.
  const [zoom, setZoom] = useState(MIN_ZOOM);

  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const boxW = useSharedValue(0);
  const boxH = useSharedValue(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      boxW.value = e.nativeEvent.layout.width;
      boxH.value = e.nativeEvent.layout.height;
    },
    [boxW, boxH]
  );

  const applyZoom = useCallback(
    (next: number) => {
      const z = clamp(+next.toFixed(3), MIN_ZOOM, MAX_ZOOM);
      setZoom(z);
      scale.value = withTiming(z, ANIM);
      if (z === MIN_ZOOM) {
        tx.value = withTiming(0, ANIM);
        ty.value = withTiming(0, ANIM);
      } else {
        const p = limitPan(z, boxW.value, boxH.value, tx.value, ty.value);
        tx.value = withTiming(p.x, ANIM);
        ty.value = withTiming(p.y, ANIM);
      }
    },
    [scale, tx, ty, boxW, boxH]
  );

  const resetZoom = useCallback(() => applyZoom(MIN_ZOOM), [applyZoom]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const s = clamp(startScale.value * e.scale, MIN_ZOOM, MAX_ZOOM);
      scale.value = s;
      const p = limitPan(s, boxW.value, boxH.value, tx.value, ty.value);
      tx.value = p.x;
      ty.value = p.y;
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        scale.value = withTiming(1, ANIM);
        tx.value = withTiming(0, ANIM);
        ty.value = withTiming(0, ANIM);
        runOnJS(setZoom)(MIN_ZOOM);
      } else {
        runOnJS(setZoom)(+scale.value.toFixed(3));
      }
    });

  const pan = Gesture.Pan()
    .enabled(zoom > MIN_ZOOM)
    .maxPointers(1)
    .minDistance(4)
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      const p = limitPan(
        scale.value,
        boxW.value,
        boxH.value,
        startX.value + e.translationX,
        startY.value + e.translationY
      );
      tx.value = p.x;
      ty.value = p.y;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (!success) return;
      scale.value = withTiming(1, ANIM);
      tx.value = withTiming(0, ANIM);
      ty.value = withTiming(0, ANIM);
      runOnJS(setZoom)(MIN_ZOOM);
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.fill, animatedStyle]}>
          <AvatarLayers equippedByCategory={equippedByCategory} photoUrl={photoUrl} exactFit={exactFit} />
        </Animated.View>
      </GestureDetector>

      {/* Corner zoom controls - pinch na kar paane waalon ke liye bhi */}
      <View style={styles.controls} pointerEvents="box-none">
        <Pressable
          onPress={() => applyZoom(zoom + STEP)}
          disabled={zoom >= MAX_ZOOM}
          accessibilityLabel="Zoom in"
          style={({ pressed }) => [
            styles.btn,
            zoom >= MAX_ZOOM && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Ionicons name="add" size={14} color="#ffffff" />
        </Pressable>
        <Pressable
          onPress={() => applyZoom(zoom - STEP)}
          disabled={zoom <= MIN_ZOOM}
          accessibilityLabel="Zoom out"
          style={({ pressed }) => [
            styles.btn,
            zoom <= MIN_ZOOM && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Ionicons name="remove-outline" size={14} color="#ffffff" />
        </Pressable>
        {zoom > MIN_ZOOM && (
          <Pressable
            onPress={resetZoom}
            accessibilityLabel="Reset zoom"
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Ionicons name="expand-outline" size={12} color="#ffffff" />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  controls: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    gap: 4,
    zIndex: 10,
  },
  btn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  btnPressed: { transform: [{ scale: 0.9 }] },
});

export default memo(ZoomableAvatarView);