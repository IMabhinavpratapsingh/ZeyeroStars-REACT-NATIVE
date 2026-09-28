import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Kisi bhi user (room, feed, leaderboard, DM - kahin bhi) ka avatar URL
 * `avatar_version` ke against yaad rakhta hai.
 *
 * Bytes JS se download karne ki zaroorat nahi (private Backblaze bucket par
 * CORS ki wajah se woh approach toot gayi thi) - backend har upload par ek
 * NAYI, STABLE signed URL DB me save karta hai. Isliye sirf
 * (userId -> {version, url}) yaad rakhte hain: jab tak version same hai,
 * wahi URL wapas do (image component ka apna disk cache same URL par hit
 * hota hai). Version badle to naya URL yaad rakh kar wahi return karo.
 *
 * WEB -> RN DIFFERENCE: resolveAvatarUrl() ko SYNC rakhna zaroori hai
 * (render ke andar call hota hai), lekin AsyncStorage async hai. Isliye:
 *   - memCache (L1) hi sync source hai;
 *   - app boot pe EK baar `await hydrateAvatarCache()` (root _layout.tsx,
 *     splash ke dauraan) storage ke saare saved avatars memCache mein bhar
 *     deta hai - uske baad behaviour bilkul web jaisa;
 *   - writes fire-and-forget (write-through) hain.
 * Hydrate se pehle koi call aaye to bas woh entry naye sire se yaad ho jaati
 * hai - koi galat URL nahi milta.
 *
 * Image display ke liye expo-image use karo (`cachePolicy="disk"`) - RN ke
 * default <Image> ka network cache unreliable hota hai.
 */

const STORAGE_PREFIX = 'zcache_avatar_';

interface AvatarEntry {
  version: number | string;
  url: string;
}

// In-memory L1 - sync source of truth (key hamesha String(userId))
const memCache = new Map<string, AvatarEntry>();

function safeParse(raw: string | null): AvatarEntry | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AvatarEntry;
  } catch {
    return null;
  }
}

// Root _layout.tsx mein app boot pe await karo.
export async function hydrateAvatarCache(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(STORAGE_PREFIX));
    if (!keys.length) return;
    // multiGet ki jagah getItem - AsyncStorage v2 aur v3 dono mein chalta hai.
    await Promise.all(
      keys.map(async (key) => {
        const userId = key.slice(STORAGE_PREFIX.length);
        if (memCache.has(userId)) return; // is session ki fresh entry purani storage copy se behtar hai
        const entry = safeParse(await AsyncStorage.getItem(key));
        if (entry && !memCache.has(userId)) memCache.set(userId, entry);
      })
    );
  } catch {
    // storage read fail - khaali cache se chalta rahega
  }
}

/**
 * @param userId
 * @param version - avatar_version (naya har upload par +1)
 * @param avatarUrl - backend se abhi mila signed URL
 * @returns image `source.uri` me seedha use karne layak URL
 */
export function resolveAvatarUrl(
  userId: string | number | null | undefined,
  version: number | string | null | undefined,
  avatarUrl: string | null | undefined
): string | null {
  if (userId == null || userId === '') return avatarUrl || null;

  const id = String(userId);

  // Backend ne explicitly null/empty avatar_url bheja (user ne photo hata
  // di, ya kabhi thi hi nahi) - to purani cached entry (memory + storage)
  // turant hata do, warna stale pfp kahin bhi wapas dikh sakti hai.
  // (undefined = field aaya hi nahi, usme cache ko haath nahi lagate.)
  if (avatarUrl === null || avatarUrl === '') {
    if (memCache.has(id)) invalidateAvatar(id);
    return null;
  }
  if (!avatarUrl) return null;
  const normVersion = version ?? 0;

  const mem = memCache.get(id);
  if (mem && mem.version === normVersion) return mem.url;

  // Version badal gaya (ya kabhi dekha hi nahi) - yehi latest URL sahi hai.
  const entry: AvatarEntry = { version: normVersion, url: avatarUrl };
  memCache.set(id, entry);
  AsyncStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(entry)).catch(() => {
    // storage full/blocked ho to bhi app chalti rahe - persist skip
  });
  return avatarUrl;
}

// Player khud apna avatar badle to purani cached entry turant hata do
// (filhaal kahin call nahi hoti - version-bump khud purani entry ko invalid
// kar deta hai; future edge-case ke liye rakha hai).
export function invalidateAvatar(userId: string | number): void {
  const id = String(userId);
  memCache.delete(id);
  AsyncStorage.removeItem(STORAGE_PREFIX + id).catch(() => {});
}