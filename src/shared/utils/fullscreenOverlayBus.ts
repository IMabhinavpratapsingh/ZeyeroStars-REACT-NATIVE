// Module-level pub-sub (navOverlayBus.ts jaisa hi) - PostDetailModal jaisa
// "true fullscreen" overlay (no app Header, no BottomNav, apna hi input
// footer) khulta/band hota hai to Dashboard/Feed yahan se `(tabs)/_layout.tsx`
// (jo Header/BottomNav ka asli owner hai) ko bata deta hai. _layout sirf
// `fullscreenOverlayOpen` boolean state rakh kar Header/BottomNav conditionally
// render karna band kar deta hai jab tak overlay khula hai.

type Listener = (isOpen: boolean) => void;

let listeners: Listener[] = [];

export function subscribeFullscreenOverlay(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function setFullscreenOverlayOpen(isOpen: boolean): void {
  listeners.forEach((l) => l(isOpen));
}