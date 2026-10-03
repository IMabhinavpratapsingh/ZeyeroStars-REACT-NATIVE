// Module-level pub-sub (quickActionsBus.ts / profileOpenBus.ts jaisa hi) -
// taaki kisi bhi screen (Shop, Limited Store, waghera) se `StoreScreen`
// seedha kisi tab par khulwaya ja sake, BINA prop-drilling ke.
// `(tabs)/_layout.tsx` (persistent shell) is bus ko sunta hai aur
// StoreScreen kholta hai. Shop ke upar khulta hai (naya top z-index),
// back dabane par wapas Shop dikhta hai.

export type StoreTabId = 'subscriptions' | 'zmoney';

type Listener = (tab: StoreTabId) => void;

let listeners: Listener[] = [];

export function subscribeOpenStore(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function requestOpenStore(tab: StoreTabId = 'zmoney'): void {
  listeners.forEach((l) => l(tab));
}