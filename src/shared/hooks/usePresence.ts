import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getPresenceStatus } from '../services/presenceApi';

// Ek screen par ek saath 10-20 pfp visible ho sakte hain (feed, inbox,
// comments) - har ek apna alag /presence/status request na daage isliye
// ek chhota module-level "batcher": jo bhi user_ids is render-tick mein
// maange, unhe ek hi call mein jod ke bhejta hai, phir jab tak koi
// component us id ko "subscribe" kiye hai use har REFRESH_MS par refresh
// karta rehta hai (taaki online -> offline switch bhi live dikhe).
//
// RN ADDITION: app background mein ho to poll skip (AppState) - web mein
// tab hidden hone par browser timers khud throttle kar deta tha, RN mein
// woh nahi hota - bekaar network/battery na jaaye.
const REFRESH_MS = 20000;
const BATCH_DELAY_MS = 60;

type PresenceListener = (isOnline: boolean) => void;
type Id = string | number;

const statusCache = new Map<Id, boolean>(); // user_id -> boolean
const subscribers = new Map<Id, Set<PresenceListener>>(); // user_id -> Set<fn(boolean)>
let pendingIds = new Set<Id>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

const notify = (userId: Id, isOnline: boolean) => {
  statusCache.set(userId, isOnline);
  const subs = subscribers.get(userId);
  if (subs) subs.forEach((fn) => fn(isOnline));
};

const fetchBatch = async (ids: Id[]) => {
  if (ids.length === 0) return;
  try {
    const res = await getPresenceStatus(ids);
    const statusMap: Record<string, boolean> = res.data?.status || {};
    ids.forEach((id) => notify(id, !!statusMap[String(id)]));
  } catch (err: any) {
    console.error('Presence status fetch error:', err?.response?.data || err?.message);
  }
};

const scheduleBatch = (userId: Id) => {
  pendingIds.add(userId);
  if (batchTimer) return;
  batchTimer = setTimeout(() => {
    const ids = Array.from(pendingIds);
    pendingIds = new Set();
    batchTimer = null;
    fetchBatch(ids);
  }, BATCH_DELAY_MS);
};

// Periodic refresh - sirf un ids ke liye jinka abhi koi subscriber hai
// (screen se hat gaya avatar ab wasted poll nahi karwata).
const ensurePolling = () => {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (AppState.currentState !== 'active') return; // background mein poll nahi
    const activeIds = Array.from(subscribers.keys()).filter((id) => (subscribers.get(id)?.size ?? 0) > 0);
    if (activeIds.length === 0) return;
    fetchBatch(activeIds);
  }, REFRESH_MS);
};

const subscribe = (userId: Id, fn: PresenceListener) => {
  if (!subscribers.has(userId)) subscribers.set(userId, new Set());
  subscribers.get(userId)!.add(fn);
  ensurePolling();

  if (statusCache.has(userId)) {
    fn(statusCache.get(userId)!);
  } else {
    scheduleBatch(userId);
  }

  return () => {
    const subs = subscribers.get(userId);
    if (!subs) return;
    subs.delete(fn);
    if (subs.size === 0) subscribers.delete(userId);
  };
};

/**
 * Kisi bhi user ke live online/offline status ke liye - `undefined` jab
 * tak pehla fetch complete nahi ho jaata (is waqt badge kuch nahi
 * dikhata), uske baad true/false. Har REFRESH_MS par khud-b-khud refresh
 * hota hai jab tak component mounted hai.
 */
export default function usePresence(userId: Id | null | undefined): boolean | undefined {
  const [isOnline, setIsOnline] = useState<boolean | undefined>(() =>
    userId ? statusCache.get(userId) : undefined
  );

  useEffect(() => {
    if (!userId) return;
    setIsOnline(statusCache.get(userId));
    const unsubscribe = subscribe(userId, setIsOnline);
    return unsubscribe;
  }, [userId]);

  return isOnline;
}