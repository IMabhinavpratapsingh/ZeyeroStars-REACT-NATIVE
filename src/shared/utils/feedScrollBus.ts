// Module-level pub-sub (bilkul `navOverlayBus.ts`/`quickActionsBus.ts` jaisa
// hi) - Home nav button (`BottomNav.tsx`) ab already-home + no-overlay state
// mein DOUBLE TAP par "scroll feed top par + reload" chahta hai (Instagram
// jaisa). Woh button `(tabs)/_layout.tsx` (parent shell) mein hai, lekin
// asli FlatList + `refreshFeed()` `dashboard.tsx` (sibling tab screen) ke
// andar hai - seedha prop/ref se pahunch nahi, isliye is bus se sirf event
// emit karte hain, dashboard.tsx sunke apna FlatList ref scroll-to-top
// karta hai aur refreshFeed() call karta hai.

let listeners: (() => void)[] = [];

export function subscribeFeedScrollTopReload(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function requestFeedScrollTopReload(): void {
  listeners.forEach((l) => l());
}