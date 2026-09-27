import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AvatarLayers from '../../avatar/components/AvatarLayers';
import useAvatarImage from '../../avatar/hooks/useAvatarImage';
import { AVATAR_ASPECT_RATIO_NUM } from '../../avatar/utils/avatarAssets';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import useItemsCatalog from '../../../shared/hooks/useItemsCatalog';
import { getEquippedByCategory } from '../../../shared/utils/profileHelpers';
import { FIELD } from '../../../shared/utils/profileFields';
import { getMyId } from '../../../shared/utils/auth';
import networkManager from '../../../shared/services/NetworkManager';
import PlayerPreviewModal from './PlayerPreviewModal';
import {
  ROOM_MAIN_GATE_POS,
  getMemberProfilePatch,
  subscribeMemberProfileUpdates,
  subscribeReaction,
  subscribeTipFlight,
  type RoomReactionEvent,
  type TipFlyEvent,
} from '../services/roomFloorBus';

/**
 * Web version (RoomFloorView.jsx, 1559 lines) ka RN port - PLAYER ROOM
 * ka floor (avatar grid, pan/pinch/tap-to-move, tips/reactions).
 *
 * SCOPE (jaisa maanga gaya): room-shop se rakhe hue decorative ITEMS
 * (RoomItemShopModal / edit-mode drag-place) is port mein NAHI hain -
 * web version ka sabse bada hissa (item drag/snap/palette) isi wajah se
 * chhoda gaya hai, isliye yeh file uske comparison mein bahut chhoti
 * hai. Baaki sab (movement, tips, reactions, chat bubbles, badges) hai.
 *
 * WEB -> RN CHANGES (major):
 * - Pointer-events + imperative DOM style writes (perf-hack, dekho web
 *   comments "applyCameraStyleNow"/"markInteracting") -> Reanimated
 *   shared values + `react-native-gesture-handler`. Reanimated worklets
 *   already UI-thread par chalte hain, isliye woh poora "stale JSX
 *   overwrite" bug class (jiske liye web mein useLayoutEffect safety-net
 *   likha gaya tha) yahan structurally exist hi nahi karta.
 * - `ResizeObserver` -> `onLayout`.
 * - Do nested divs (`boxRef` scale + `sceneRef` translate) -> do nested
 *   Animated.View (outer: scale, inner: translate) - bilkul wahi
 *   two-level transform structure.
 * - Mouse wheel-zoom hata diya (touch-only device); pinch-zoom hai.
 * - Bubble anti-overlap collision (rAF loop, web comment "Bubbles ka
 *   anti-overlap") skip kiya - dense room me do bubbles kabhi-kabhi
 *   overlap kar sakte hain, cosmetic hai.
 * - Ab LONG-PRESS se PlayerPreviewModal khulta hai (touch devices par
 *   yehi natural "info" gesture hai); double-tap poori tarah move-to ke
 *   liye reserved hai (web jaisa hi).
 */

const ROOM_WIDTH = 1000;
const ROOM_HEIGHT = 460;
const ROOM_SCENE_SIZE_MULTIPLIER = 2.4;

const ROOM_CARD_HEIGHT_PX = 150;
const AVATAR_CARD_WIDTH_PX = ROOM_CARD_HEIGHT_PX * AVATAR_ASPECT_RATIO_NUM;
const AVATAR_HEAD_TOP_FRACTION = 0.3;
const AVATAR_FEET_DOWN_SHIFT_PX = 8;

const CAMERA_FOLLOW_MS = 220;
const MOVE_THROTTLE_MS = 150;

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_BUTTON_STEP = 0.35;

const LONG_PRESS_MS = 450;
const DOUBLE_TAP_MAX_DELAY_MS = 300;

const TIP_FLY_DURATION_MS = 1200;
const REACTION_FLY_DURATION_MS = 700;
const REACTION_POP_DURATION_MS = 550;

const ROOM_FLOOR_BG = { backgroundColor: '#1a2440' };

const EMPTY_PROFILE: Record<string, any> = {};

function clamp(v: number, lo: number, hi: number) {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
}

// ---------------------------------------------------------------------
// Flying coin (tip) / emoji (reaction) - triggered via roomFloorBus,
// not part of React render state churn from parent.
// ---------------------------------------------------------------------

