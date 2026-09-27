import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Generic AsyncStorage-backed cache factory - useItemsCatalog, useSkillsCatalog,
 * useRoomItemsCatalog, useOwnedSkills, useInventory jaise "module-level cache"
 * hooks isi factory se banate hain.
 *
 * BEHAVIOUR (web jaisa hi):
 * - Purana data turant dikhta hai, background me hamesha fresh fetch chalta hai.
 * - State/storage SIRF tabhi update hote hain jab naya data purane se ALAG ho
 *   (JSON string compare) - warna koi re-render/flicker nahi.
 * - Fetch fail ho jaaye to purana cached data hi dikhta rehta hai.
 *
 * WEB -> RN DIFFERENCE (IMPORTANT):
 * Web mein localStorage SYNC tha, isliye module load hote hi cache bhar jaata
 * tha. AsyncStorage ASYNC hai - isliye cache ab hydrate() se bharta hai:
 *   - Har resource banate hi khud hydrate shuru kar deta hai.
 *   - Root _layout.tsx mein splash hide karne se pehle `await hydrateAllCaches()`
 *     karo (saare cache modules import hone ke baad) - tab pehla render bhi
 *     web jaise turant data ke saath aayega.
 *   - Hydrate baad mein bhi khatam ho to subscribers ko notify karta hai, to
 *     useSyncExternalStore wale hooks apne aap update ho jaate hain.
 *   - fetchAndApply() pehle hydrate ka wait karta hai - warna stale storage
 *     copy fresh network data ko overwrite kar sakti thi (race).
 */

function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type Subscriber<T> = (data: T | null) => void;

export interface CachedResource<T> {
  getSnapshot: () => T | null;
  subscribe: (cb: Subscriber<T>) => () => void;
  fetchAndApply: (force?: boolean) => Promise<T | null>;
  invalidateAndRefetch: () => Promise<T | null>;
  setLocal: (data: T) => void;
  clear: () => Promise<void>;
  hydrate: () => Promise<void>;
}

// Sirf logged-in user se juda data (owned skills, inventory, waghera) - dusra
// account login kare to purana data turant clear hona chahiye. Global catalogs
// (items/skills/room-items) sab users ke liye same hote hain, unhe clear nahi
// karte.
const userScopedClearFns: (() => Promise<void>)[] = [];
const allHydrateFns: (() => Promise<void>)[] = [];

export function clearUserScopedCaches(): Promise<void> {
  return Promise.all(userScopedClearFns.map((fn) => fn())).then(() => undefined);
}

// Root _layout.tsx mein app boot pe await karo (splash screen ke dauraan).
export function hydrateAllCaches(): Promise<void> {
  return Promise.all(allHydrateFns.map((fn) => fn())).then(() => undefined);
}

interface CreateCachedResourceOptions<T> {
  /** unique cache key (AsyncStorage me `zcache_<key>` banega) */
  key: string;
  /** fresh data laane wala function (already mapped/shaped) */
  fetchFn: () => Promise<T>;
  /** true ho to logout par yeh cache bhi clear hogi */
  userScoped?: boolean;
  /**
   * itne ms ke andar dobara fetchAndApply() call hua to NETWORK CALL HI SKIP
   * (turant cached data resolve) - missions/rewards/leaderboard/inbox jaisi
   * baar-baar khulne wali cheezon ke liye. Na diya to har call par network.
   */
  ttlMs?: number;
}

export function createCachedResource<T>({
  key,
  fetchFn,
  userScoped = false,
  ttlMs = 0,
}: CreateCachedResourceOptions<T>): CachedResource<T> {
  const storageKey = `zcache_${key}`;
  const tsStorageKey = `zcache_${key}__ts`; // alag key - stored format (sirf data) na tootne paaye

  let cache: T | null = null; // null = kabhi cache nahi hui
  let lastFetchedAt = 0;
  let inflightPromise: Promise<T | null> | null = null;
  const subscribers = new Set<Subscriber<T>>();

  // Har mutation (fetch/setLocal/clear) epoch badhata hai - hydrate() shuru
  // hote waqt ka epoch yaad rakhta hai aur agar beech mein kuch badal gaya
  // to purani storage copy apply NAHI karta.
  let epoch = 0;

  function notifySubscribers() {
    subscribers.forEach((cb) => cb(cache));
  }

  function persist(data: T) {
    try {
      AsyncStorage.setItem(storageKey, JSON.stringify(data)).catch(() => {
        // storage full/blocked ho to bhi app chalti rahe - persist skip
      });
    } catch {
      // JSON.stringify fail - ignore
    }
  }

  function persistTs(ts: number) {
    AsyncStorage.setItem(tsStorageKey, String(ts)).catch(() => {});
  }

  function applyIfChanged(data: T) {
    const changed = JSON.stringify(data) !== JSON.stringify(cache);
    if (changed) {
      epoch += 1;
      cache = data;
      persist(data);
      notifySubscribers();
    }
  }

  const hydratePromise: Promise<void> = (async () => {
    const startEpoch = epoch;
    try {
      // multiGet ki jagah 2 getItem - AsyncStorage v2 aur v3 dono mein chalta hai.
      const [rawData, rawTs] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        AsyncStorage.getItem(tsStorageKey),
      ]);
      if (epoch !== startEpoch) return; // is beech fetch/setLocal/clear ho chuka - fresh hi sahi hai
      const stored = safeParse<T>(rawData);
      if (stored == null) return;
      cache = stored;
      lastFetchedAt = Number(rawTs) || 0;
      notifySubscribers();
    } catch {
      // storage read fail - cache khaali hi rahegi, fetch normal chalega
    }
  })();

  function fetchAndApply(force = false): Promise<T | null> {
    if (inflightPromise) return inflightPromise; // ek hi waqt me ek hi request chale

    inflightPromise = (async () => {
      try {
        await hydratePromise;

        if (!force && ttlMs && cache != null && Date.now() - lastFetchedAt < ttlMs) {
          // Abhi thodi der pehle hi fetch hui thi - network call skip.
          return cache;
        }

        try {
          const data = await fetchFn();
          epoch += 1;
          lastFetchedAt = Date.now();
          persistTs(lastFetchedAt);
          applyIfChanged(data);
          return cache;
        } catch (err: any) {
          console.error(`[cache:${key}] fetch failed:`, err?.response?.data || err?.message || err);
          return cache; // purana (cached) data hi rakho
        }
      } finally {
        inflightPromise = null;
      }
    })();

    return inflightPromise;
  }

  async function clear(): Promise<void> {
    epoch += 1;
    cache = null;
    lastFetchedAt = 0;
    notifySubscribers();
    try {
      await Promise.all([AsyncStorage.removeItem(storageKey), AsyncStorage.removeItem(tsStorageKey)]);
    } catch {
      // ignore
    }
  }

  if (userScoped) userScopedClearFns.push(clear);
  allHydrateFns.push(() => hydratePromise);

  return {
    getSnapshot: () => cache,
    subscribe: (cb) => {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    fetchAndApply,
    // TTL bypass karke hamesha fresh fetch - claim/purchase ke baad UI turant
    // sahi state dikhaye.
    invalidateAndRefetch: () => fetchAndApply(true),
    // Network ke bina seedha cache set karo (persist + notify) - websocket se
    // aaye in-place updates ke liye. TTL/lastFetchedAt ko nahi chhedta.
    setLocal: (data) => {
      epoch += 1;
      cache = data;
      persist(data);
      notifySubscribers();
    },
    clear,
    hydrate: () => hydratePromise,
  };
}