// Apni khud ki pfp (avatar_url) ka chhota module-level store (alertBus.ts /
// profileOpenBus.ts jaisa pattern) - taaki Header ka Profile button, aur
// ProfileViewModal (jahan photo upload/remove hoti hai) ek hi value share
// karein, bina prop drilling ke.
//
// - (tabs)/_layout.tsx boot pe GET /profile/{myId} se yeh set karta hai.
// - ProfileViewModal photo upload/remove/refresh par isse update karta hai,
//   isliye Header turant badal jaata hai (remove karne par default icon).

let myAvatarUrl: string | null = null;
let listeners: (() => void)[] = [];

export function getMyAvatarUrl(): string | null {
  return myAvatarUrl;
}

export function setMyAvatarUrl(url: string | null | undefined): void {
  const next = url || null; // '' / undefined / null -> null
  if (next === myAvatarUrl) return;
  myAvatarUrl = next;
  listeners.forEach((l) => l());
}

export function subscribeMyAvatar(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}