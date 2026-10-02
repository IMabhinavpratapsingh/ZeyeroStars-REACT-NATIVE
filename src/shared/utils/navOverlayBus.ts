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

// --- Strip se seedha kisi room mein jaana (Your Room / active room circle) ---
// Dashboard ka apna useRoomState instance kisi room-screen se juda nahi hai,
// isliye tap par Rooms overlay khulta hai aur wahi (RoomsOverlayScreen ka
// roomState) room join karta hai.
let roomListeners: ((room: any) => void)[] = [];

export function subscribeOpenRoom(listener: (room: any) => void): () => void {
  roomListeners.push(listener);
  return () => {
    roomListeners = roomListeners.filter((l) => l !== listener);
  };
}

export function requestOpenRoom(room: any): void {
  roomListeners.forEach((l) => l(room));
}

// --- "Mera room" badla (create/rename/icon save) -> strip dobara fetch kare ---
let myRoomListeners: (() => void)[] = [];

export function subscribeMyRoomChanged(listener: () => void): () => void {
  myRoomListeners.push(listener);
  return () => {
    myRoomListeners = myRoomListeners.filter((l) => l !== listener);
  };
}

export function notifyMyRoomChanged(): void {
  myRoomListeners.forEach((l) => l());
}

// --- Profile ("Send Message") se seedha kisi user ki chat kholna ---
// requestOpenDM() sirf Inbox kholta hai (koi user nahi jaata). Isliye alag
// event: DMOverlayScreen (hamesha mounted) isse sun kar overlay kholta hai
// aur us user ki chat seedha open karta hai.
export interface OpenDMChatPayload {
  user: { id: string | number; username?: string; [k: string]: any };
  draft?: string;
}
let dmChatListeners: ((payload: OpenDMChatPayload) => void)[] = [];

export function subscribeOpenDMChat(listener: (payload: OpenDMChatPayload) => void): () => void {
  dmChatListeners.push(listener);
  return () => {
    dmChatListeners = dmChatListeners.filter((l) => l !== listener);
  };
}

export function requestOpenDMChat(user: OpenDMChatPayload['user'], draft?: string): void {
  dmChatListeners.forEach((l) => l({ user, draft }));
}