/**
 * DM chat history ka module-level cache - targetId -> { messages, hasMore }.
 *
 * Dashboard ke re-renders se independent hai. Iska maksad: agar user ek chat
 * khol ke band kare aur dobara khole, to poori history wapas fetch na ho - jo
 * pehle load ho chuki thi wahi turant dikha do, aur sirf jo NAYE messages miss
 * hue hain (jab chat band thi) unhe backend se "after" fetch karke jod do.
 *
 * Purani (older, scroll-up wali) pagination isse alag hai - yeh sirf
 * initial-load ko cache karta hai.
 *
 * Pure in-memory hai (koi web API use nahi) - RN mein logic same, sirf TS types add.
 */

export interface CachedDMMessage {
  id: string | number;
  content: string;
  edited?: boolean;
  [key: string]: any;
}

interface DMCacheEntry {
  messages: CachedDMMessage[];
  hasMore: boolean;
}

const cache = new Map<string, DMCacheEntry>();

export function getCachedMessages(targetId: string | number): DMCacheEntry | null {
  return cache.get(String(targetId)) || null;
}

export function setCachedMessages(targetId: string | number, messages: CachedDMMessage[], hasMore: boolean): void {
  cache.set(String(targetId), { messages, hasMore });
}

export function appendCachedMessage(targetId: string | number, message: CachedDMMessage): void {
  const existing = cache.get(String(targetId));
  if (!existing) return; // is chat ka cache hi nahi hai abhi - agli baar poori fetch ho jayegi
  cache.set(String(targetId), { ...existing, messages: [...existing.messages, message] });
}

// Message edit hone par cached copy bhi turant patch karo (warna chat
// band-khol karne par purana/un-edited content dubara dikhta).
export function updateCachedMessageContent(
  targetId: string | number,
  messageId: string | number,
  newContent: string
): void {
  const existing = cache.get(String(targetId));
  if (!existing) return;
  cache.set(String(targetId), {
    ...existing,
    messages: existing.messages.map((m) =>
      String(m.id) === String(messageId) ? { ...m, content: newContent, edited: true } : m
    ),
  });
}

export function prependCachedMessages(
  targetId: string | number,
  olderMessages: CachedDMMessage[],
  hasMore: boolean
): void {
  const existing = cache.get(String(targetId));
  if (!existing) return;
  cache.set(String(targetId), { messages: [...olderMessages, ...existing.messages], hasMore });
}

// Message delete kisi bhi (chahe abhi na khuli) cached conversation me ho
// sakta hai - id globally unique hai, isliye sab cached entries me dhoondh
// ke hata dete hain.
export function removeCachedMessageEverywhere(messageId: string | number): void {
  cache.forEach((entry, key) => {
    if (entry.messages.some((m) => String(m.id) === String(messageId))) {
      cache.set(key, { ...entry, messages: entry.messages.filter((m) => String(m.id) !== String(messageId)) });
    }
  });
}

export function clearCachedMessages(targetId: string | number): void {
  cache.delete(String(targetId));
}