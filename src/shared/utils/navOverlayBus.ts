// Module-level pub-sub (bilkul `alertBus.ts`/`confirmBus.ts` jaisa hi) -
// taaki kisi bhi screen (Dashboard ka RoomsStrip, Feed, notification tap,
// waghera) se Rooms/DM overlay khulwaya ja sake, BINA unhe route hone ke.
//
// WHY: Rooms aur DM ab `(tabs)/_layout.tsx` ke andar persistent overlay
// hain (`showRooms`/`showDM` boolean, PersistentSlide se), Tabs.Screen
// route NAHI rahe (dekho _layout.tsx ka top comment). Lekin Dashboard.tsx/
// Feed.tsx jaisi screens is state ki seedhi "parent" nahi hain (sibling
// hain, _layout unka parent hai) - unke paas is state ko directly badalne
// ka koi prop/context nahi hai. Pehle ye `router.push('/(tabs)/rooms')`
// karte the (jab Rooms ek asli route thi) - ab woh route hi nahi hai, to
// seedha push karne se 404/dead-end hota. Is bus se woh sirf ek event emit
// karte hain, `_layout.tsx` (jo already mounted hai, root shell) use sun
// kar apna `setShowRooms(true)`/`setShowDM(true)` call kar deta hai.

type OverlayKind = 'rooms' | 'dm';

let listeners: ((kind: OverlayKind) => void)[] = [];

export function subscribeOpenOverlay(listener: (kind: OverlayKind) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function requestOpenRooms(): void {
  listeners.forEach((l) => l('rooms'));
}

export function requestOpenDM(): void {
  listeners.forEach((l) => l('dm'));
}