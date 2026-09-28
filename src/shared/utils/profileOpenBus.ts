// Module-level pub-sub (navOverlayBus.ts / communityOpenBus.ts jaisa hi) -
// taaki kisi bhi screen (Feed ka poster row, PostDetailModal, comment avatar,
// waghera) se ProfileViewModal khulwaya ja sake, BINA route hone ke.
// `(tabs)/_layout.tsx` (root persistent shell) is bus ko sunta hai aur
// ProfileViewModal ko `profile={{ id, username }}` ke saath khol deta hai.

export interface ProfileOpenPayload {
  id: string | number;
  username?: string;
}

type Listener = (user: ProfileOpenPayload) => void;

let listeners: Listener[] = [];

export function subscribeOpenProfile(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function requestOpenProfile(user: ProfileOpenPayload): void {
  listeners.forEach((l) => l(user));
}