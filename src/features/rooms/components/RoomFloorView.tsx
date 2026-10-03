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
import CurrencyIcon from '../../../shared/components/CurrencyIcon';
import axios from 'axios';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
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
import networkManager, { getToken } from '../../../shared/services/NetworkManager';
import { API_BASE } from '../../../shared/config/config';
import PlayerPreviewModal from './PlayerPreviewModal';
import {
  ROOM_MAIN_GATE_POS,
  applyMemberProfileUpdate,
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
 *   yehi natural "info" gesture hai). SINGLE TAP se floor par
 *   kisi bhi jagah move hota hai (double-tap nahi). Move TELEPORT nahi hota -
 *   avatar point A se point B tak dheere-dheere chalta hua dikhta hai (har
 *   member ka apna smooth walk animation, useWalkPosition dekho). Doosre
 *   members ki position server se badalti hai to woh bhi chalte hue dikhte hain.
 */

const ROOM_WIDTH = 1000;
const ROOM_HEIGHT = 460;
const ROOM_SCENE_SIZE_MULTIPLIER = 2.4;

const ROOM_CARD_HEIGHT_PX = 150;
const AVATAR_CARD_WIDTH_PX = ROOM_CARD_HEIGHT_PX * AVATAR_ASPECT_RATIO_NUM;
const AVATAR_HEAD_TOP_FRACTION = 0.3;
const AVATAR_FEET_DOWN_SHIFT_PX = 8;
// Bubble ka bottom card ke top se itna (fraction) neeche. Chhota number = bubble aur upar.
// (Photo circle ka top ~0.27 par hai, isliye 0.2 => circle ke thoda upar.)
const BUBBLE_ANCHOR_TOP_FRACTION = 0.2;

const CAMERA_FOLLOW_MS = 220;

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

const LONG_PRESS_MS = 450;
// Tap sirf tab maana jaye jab ungli 250ms se pehle utha li jaye - taaki
// long-press (450ms, preview modal) aur tap (move) kabhi ek saath na chalein.
const TAP_MAX_DURATION_MS = 250;

// WALK SPEED: scene ki width ka kitna fraction har second chalta hai.
// 0.14 => poora room cross karne mein ~7 sec. Slow chahiye to ghatao
// (0.10), tez chahiye to badhao (0.20).
const WALK_SPEED_SCENE_FRACTION_PER_SEC = 0.14;
const WALK_MIN_MS = 250;
const WALK_MAX_MS = 9000;

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
// Walking position: target (leftPx, topPx) badalne par teleport ki jagah
// purani jagah se nayi jagah tak constant speed (linear) se slide karta hai.
// Distance jitna zyada, duration utni zyada - isliye door ka move slow aur
// lamba dikhta hai. Pehli render / scene resize (scale change) par snap
// karta hai (animate nahi) taaki room khulte hi sab origin se na chalein.
// ---------------------------------------------------------------------

function useWalkPosition(leftPx: number, topPx: number, scale: number) {
  const x = useSharedValue(leftPx);
  const y = useSharedValue(topPx);
  const prev = useRef({ left: leftPx, top: topPx, scale });

  useEffect(() => {
    const p = prev.current;
    if (p.scale !== scale) {
      x.value = leftPx;
      y.value = topPx;
    } else if (p.left !== leftPx || p.top !== topPx) {
      const dist = Math.hypot(leftPx - x.value, topPx - y.value);
      const pxPerSec = Math.max(1, scale * WALK_SPEED_SCENE_FRACTION_PER_SEC);
      const duration = clamp((dist / pxPerSec) * 1000, WALK_MIN_MS, WALK_MAX_MS);
      const cfg = { duration, easing: Easing.linear };
      x.value = withTiming(leftPx, cfg);
      y.value = withTiming(topPx, cfg);
    }
    prev.current = { left: leftPx, top: topPx, scale };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftPx, topPx, scale]);

  return useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
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
      <CurrencyIcon type="zmoney" size={22} />
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
  sceneScale: number;
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
  const walkStyle = useWalkPosition(rm.leftPx, rm.topPx, rm.sceneScale);

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        { zIndex: 100 + (rm.isMe ? 50 : 0) },
        walkStyle,
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

    </Animated.View>
  );
});

