import React, { useEffect } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CropRegion, PickedSource } from '../services/dmWallpaper';

/**
 * Wallpaper crop/adjust screen (WhatsApp jaisa).
 *
 * Frame = poori screen ka size (wahi jo chat window hai), isliye yahan jo
 * dikh raha hai wahi chat me wallpaper banega. Drag = position, pinch = zoom.
 * Image hamesha "cover" rehti hai (frame kabhi khali nahi dikhta).
 *
 * Confirm par screen ke visible hisse ko image ke pixel coordinates me
 * convert karke `onConfirm(region)` bulata hai - actual crop dmWallpaper.ts
 * karta hai (expo-image-manipulator).
 *
 * Modal alag native window hai, isliye andar apna GestureHandlerRootView
 * zaroori hai (warna Android pe gestures kaam nahi karte).
 */

const MAX_SCALE = 4;

const clamp = (v: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(v, min), max);
};

interface Props {
  source: PickedSource | null;
  /**
   * Jis jagah wallpaper lagega uska width/height. Na do to poori screen
   * (DM chat). Inbox jaisi chhoti jagah ke liye do - frame usi shape ka banta hai.
   */
  aspect?: number;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: (region: CropRegion) => void;
}

const WallpaperCropModal = ({ source, aspect, saving = false, onCancel, onConfirm }: Props) => {
  const { width: winW, height: winH } = useWindowDimensions();
  // Frame: width = screen width; height = aspect ke hisaab se (ya poori screen). Beech me center.
  const fw = winW;
  const fh = aspect && aspect > 0 ? Math.min(winH, winW / aspect) : winH;
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1); // 1 = "cover" fit; zoom iske upar multiply
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Nayi image aaye to position reset
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
  }, [source?.uri, scale, savedScale, tx, ty, savedTx, savedTy]);

  const iw = source?.width || 1;
  const ih = source?.height || 1;
  const base = Math.max(fw / iw, fh / ih); // cover scale
  const dw = iw * base; // image ki displayed width (scale=1 pe)
  const dh = ih * base;

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      const maxX = Math.max(0, (dw * scale.value - fw) / 2);
      const maxY = Math.max(0, (dh * scale.value - fh) / 2);
      tx.value = clamp(savedTx.value + e.translationX, -maxX, maxX);
      ty.value = clamp(savedTy.value + e.translationY, -maxY, maxY);
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const s = clamp(savedScale.value * e.scale, 1, MAX_SCALE);
      scale.value = s;
      const maxX = Math.max(0, (dw * s - fw) / 2);
      const maxY = Math.max(0, (dh * s - fh) / 2);
      tx.value = clamp(tx.value, -maxX, maxX);
      ty.value = clamp(ty.value, -maxY, maxY);
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const handleConfirm = () => {
    if (!source || saving) return;
    // s = image ke 1 pixel ka screen pe kitna size
    const s = base * scale.value;
    const visW = fw / s;
    const visH = fh / s;
    const width = Math.max(1, Math.min(iw, Math.floor(visW)));
    const height = Math.max(1, Math.min(ih, Math.floor(visH)));
    const rawX = iw / 2 - visW / 2 - tx.value / s;
    const rawY = ih / 2 - visH / 2 - ty.value / s;
    const originX = clamp(Math.round(rawX), 0, iw - width);
    const originY = clamp(Math.round(rawY), 0, ih - height);
    onConfirm({ originX, originY, width, height });
  };

  return (
    <Modal visible={!!source} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <GestureHandlerRootView style={styles.root}>
        {source && (
          <GestureDetector gesture={gesture}>
            <View style={[styles.frame, { width: fw, height: fh, top: (winH - fh) / 2 }]}>
              <Animated.View
                style={[
                  { position: 'absolute', width: dw, height: dh, left: (fw - dw) / 2, top: (fh - dh) / 2 },
                  imgStyle,
                ]}
              >
                <ExpoImage source={{ uri: source.uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
              </Animated.View>
            </View>
          </GestureDetector>
        )}

        {/* Upar hint */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]} pointerEvents="none">
          <Text style={styles.hint}>Drag & pinch to adjust</Text>
        </View>

        {/* Neeche buttons */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable onPress={onCancel} disabled={saving} style={[styles.btn, styles.btnGhost]}>
            <Text style={styles.btnText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleConfirm} disabled={saving} style={[styles.btn, styles.btnPrimary]}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Set wallpaper</Text>}
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  frame: { position: 'absolute', left: 0, overflow: 'hidden' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 10 },
  hint: {
    color: '#ffffff',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  btn: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: 'rgba(0,0,0,0.6)' },
  btnPrimary: { backgroundColor: '#4f46e5' },
  btnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});

export default WallpaperCropModal;