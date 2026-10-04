import { recordPostViews } from './feedApi';

// Feed mein post "dekha gaya" tab maana jata hai jab FlatList ke viewability
// config ke hisaab se (60% visible, ~0.8s) screen par raha. Yeh module-level
// hai taaki feed / community / hashtag list - kahin bhi ho - ek hi post dobara
// count na ho. Server ko bhi batch mein bhejte hain (har scroll event par
// alag request nahi).
const FLUSH_DELAY_MS = 2000;
const FLUSH_MAX_BATCH = 20;

const seen = new Set<string>();
let pending: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!pending.length) return;
  const batch = pending;
  pending = [];
  try {
    await recordPostViews(batch);
  } catch {
    // Fail hua (offline / endpoint abhi nahi) - seen se hata do taaki agli
    // baar dikhne par dobara try ho. User ko kuch dikhane ki zaroorat nahi.
    batch.forEach((id) => seen.delete(id));
  }
}

export function trackPostView(postId: string | number): void {
  const id = String(postId);
  if (seen.has(id)) return;
  seen.add(id);
  pending.push(id);
  if (pending.length >= FLUSH_MAX_BATCH) {
    flush();
  } else if (!timer) {
    timer = setTimeout(flush, FLUSH_DELAY_MS);
  }
}

// Logout par - agla account wahi posts dobara dekhe to uske views count hon.
export function clearPostViewTracker(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  pending = [];
  seen.clear();
}