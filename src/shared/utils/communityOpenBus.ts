// Module-level pub-sub (navOverlayBus.ts jaisa hi) - taaki kisi bhi screen
// (Feed ka community chip, PostDetailModal, @mention text, notification tap,
// waghera) se Community detail overlay khulwaya ja sake, BINA route hone ke.
//
// WHY: CommunityDetailScreen `(tabs)/_layout.tsx` ke andar persistent overlay
// hai (`useCommunityState`), Feed/Dashboard/PostDetailModal iska seedha
// "parent" nahi hain - is bus se woh sirf ek event emit karte hain,
// `_layout.tsx` (jo already mounted hai) sun kar `community.openCommunityById`
// ya slug-lookup ke baad wahi call kar deta hai.

export interface CommunityOpenPayload {
  id: string | number;
  name?: string;
  icon_id?: string | number | null;
  icon_url?: string | null;
}

type Listener = (payload: { byId?: CommunityOpenPayload; bySlug?: { slug: string; name?: string } }) => void;

let listeners: Listener[] = [];

export function subscribeOpenCommunity(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function requestOpenCommunityById(community: CommunityOpenPayload): void {
  listeners.forEach((l) => l({ byId: community }));
}

export function requestOpenCommunityBySlug(slug: string, name?: string): void {
  listeners.forEach((l) => l({ bySlug: { slug, name } }));
}

// Communities LIST (All/Mine tab) kholne ke liye - Profile tab jaisi screens
// apna alag list overlay render karne ki jagah yahi bus use karti hain, taaki
// `_layout.tsx` ka ek hi (sahi bottom-nav offset wala) list overlay khule.
type ListListener = (tab: 'all' | 'mine') => void;
let listListeners: ListListener[] = [];

export function subscribeOpenCommunitiesList(listener: ListListener): () => void {
  listListeners.push(listener);
  return () => {
    listListeners = listListeners.filter((l) => l !== listener);
  };
}

export function requestOpenCommunitiesList(tab: 'all' | 'mine' = 'all'): void {
  listListeners.forEach((l) => l(tab));
}