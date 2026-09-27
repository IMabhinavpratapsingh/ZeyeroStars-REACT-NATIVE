import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Community CUSTOM icon URL cache - avatarCache.ts (pfp) jaisa hi pattern,
 * bas VERSION NUMBER ki jagah seedha ICON_URL STRING se match karte hain.
 * Community icon_url backend se hamesha PERMANENT, non-expiring public URL
 * hota hai - jab tak yeh URL string badla nahi tab tak cached entry sahi hai.
 * Icon badlega to naya upload naya (random-key) URL banayega, aur cache khud
 * mismatch dekh kar naya URL yaad rakh legi.
 *
 * NOTE: yeh sirf CUSTOM uploaded icons (icon_url) ke liye hai - preset icons
 * (icon_id) local bundled assets hain (communityAvatarAssets.ts), unhe is
 * cache ki zaroorat nahi.
 *
 * WEB -> RN DIFFERENCE: resolveCommunityIconUrl() SYNC rehna chahiye (render
 * ke andar call hota hai) par AsyncStorage async hai - isliye memCache sync
 * source hai, aur app boot pe EK baar `await hydrateCommunityIconCache()`
 * (root _layout.tsx, splash ke dauraan) storage se memCache bhar deta hai.
 * Writes fire-and-forget (write-through). Details avatarCache.ts mein.
 */

const STORAGE_PREFIX = 'zcache_community_icon_';

interface IconEntry {
  url: string;
}

// In-memory L1 - sync source of truth (key hamesha String(communityId))
const memCache = new Map<string, IconEntry>();

function safeParse(raw: string | null): IconEntry | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IconEntry;
  } catch {
    return null;
  }
}

// Root _layout.tsx mein app boot pe await karo.
export async function hydrateCommunityIconCache(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(STORAGE_PREFIX));
    if (!keys.length) return;
    // multiGet ki jagah getItem - AsyncStorage v2 aur v3 dono mein chalta hai.
    await Promise.all(
      keys.map(async (key) => {
        const communityId = key.slice(STORAGE_PREFIX.length);
        if (memCache.has(communityId)) return; // is session ki fresh entry purani storage copy se behtar hai
        const entry = safeParse(await AsyncStorage.getItem(key));
        if (entry && !memCache.has(communityId)) memCache.set(communityId, entry);
      })
    );
  } catch {
    // storage read fail - khaali cache se chalta rahega
  }
}

/**
 * @param communityId
 * @param iconUrl - backend se abhi mila custom icon_url
 * @returns image `source.uri` me seedha use karne layak URL
 */
export function resolveCommunityIconUrl(
  communityId: number | string | null | undefined,
  iconUrl: string | null | undefined
): string | null {
  if (communityId == null || communityId === '' || !iconUrl) return iconUrl || null;

  const id = String(communityId);

  const mem = memCache.get(id);
  if (mem && mem.url === iconUrl) return mem.url;

  // URL badal gaya (ya kabhi dekha hi nahi) - yehi latest URL sahi hai.
  const entry: IconEntry = { url: iconUrl };
  memCache.set(id, entry);
  AsyncStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(entry)).catch(() => {
    // storage full/blocked ho to bhi app chalti rahe - persist skip
  });
  return iconUrl;
}

// Community icon delete/reset ho jaaye (preset par switch ho jaaye) to
// purani cached entry turant hata do.
export function invalidateCommunityIcon(communityId: number | string): void {
  const id = String(communityId);
  memCache.delete(id);
  AsyncStorage.removeItem(STORAGE_PREFIX + id).catch(() => {});
}