function FlyingTip({
  fromLeft, fromTop, toLeft, toTop, amount, onDone,
}: { fromLeft: number; fromTop: number; toLeft: number; toTop: number; amount: number; onDone: () => void }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: TIP_FLY_DURATION_MS });
    const t = setTimeout(onDone, TIP_FLY_DURATION_MS + 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    left: fromLeft + (toLeft - fromLeft) * progress.value,
    top: fromTop + (toTop - fromTop) * progress.value,
    opacity: 1 - progress.value,
    transform: [
      { translateX: -14 },
      { translateY: -40 },
      { scale: 0.6 + 0.4 * progress.value },
    ],
  }));

  return (
    <Animated.View style={[styles.flyLayer, style]} pointerEvents="none">
      <Ionicons name="cash-outline" size={22} color="#fbbf24" />
      <Text style={styles.flyTipText}>+{amount}</Text>
    </Animated.View>
  );
}

function FlyingReaction({
  fromLeft, fromTop, toLeft, toTop, emoji, onDone,
}: { fromLeft: number; fromTop: number; toLeft: number; toTop: number; emoji: string; onDone: () => void }) {
  const progress = useSharedValue(0);
  const popped = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: REACTION_FLY_DURATION_MS });
    const popTimer = setTimeout(() => {
      popped.value = withTiming(1, { duration: REACTION_POP_DURATION_MS });
    }, REACTION_FLY_DURATION_MS);
    const doneTimer = setTimeout(onDone, REACTION_FLY_DURATION_MS + REACTION_POP_DURATION_MS + 60);
    return () => {
      clearTimeout(popTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    left: fromLeft + (toLeft - fromLeft) * progress.value,
    top: fromTop + (toTop - fromTop) * progress.value,
    opacity: 1 - popped.value,
    transform: [
      { translateX: -14 },
      { translateY: -46 - popped.value * 46 },
      { scale: 0.4 + 0.75 * progress.value + 0.15 * popped.value },
    ],
  }));

  return (
    <Animated.View style={[styles.flyLayer, style]} pointerEvents="none">
      <Text style={styles.flyEmoji}>{emoji}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------
// One member's avatar card + name/typing bubble above it.
// ---------------------------------------------------------------------

interface RenderMember {
  uid: string;
  member: any;
  leftPx: number;
  topPx: number;
  equippedByCategory: Record<string, any>;
  photoUrl: string | null | undefined;
  avatarVersion: any;
  power: number;
  isVerified: boolean;
  isElite: boolean;
  isMe: boolean;
  profile: Record<string, any>;
  bubbleContent: { kind: 'typing' } | { kind: 'message'; messages: { id: string; text: string }[] } | null;
}

const MemberAvatarCard = memo(function MemberAvatarCard({
  rm, onLongPress,
}: { rm: RenderMember; onLongPress: (uid: string) => void }) {
  const cachedPhotoUrl = useAvatarImage(rm.uid, rm.photoUrl, rm.avatarVersion);
  const showBadgeRow = rm.power > 0 || rm.isVerified || rm.isElite;

  return (
    <View
      style={[
        styles.cardWrap,
        { left: rm.leftPx, top: rm.topPx, zIndex: 100 + (rm.isMe ? 50 : 0) },
      ]}
    >
      <View style={styles.cardBox}>
        {showBadgeRow && (
          <View style={styles.badgeRow}>
            {rm.isVerified && <VerifiedBadge size="xs" />}
            {rm.isElite && <EliteBadge size="xs" />}
            {rm.power > 0 && (
              <View style={styles.powerPill}>
                <Ionicons name="flash" size={7} color="#facc15" />
                <Text style={styles.powerText}>{rm.power}</Text>
              </View>
            )}
          </View>
        )}
        <Pressable
          onLongPress={() => onLongPress(rm.uid)}
          delayLongPress={LONG_PRESS_MS}
          style={styles.cardTouchable}
        >
          <AvatarLayers equippedByCategory={rm.equippedByCategory} photoUrl={cachedPhotoUrl} exactFit />
        </Pressable>
      </View>

      {rm.bubbleContent && (
        <View style={styles.bubbleAnchor} pointerEvents="none">
          {rm.bubbleContent.kind === 'typing' ? (
            <View style={styles.typingBubble}>
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
            </View>
          ) : (
            rm.bubbleContent.messages.map((msg) => (
              <View key={msg.id} style={styles.msgBubble}>
                <Text style={styles.msgBubbleText} numberOfLines={3}>
                  <Text style={styles.msgBubbleName}>{rm.member.username}: </Text>
                  {msg.text}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------

export interface RoomFloorViewHandle {
  recenterOnSelf: () => void;
}

interface RoomFloorViewProps {
  room: { id: string | number; owner_id?: any; room_bg_url?: string } | null;
  members?: any[];
  positions?: Record<string, { x: number; y: number }>;
  bubbles?: Record<string, { id: string; text: string }[]>;
  typingUserIds?: (string | number)[];
  onViewProfile?: (member: { id: any; username: string }) => void;
  onTip?: (member: { id: any; username: string }, roomId: any) => void;
  moveMessageType?: string;
  reactionMessageType?: string;
  roomIdField?: string;
}

const RoomFloorView = forwardRef<RoomFloorViewHandle, RoomFloorViewProps>(function RoomFloorView(
  {
    room,
    members = [],
    positions = {},
    bubbles = {},
    typingUserIds = [],
    onViewProfile,
    onTip,
    moveMessageType = 'room_move',
    reactionMessageType = 'room_reaction',
    roomIdField = 'room_id',
  },
  ref
) {
  const { itemsById } = useItemsCatalog();
  const myId = getMyId();

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  const [, forceRender] = useState(0);
  useEffect(() => subscribeMemberProfileUpdates(() => forceRender((n) => n + 1)), []);

  const [localSelfPos, setLocalSelfPos] = useState<{ x: number; y: number } | null>(null);
  const lastMoveAtRef = useRef(0);

  const sceneBasePx = Math.max(containerSize.width, containerSize.height);
  const sceneWidthPx = sceneBasePx * ROOM_SCENE_SIZE_MULTIPLIER;
  const floorHeightPx = sceneWidthPx;

  const roomXToPx = useCallback((x: number) => (x / ROOM_WIDTH) * sceneWidthPx, [sceneWidthPx]);
  const roomYToPx = useCallback((y: number) => (y / ROOM_HEIGHT) * floorHeightPx, [floorHeightPx]);

  const clampRoomX = useCallback(
    (x: number) => {
      const marginRoomX = sceneWidthPx ? ((AVATAR_CARD_WIDTH_PX / 2) / sceneWidthPx) * ROOM_WIDTH : 0;
      const margin = Math.min(marginRoomX, ROOM_WIDTH / 2);
      return Math.min(ROOM_WIDTH - margin, Math.max(margin, x));
    },
    [sceneWidthPx]
  );
  const clampRoomY = useCallback((y: number) => Math.min(ROOM_HEIGHT, Math.max(0, y)), []);
  const pxToRoomX = useCallback((px: number) => clampRoomX((px / sceneWidthPx) * ROOM_WIDTH), [sceneWidthPx, clampRoomX]);
  const pxToRoomY = useCallback((px: number) => clampRoomY((px / floorHeightPx) * ROOM_HEIGHT), [floorHeightPx, clampRoomY]);

  // Camera (pan) + zoom - Reanimated shared values, UI thread par driven.
  const cameraX = useSharedValue(0);
  const cameraY = useSharedValue(0);
  const zoom = useSharedValue(1);
  const startCameraX = useSharedValue(0);
  const startCameraY = useSharedValue(0);
  const startZoom = useSharedValue(1);

  const clampCameraX = useCallback(
    (x: number, z: number) => {
      'worklet';
      const halfVisible = containerSize.width / (2 * z);
      const maxX = 0;
      const minX = 2 * halfVisible - sceneWidthPx;
      return clamp(x, minX, maxX);
    },
    [containerSize.width, sceneWidthPx]
  );
  const clampCameraY = useCallback(
    (y: number, z: number) => {
      'worklet';
      const halfVisible = containerSize.height / (2 * z);
      const maxY = 0;
      const minY = 2 * halfVisible - floorHeightPx;
      return clamp(y, minY, maxY);
    },
    [containerSize.height, floorHeightPx]
  );

  const hasCenteredRef = useRef(false);
  const recenterOn = useCallback(
    (roomX: number, roomY: number, animated = true) => {
      if (!containerSize.width) return;
      const targetX = clampCameraX(containerSize.width / 2 - (roomX / ROOM_WIDTH) * sceneWidthPx, 1);
      const targetY = clampCameraY(containerSize.height / 2 - (roomY / ROOM_HEIGHT) * floorHeightPx, 1);
      zoom.value = animated ? withTiming(1, { duration: CAMERA_FOLLOW_MS }) : 1;
      cameraX.value = animated ? withTiming(targetX, { duration: CAMERA_FOLLOW_MS }) : targetX;
      cameraY.value = animated ? withTiming(targetY, { duration: CAMERA_FOLLOW_MS }) : targetY;
    },
    [containerSize.width, containerSize.height, sceneWidthPx, floorHeightPx, clampCameraX, clampCameraY]
  );

  useEffect(() => {
    setLocalSelfPos(null);
    hasCenteredRef.current = false;
    zoom.value = 1;
    cameraY.value = 0;
    cameraX.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  const myPos = (String(myId) && positions[String(myId)]) || null;
  useEffect(() => {
    if (hasCenteredRef.current || !containerSize.width) return;
    const pos = localSelfPos || myPos;
    if (pos) {
      recenterOn(pos.x, pos.y, true);
      hasCenteredRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPos?.x, myPos?.y, containerSize.width, room?.id]);

  useImperativeHandle(ref, () => ({
    recenterOnSelf: () => {
      const pos = localSelfPos || myPos;
      if (pos) recenterOn(pos.x, pos.y, true);
    },
  }));

  const sendMove = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastMoveAtRef.current < MOVE_THROTTLE_MS) return;
      lastMoveAtRef.current = now;
      if (room) networkManager.send({ type: moveMessageType, [roomIdField]: room.id, x, y });
    },
    [room, moveMessageType, roomIdField]
  );

  const moveSelfTo = useCallback(
    (roomX: number, roomY: number) => {
      const x = clampRoomX(roomX);
      const y = clampRoomY(roomY);
      setLocalSelfPos({ x, y });
      sendMove(x, y);
    },
    [clampRoomX, clampRoomY, sendMove]
  );

  // ---- Gestures: one-finger pan, two-finger pinch-zoom, double-tap move ----
  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .minPointers(1)
    .onStart(() => {
      startCameraX.value = cameraX.value;
      startCameraY.value = cameraY.value;
    })
    .onUpdate((e) => {
      cameraX.value = clampCameraX(startCameraX.value + e.translationX / zoom.value, zoom.value);
      cameraY.value = clampCameraY(startCameraY.value + e.translationY / zoom.value, zoom.value);
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      startZoom.value = zoom.value;
      startCameraX.value = cameraX.value;
      startCameraY.value = cameraY.value;
    })
    .onUpdate((e) => {
      const newZoom = clamp(startZoom.value * e.scale, MIN_ZOOM, MAX_ZOOM);
      zoom.value = newZoom;
      const focalSceneX = (e.focalX - containerSize.width / 2) / startZoom.value - startCameraX.value + containerSize.width / (2 * startZoom.value);
      const focalSceneY = (e.focalY - containerSize.height / 2) / startZoom.value - startCameraY.value + containerSize.height / (2 * startZoom.value);
      cameraX.value = clampCameraX(
        (e.focalX - containerSize.width / 2) / newZoom - focalSceneX + containerSize.width / (2 * newZoom),
        newZoom
      );
      cameraY.value = clampCameraY(
        (e.focalY - containerSize.height / 2) / newZoom - focalSceneY + containerSize.height / (2 * newZoom),
        newZoom
      );
    });

  const doMoveTap = useCallback(
    (localX: number, localY: number, z: number) => {
      if (localX < 0 || localX > containerSize.width || localY < 0 || localY > containerSize.height) return;
      const sceneX = localX / z - cameraX.value;
      const sceneY = localY / z - cameraY.value;
      moveSelfTo(pxToRoomX(sceneX), pxToRoomY(sceneY));
    },
    [containerSize.width, containerSize.height, moveSelfTo, pxToRoomX, pxToRoomY]
  );

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(DOUBLE_TAP_MAX_DELAY_MS)
    .onEnd((e) => {
      runOnJS(doMoveTap)(e.x, e.y, zoom.value);
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, panGesture),
    pinchGesture
  );

  const boxStyle = useAnimatedStyle(() => ({
    width: containerSize.width ? containerSize.width / zoom.value : 0,
    height: containerSize.height ? containerSize.height / zoom.value : 0,
    transform: [{ scale: zoom.value }],
  }));
  const sceneStyle = useAnimatedStyle(() => ({
    width: sceneWidthPx,
    height: floorHeightPx,
    transform: [{ translateX: cameraX.value }, { translateY: cameraY.value }],
  }));

  const handleZoomStep = useCallback(
    (dir: 1 | -1) => {
      const nz = clamp(zoom.value + dir * ZOOM_BUTTON_STEP, MIN_ZOOM, MAX_ZOOM);
      zoom.value = withTiming(nz, { duration: 150 });
      cameraX.value = withTiming(clampCameraX(cameraX.value, nz), { duration: 150 });
      cameraY.value = withTiming(clampCameraY(cameraY.value, nz), { duration: 150 });
    },
    [clampCameraX, clampCameraY]
  );

  // ---- Members -> render list ----
  const typingSet = useMemo(() => new Set((typingUserIds || []).map(String)), [typingUserIds]);

  const resolvePos = useCallback(
    (uid: string) => {
      if (uid === String(myId) && localSelfPos) return localSelfPos;
      if (positions[uid]) return positions[uid];
      return ROOM_MAIN_GATE_POS;
    },
    [myId, localSelfPos, positions]
  );

  const renderMembers: RenderMember[] = useMemo(
    () =>
      members.map((member) => {
        const uid = String(member.user_id);
        const pos = resolvePos(uid);
        const profile = getMemberProfilePatch(uid) || EMPTY_PROFILE;
        const msgs = bubbles[uid];
        const isTyping = !(msgs && msgs.length) && typingSet.has(uid);
        const bubbleContent = msgs && msgs.length
          ? ({ kind: 'message', messages: msgs } as const)
          : isTyping
          ? ({ kind: 'typing' } as const)
          : null;
        return {
          uid,
          member,
          leftPx: roomXToPx(pos.x),
          topPx: roomYToPx(pos.y),
          equippedByCategory: getEquippedByCategory(profile[FIELD.equipped], itemsById),
          photoUrl: profile[FIELD.avatar],
          avatarVersion: profile[FIELD.avatarVersion],
          power: profile[FIELD.power] || 0,
          isVerified: !!profile[FIELD.verified],
          isElite: !!profile[FIELD.elite],
          isMe: uid === String(myId),
          profile,
          bubbleContent,
        };
      }),
    [members, positions, localSelfPos, bubbles, typingSet, itemsById, roomXToPx, roomYToPx, myId, resolvePos]
  );

  // ---- Long-press preview ----
  const [previewMember, setPreviewMember] = useState<{ member: any; profile: Record<string, any> } | null>(null);
  const handleLongPress = useCallback(
    (uid: string) => {
      const rm = renderMembers.find((r) => r.uid === uid);
      if (rm) setPreviewMember({ member: rm.member, profile: rm.profile });
    },
    [renderMembers]
  );
  const handleViewFullProfile = useCallback(
    (member: any) => {
      setPreviewMember(null);
      onViewProfile?.({ id: member.user_id, username: member.username });
    },
    [onViewProfile]
  );
  const handleTipFromPreview = useCallback(
    (member: any) => {
      setPreviewMember(null);
      if (onTip && room) onTip({ id: member.user_id, username: member.username }, room.id);
    },
    [onTip, room]
  );
  const handleReact = useCallback(
    (member: any, emoji: string) => {
      if (!room) return;
      networkManager.send({ type: reactionMessageType, [roomIdField]: room.id, target_id: member.user_id, emoji });
    },
    [room, reactionMessageType, roomIdField]
  );

  // ---- Flying tips / reactions (roomFloorBus subscriptions) ----
  const [flyingTips, setFlyingTips] = useState<(TipFlyEvent & { fromLeft: number; fromTop: number; toLeft: number; toTop: number })[]>([]);
  const [flyingReactions, setFlyingReactions] = useState<(RoomReactionEvent & { fromLeft: number; fromTop: number; toLeft: number; toTop: number })[]>([]);

  const findScenePos = useCallback(
    (uid: string) => {
      const rm = renderMembers.find((r) => r.uid === String(uid));
      const px = rm ? rm.leftPx : roomXToPx(ROOM_MAIN_GATE_POS.x);
      const py = rm ? rm.topPx : roomYToPx(ROOM_MAIN_GATE_POS.y);
      return { left: px, top: py - ROOM_CARD_HEIGHT_PX * (1 - AVATAR_HEAD_TOP_FRACTION) };
    },
    [renderMembers, roomXToPx, roomYToPx]
  );

  useEffect(() => {
    return subscribeTipFlight((ev) => {
      if (!room || String(ev.roomId) !== String(room.id)) return;
      const from = findScenePos(ev.fromUserId);
      const to = findScenePos(ev.toUserId);
      setFlyingTips((prev) => [...prev, { ...ev, fromLeft: from.left, fromTop: from.top, toLeft: to.left, toTop: to.top }]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, findScenePos]);

  useEffect(() => {
    return subscribeReaction((ev) => {
      if (!room || String(ev.roomId) !== String(room.id)) return;
      const from = findScenePos(ev.fromUserId);
      const to = findScenePos(ev.targetUserId);
      setFlyingReactions((prev) => [...prev, { ...ev, fromLeft: from.left, fromTop: from.top, toLeft: to.left, toTop: to.top }]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, findScenePos]);

  const floorBgStyle = room?.room_bg_url ? { backgroundColor: '#1a2440' } : ROOM_FLOOR_BG;

  if (!containerSize.width) {
    return <View style={styles.container} onLayout={onLayout} />;
  }

  return (
    <>
      <View style={styles.container} onLayout={onLayout}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.box, boxStyle]}>
            <Animated.View style={[styles.scene, sceneStyle, floorBgStyle]}>
              {renderMembers.map((rm) => (
                <MemberAvatarCard key={rm.uid} rm={rm} onLongPress={handleLongPress} />
              ))}

              {flyingTips.map((f) => (
                <FlyingTip
                  key={f.id}
                  fromLeft={f.fromLeft}
                  fromTop={f.fromTop}
                  toLeft={f.toLeft}
                  toTop={f.toTop}
                  amount={f.amount}
                  onDone={() => setFlyingTips((prev) => prev.filter((x) => x.id !== f.id))}
                />
              ))}
              {flyingReactions.map((f) => (
                <FlyingReaction
                  key={f.id}
                  fromLeft={f.fromLeft}
                  fromTop={f.fromTop}
                  toLeft={f.toLeft}
                  toTop={f.toTop}
                  emoji={f.emoji}
                  onDone={() => setFlyingReactions((prev) => prev.filter((x) => x.id !== f.id))}
                />
              ))}
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        <View style={styles.zoomControls}>
          <Pressable onPress={() => handleZoomStep(1)} style={styles.zoomBtn}>
            <Text style={styles.zoomBtnText}>+</Text>
          </Pressable>
          <Pressable onPress={() => handleZoomStep(-1)} style={styles.zoomBtn}>
            <Text style={styles.zoomBtnText}>−</Text>
          </Pressable>
        </View>
      </View>

      <PlayerPreviewModal
        preview={previewMember}
        itemsById={itemsById}
        isSelf={previewMember ? String(previewMember.member.user_id) === String(myId) : false}
        onClose={() => setPreviewMember(null)}
        onViewFullProfile={handleViewFullProfile}
        onTip={onTip ? handleTipFromPreview : undefined}
        onReact={handleReact}
      />
    </>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  box: { overflow: 'hidden' },
  scene: { position: 'absolute', top: 0, left: 0 },
  cardWrap: { position: 'absolute' },
  cardBox: {
    height: ROOM_CARD_HEIGHT_PX,
    width: AVATAR_CARD_WIDTH_PX,
    transform: [{ translateX: -AVATAR_CARD_WIDTH_PX / 2 }, { translateY: -ROOM_CARD_HEIGHT_PX + AVATAR_FEET_DOWN_SHIFT_PX }],
  },
  cardTouchable: { width: '100%', height: '100%' },
  badgeRow: {
    position: 'absolute',
    left: '50%',
    top: '100%',
    transform: [{ translateX: -20 }],
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    zIndex: 1,
  },
  powerPill: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  powerText: { fontSize: 8, fontWeight: '700', color: '#facc15' },
  bubbleAnchor: {
    position: 'absolute',
    left: '50%',
    bottom: `${(1 - AVATAR_HEAD_TOP_FRACTION) * 100}%`,
    transform: [{ translateX: -60 }],
    alignItems: 'flex-start',
    gap: 4,
    maxWidth: 160,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  typingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4b5563' },
  msgBubble: { backgroundColor: '#ffffff', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 160 },
  msgBubbleText: { fontSize: 11, color: '#0f172a' },
  msgBubbleName: { fontWeight: '700', color: '#0f172a' },
  flyLayer: { position: 'absolute', alignItems: 'center', zIndex: 9999 },
  flyTipText: { fontSize: 10, fontWeight: '700', color: '#fde047', marginTop: -2 },
  flyEmoji: { fontSize: 24 },
  zoomControls: { position: 'absolute', left: 12, bottom: 16, gap: 6 },
  zoomBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(23,23,40,0.7)', borderWidth: 1, borderColor: '#3f3f66',
    alignItems: 'center', justifyContent: 'center',
  },
  zoomBtnText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
});

export default memo(RoomFloorView);