/**
 * Web version (RoomFloorView.jsx) mein yeh module-level pub/sub functions
 * component file ke andar hi the (usi file mein consume bhi hote the).
 * RN port mein humne inhe alag nikaala hai taaki Dashboard hooks
 * (useRoomState) - jinhe RoomFloorView poora convert hone se PEHLE hi
 * inhe call/trigger karna hai - RoomFloorView.tsx ke bina hi import kar
 * sakein. Jab RoomFloorView.tsx convert hoga, woh isi bus ko
 * subscribeMemberProfileUpdates/subscribeTipFlight/subscribeReaction se
 * subscribe karega (dekho neeche export kiye hue subscribe helpers).
 */

const ROOM_WIDTH = 1000;
const ROOM_HEIGHT = 460;

// Room ka "main gate" - har room ke top-left corner par, entrance jaisa.
// Static room-coordinate hai - do jagah use hota hai:
//   1. RoomFloorView (jab convert hoga) resolvePos fallback ke taur par.
//   2. useRoomState.openRoom() seedha isi constant ko room_join ke saath
//      bhejta hai, taaki spawn hamesha consistent rahe (server-random
//      position ki jagah).
export const ROOM_MAIN_GATE_POS = { x: ROOM_WIDTH * 0.08, y: ROOM_HEIGHT * 0.35 };

export const ROOM_REACTIONS = ['😭', '😂', '💀', '❤️', '🔥'];

// ---- Member profile patch bus (equip/avatar live-update) ----
type ProfilePatch = Record<string, any>;
const memberProfileCache = new Map<string, ProfilePatch>();
const profileCacheListeners = new Set<() => void>();

export function applyMemberProfileUpdate(userId: string | number, patch: ProfilePatch) {
  const id = String(userId);
  const existing = memberProfileCache.get(id) || {};
  memberProfileCache.set(id, { ...existing, ...patch });
  profileCacheListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      // ek listener crash se doosre na ruken
    }
  });
}

export function getMemberProfilePatch(userId: string | number): ProfilePatch {
  return memberProfileCache.get(String(userId)) || {};
}

export function subscribeMemberProfileUpdates(fn: () => void): () => void {
  profileCacheListeners.add(fn);
  return () => profileCacheListeners.delete(fn);
}

// ---- Tip-fly animation bus (coin flying from sender to receiver avatar) ----
export type TipFlyEvent = {
  id: string;
  roomId: string | number;
  fromUserId: string;
  toUserId: string;
  amount: number;
};

const tipFlightListeners = new Set<(e: TipFlyEvent) => void>();
let tipFlightIdCounter = 0;

export function triggerRoomTipFly(
  roomId: string | number,
  fromUserId: string | number,
  toUserId: string | number,
  amount: number
) {
  tipFlightIdCounter += 1;
  const event: TipFlyEvent = {
    id: `tipfly_${Date.now()}_${tipFlightIdCounter}`,
    roomId,
    fromUserId: String(fromUserId),
    toUserId: String(toUserId),
    amount,
  };
  tipFlightListeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      // ek listener crash se doosre room-floors ka animation na ruke
    }
  });
}

export function subscribeTipFlight(fn: (e: TipFlyEvent) => void): () => void {
  tipFlightListeners.add(fn);
  return () => tipFlightListeners.delete(fn);
}

// ---- Emoji reaction animation bus (long-press popup se) ----
export type RoomReactionEvent = {
  id: string;
  roomId: string | number;
  fromUserId: string;
  targetUserId: string;
  emoji: string;
};

const reactionListeners = new Set<(e: RoomReactionEvent) => void>();
let reactionIdCounter = 0;

export function triggerRoomReaction(
  roomId: string | number,
  fromUserId: string | number,
  targetUserId: string | number,
  emoji: string
) {
  reactionIdCounter += 1;
  const event: RoomReactionEvent = {
    id: `reaction_${Date.now()}_${reactionIdCounter}`,
    roomId,
    fromUserId: String(fromUserId),
    targetUserId: String(targetUserId),
    emoji,
  };
  reactionListeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      // ek listener crash se doosre room-floors ka animation na ruke
    }
  });
}

export function subscribeReaction(fn: (e: RoomReactionEvent) => void): () => void {
  reactionListeners.add(fn);
  return () => reactionListeners.delete(fn);
}