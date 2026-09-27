import React, { memo, useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import ChessFlow from '../../chess/components/ChessFlow';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';

// Floating window for playing chess inside a room - same 3 window-modes
// (half/full/hidden) as RoomNovelPanel, just with ChessFlow embedded
// instead of Novel Explore/Surf. ChessFlow already handles its own
// select -> difficulty -> playing flow; this panel only provides the
// chrome (drag/minimize/maximize/close) around it.
//
// WEB -> RN CHANGES:
// - `createPortal(document.body)` -> nothing needed. In RN this panel
//   just mounts as an absolute-positioned sibling near the screen root
//   (same convention as RoomInputOverlay.tsx) - `useTopZIndex` keeps it
//   stacked above everything else already in the tree.
// - Pointer drag (onPointerDown/Move/Up + manual jitter-threshold +
//   setPointerCapture) -> `react-native-gesture-handler`'s Gesture.Pan()
//   driven by reanimated shared values (same pattern as
//   shared/components/SwipeableBubble.tsx) - runs on the UI thread, no
//   manual jitter math needed (the gesture only "wins" past its own
//   built-in slop, so header-button taps are naturally unaffected since
//   they're separate Pressables outside the GestureDetector).
// - `window.innerWidth/innerHeight` -> `Dimensions.get('window')`.
// - CSS `min()` height formula (BOARD_VH_CAP/BOARD_PX_CAP/width-based)
//   -> computed once in JS on mount/resize instead (RN has no CSS
//   min(), so the three candidates are compared with Math.min directly).
const PANEL_W_FRAC = 0.92; // was 92vw
const HEADER_H = 34;
const EDGE_MARGIN = 8;
const BOARD_VH_CAP_FRAC = 0.42; // was 42vh
const BOARD_PX_CAP = 380;
const CONTENT_PAD = HEADER_H + 24; // header + ChessFlow's own padding (12px*2)

type WinMode = 'half' | 'full' | 'hidden';

function computePanelPxSize(screenW: number, screenH: number) {
  const w = Math.round(screenW * PANEL_W_FRAC);
  const boardFromWidth = w - 26; // ChessFlow padding(24) + border(~2)
  const boardFromHeight = screenH * BOARD_VH_CAP_FRAC;
  const boardSize = Math.min(boardFromWidth, boardFromHeight, BOARD_PX_CAP);
  const h = Math.round(CONTENT_PAD + boardSize);
  return { w, h };
}

function clampWorklet(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), Math.max(min, max));
}

interface RoomChessPanelProps {
  show: boolean;
  onClose: () => void;
}

const RoomChessPanel = ({ show, onClose }: RoomChessPanelProps) => {
  const __z = useTopZIndex(show);
  const [winMode, setWinMode] = useState<WinMode>('half');
  const [panelSize, setPanelSize] = useState<{ w: number; h: number } | null>(null);

  const posX = useSharedValue(0);
  const posY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useBackButtonHandler(show, onClose);

  useEffect(() => {
    if (show && !panelSize) {
      const { width, height } = Dimensions.get('window');
      const size = computePanelPxSize(width, height);
      setPanelSize(size);
      posX.value = Math.round((width - size.w) / 2);
      posY.value = Math.max(EDGE_MARGIN, height - size.h - 96);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const { width: screenW, height: screenH } = Dimensions.get('window');
  const maxX = panelSize ? screenW - panelSize.w - EDGE_MARGIN : EDGE_MARGIN;
  const maxY = panelSize ? screenH - panelSize.h - EDGE_MARGIN : EDGE_MARGIN;

  const pan = Gesture.Pan()
    .enabled(winMode === 'half' && !!panelSize)
    .onStart(() => {
      startX.value = posX.value;
      startY.value = posY.value;
    })
    .onUpdate((e) => {
      posX.value = clampWorklet(startX.value + e.translationX, EDGE_MARGIN, maxX);
      posY.value = clampWorklet(startY.value + e.translationY, EDGE_MARGIN, maxY);
    });

  const halfStyle = useAnimatedStyle(() => ({
    left: posX.value,
    top: posY.value,
  }));

  const closeDrawer = () => setWinMode('hidden');
  const toggleFull = () => setWinMode((m) => (m === 'full' ? 'half' : 'full'));

  if (!show) return null;

  // NOTE: we do NOT unmount ChessFlow in "hidden" mode (unlike Novel,
  // where navigation state is lifted into RoomNovelPanel itself - here
  // the whole board/game state lives inside ChessFlow's own internal
  // useState/useRef). So we only hide the panel (visibility/pointer
  // events), so that minimize -> resume picks the game back up exactly
  // where it was left off.
  return (
    <>
      {winMode === 'hidden' && (
        <Pressable
          onPress={() => setWinMode('half')}
          accessibilityLabel="Resume chess"
          // Same corner as RoomNovelPanel's resume button (bottom-LEFT,
          // since the room's "+" FAB lives bottom-right) - placed a bit
          // higher so that if Novel is ever minimized too, the two
          // buttons don't sit on top of each other.
          style={[styles.resumeBtn, { zIndex: __z }]}
        >
          <Ionicons name="skull-outline" size={22} color="#ffffff" />
        </Pressable>
      )}

      <Animated.View
        style={[
          styles.panel,
          winMode === 'full'
            ? styles.fullMode
            : winMode === 'hidden'
            ? styles.hiddenMode
            : [styles.halfMode, panelSize && { width: panelSize.w, height: panelSize.h }, halfStyle],
          { zIndex: __z },
        ]}
      >
        <View style={styles.header}>
          <GestureDetector gesture={pan}>
            <View style={styles.grip}>
              {winMode === 'half' && <Ionicons name="reorder-three-outline" size={14} color="#a8a0c0" />}
              <Text style={styles.gripLabel}>Chess</Text>
            </View>
          </GestureDetector>

          <View style={styles.headerBtns}>
            <Pressable onPress={closeDrawer} accessibilityLabel="Minimize" style={styles.headerBtn}>
              <Ionicons name="remove" size={14} color="#a8a0c0" />
            </Pressable>
            <Pressable onPress={toggleFull} accessibilityLabel={winMode === 'full' ? 'Exit full screen' : 'Full screen'} style={styles.headerBtn}>
              <Ionicons name={winMode === 'full' ? 'contract' : 'expand'} size={14} color="#a8a0c0" />
            </Pressable>
            <Pressable onPress={onClose} accessibilityLabel="Close" style={styles.headerBtn}>
              <Ionicons name="close" size={14} color="#a8a0c0" />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <ChessFlow />
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  resumeBtn: {
    position: 'absolute',
    left: 16,
    bottom: 166,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#7c3aed',
    borderWidth: 4, borderColor: '#0a0912',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  panel: {
    backgroundColor: '#0a0912',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#332b52',
  },
  fullMode: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hiddenMode: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, pointerEvents: 'none' as const },
  halfMode: { position: 'absolute' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: HEADER_H, paddingHorizontal: 8,
    backgroundColor: '#151024', borderBottomWidth: 1, borderBottomColor: '#332b52',
  },
  grip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: '100%' },
  gripLabel: { fontSize: 11, fontWeight: '700', color: '#a8a0c0' },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerBtn: { padding: 6, borderRadius: 999 },
  body: { flex: 1, minHeight: 0, position: 'relative' },
});

export default memo(RoomChessPanel);