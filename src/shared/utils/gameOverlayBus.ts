// Module-level pub-sub (navOverlayBus.ts/quickActionsBus.ts jaisa hi) -
// BottomNav ke "Game" icon (jo `(tabs)/_layout.tsx` mein render hota hai)
// se GameOverlayScreen (jo bhi is shell mein mounted hai, apna khud ka
// Battle/Bluff state rakhta hai) ko "mode-select screen khol/toggle do"
// bolne ke liye. GameOverlayScreen khud decide karta hai ki toggle karna
// hai ya kisi already-open Bluff lobby par wapas jaana hai.

type Listener = () => void;
let listeners: Listener[] = [];

export function subscribeOpenGame(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function requestOpenGame(): void {
  listeners.forEach((l) => l());
}

// Game start hote hi (match found / table open) baaki saari screens
// (Rooms, DM, Shop, Profile, Communities, ...) band karwane ke liye -
// GameOverlayScreen emit karta hai, `(tabs)/_layout.tsx` (jo un sab
// screens ka owner hai) subscribe karke sab band kar deta hai.
let closeAllListeners: Listener[] = [];

export function subscribeCloseAllForGame(listener: Listener): () => void {
  closeAllListeners.push(listener);
  return () => {
    closeAllListeners = closeAllListeners.filter((l) => l !== listener);
  };
}

export function requestCloseAllForGame(): void {
  closeAllListeners.forEach((l) => l());
}

// Game ki MENU screens (game select / bluff mode-select / bluff lobby) band
// karwane ke liye - Home/Rooms/DM/Shop jaisa koi aur tab dabane par
// `(tabs)/_layout.tsx` emit karta hai, GameOverlayScreen subscribe karta hai.
// (Chalta hua match ya matchmaking isse cancel NAHI hota.)
let closeMenusListeners: Listener[] = [];

export function subscribeCloseGameMenus(listener: Listener): () => void {
  closeMenusListeners.push(listener);
  return () => {
    closeMenusListeners = closeMenusListeners.filter((l) => l !== listener);
  };
}

export function requestCloseGameMenus(): void {
  closeMenusListeners.forEach((l) => l());
}

// isGameActive (BottomNav ke "Game" icon ko highlight karne ke liye) -
// GameOverlayScreen publish karta hai, BottomNav/`_layout.tsx` subscribe.
type ActiveListener = (active: boolean) => void;
let activeListeners: ActiveListener[] = [];

export function subscribeGameActive(listener: ActiveListener): () => void {
  activeListeners.push(listener);
  return () => {
    activeListeners = activeListeners.filter((l) => l !== listener);
  };
}

export function setGameActive(active: boolean): void {
  activeListeners.forEach((l) => l(active));
}