// Module-level pub-sub (bilkul `navOverlayBus.ts` jaisa hi) - taaki feed
// list ke floating "++" quick-actions button (dashboard.tsx ke andar, sirf
// feed list ke saath render hota hai) us `QuickActionsSheet` ko khol sake
// jo `(tabs)/_layout.tsx` ke persistent shell mein rehti hai (state wahin
// hai, taaki sheet kisi bhi tab par mounted/consistent rahe).
//
// Pehle yeh sheet BottomNav ke beech wale "+" se khulti thi (usi button se
// jo "Home" bhi tha) - ab Home button sirf Home hai (single tap = feed par
// wapas, double tap = feed top par scroll + reload, Instagram jaisa), aur
// quick-actions ka apna alag floating FAB hai - isliye open-request bhi
// alag bus se.

let listeners: (() => void)[] = [];

export function subscribeOpenQuickActions(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function requestOpenQuickActions(): void {
  listeners.forEach((l) => l());
}