// ---------------------------------------------------------------------
// Chat/typing bubble - MemberAvatarCard ke ANDAR nahi, ek ALAG global
// layer (web MemberBubble jaisa, zIndex 9999) taaki har member ka bubble
// hamesha sab avatars ke upar rahe. Card jaisa hi fixed-size box
// (cardBox) use hota hai taaki "bottom: 70%" avatar ke sar ke bilkul
// upar resolve ho. Zoom ke against 1/zoom counter-scale (web jaisa) -
// bubble ka screen size constant rehta hai.
// ---------------------------------------------------------------------

const MemberBubble = memo(function MemberBubble({
  rm, zoom,
}: { rm: RenderMember; zoom: SharedValue<number> }) {
  const counterScale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 / zoom.value }],
  }));
  // Hamesha mounted rehta hai (content na ho to null render) taaki bubble ka
  // walk position avatar ke saath sync rahe - bubble mid-walk mount hota to
  // seedha destination par kood jata.
  const walkStyle = useWalkPosition(rm.leftPx, rm.topPx, rm.sceneScale);
  if (!rm.bubbleContent) return null;

  return (
    <Animated.View
      style={[styles.bubbleWrap, walkStyle]}
      pointerEvents="none"
    >
      <View style={styles.cardBox} pointerEvents="none">
        <Animated.View style={[styles.bubbleAnchor, counterScale]}>
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
        </Animated.View>
      </View>
    </Animated.View>
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

  const [renderTick, forceRender] = useState(0);
  useEffect(() => subscribeMemberProfileUpdates(() => forceRender((n) => n + 1)), []);

  const [localSelfPos, setLocalSelfPos] = useState<{ x: number; y: number } | null>(null);

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

  // Members badalte hi HAR current member ka profile fresh fetch karo
  // (web RoomFloorView.jsx wala effect) - yahi avatar_url/avatar_version/
  // equipped_items/power/verified/elite ka source hai. Iske bina profile
  // hamesha {} rehta hai aur pfp/cosmetics kabhi nahi aate.
  useEffect(() => {
    const ids = (members || []).map((m: any) => m.user_id).filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    const token = getToken();
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    Promise.all(
      ids.map((id: any) =>
        axios
          .get(`${API_BASE}/profile/${id}`, config)
          .then((res) => {
            if (!cancelled) applyMemberProfileUpdate(id, res.data || {});
          })
          .catch((err) => {
            console.error('Room floor profile fetch error:', id, err?.response?.data || err?.message);
          })
      )
    ).then(() => {
      if (!cancelled) forceRender((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [members]);

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
      // Single tap ek discrete event hai - throttle nahi, warna jaldi-jaldi
      // do tap par doosra server tak nahi pahunchta aur local/server position
      // alag ho jaati thi.
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

  // ---- Gestures: one-finger pan, two-finger pinch-zoom, single-tap move ----
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

  // FOCAL-POINT ZOOM (web handlePointerMove pinch jaisa): ungliyon ke beech ka
  // scene point zoom ke dauran ussi screen position par tika rehta hai.
  // Box container ke center se scale hota hai, isliye container coords (fx, fy)
  // -> box-local = fx / zoom (web ka clientToLocal simplify hokar yahi banta hai).
  // e.focalX/Y tabhi container coords hote hain jab GestureDetector STATIC
  // container par ho (neeche render mein) - scale hone wale box par nahi.
  const pinchStartZoom = useSharedValue(1);
  const pinchAnchorX = useSharedValue(0);
  const pinchAnchorY = useSharedValue(0);
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      pinchStartZoom.value = zoom.value;
      pinchAnchorX.value = e.focalX / zoom.value - cameraX.value;
      pinchAnchorY.value = e.focalY / zoom.value - cameraY.value;
    })
    .onUpdate((e) => {
      // Pinch chhodte waqt ek ungli pehle uthti hai: tab focal point bachi hui
      // ungli par kood jaata hai (aur scale bhi hil jaata hai) - wahi "release par
      // snap" tha. Isliye sirf tab apply karo jab 2 ungliyan chhoo rahi hon; last
      // valid 2-finger state hi camera mein tika rehta hai.
      if (e.numberOfPointers < 2) return;
      const newZoom = clamp(pinchStartZoom.value * e.scale, MIN_ZOOM, MAX_ZOOM);
      zoom.value = newZoom;
      cameraX.value = clampCameraX(e.focalX / newZoom - pinchAnchorX.value, newZoom);
      cameraY.value = clampCameraY(e.focalY / newZoom - pinchAnchorY.value, newZoom);
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

  // SINGLE TAP => move. Pan (ungli hilne par) tap ko cancel kar deta hai,
  // isliye camera drag karte waqt avatar chalna shuru nahi hota.
  const tapGesture = Gesture.Tap()
    .maxDuration(TAP_MAX_DURATION_MS)
    .onEnd((e, success) => {
      if (success) runOnJS(doMoveTap)(e.x, e.y, zoom.value);
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(tapGesture, panGesture),
    pinchGesture
  );

  // TRANSFORM-ONLY CAMERA. Web mein box (W/z x H/z) ko scale(z) karke center se
  // zoom karte the - matlab screen = z * (scenePoint + camera). Wahi cheez yahan
  // ek hi transform se: scale(z) top-left origin se, phir translate(camera).
  // Pehle box ki width/height har frame animate hoti thi - RN mein layout props
  // transform se alag frame par apply hote hain, isliye zoom "snap" karta tha.
  // Ab koi layout prop animate nahi hota, sirf GPU transform.
  const sceneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoom.value }, { translateX: cameraX.value }, { translateY: cameraY.value }],
  }));

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
          sceneScale: sceneWidthPx,
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
    [members, positions, localSelfPos, bubbles, typingSet, itemsById, roomXToPx, roomYToPx, sceneWidthPx, myId, resolvePos, renderTick]
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

  const floorBgStyle = ROOM_FLOOR_BG;

  if (!containerSize.width) {
    return <View style={styles.container} onLayout={onLayout} />;
  }

  return (
    <>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.container} onLayout={onLayout}>
          <View style={[styles.box, { width: containerSize.width, height: containerSize.height }]}>
            <Animated.View style={[styles.scene, { width: sceneWidthPx, height: floorHeightPx }, sceneStyle, floorBgStyle]}>
              {!!room?.room_bg_url && (
                <Image
                  source={{ uri: room.room_bg_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  cachePolicy="disk"
                  pointerEvents="none"
                />
              )}
              {renderMembers.map((rm) => (
                <MemberAvatarCard key={`${room?.id}-${rm.uid}`} rm={rm} onLongPress={handleLongPress} />
              ))}
              {renderMembers.map((rm) => (
                <MemberBubble key={`bubble-${room?.id}-${rm.uid}`} rm={rm} zoom={zoom} />
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
          </View>
        </View>
      </GestureDetector>

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
  // transformOrigin top-left: scene sirf transform se hilta/zoom hota hai (layout kabhi nahi badalta).
  scene: { position: 'absolute', top: 0, left: 0, transformOrigin: 'top left' },
  cardWrap: { position: 'absolute', left: 0, top: 0 },
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
  bubbleWrap: { position: 'absolute', left: 0, top: 0, zIndex: 9999 },
  bubbleAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: `${(1 - BUBBLE_ANCHOR_TOP_FRACTION) * 100}%`,
    marginBottom: -4,
    alignItems: 'center',
    gap: 4,
    transformOrigin: 'bottom center',
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
  zoomBtnText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
});

export default memo(RoomFloorView);