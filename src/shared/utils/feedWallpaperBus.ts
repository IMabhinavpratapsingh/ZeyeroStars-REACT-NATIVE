// Module-level pub-sub (quickActionsBus jaisa) - QuickActionsSheet ((tabs)/_layout.tsx ke
// persistent shell mein) ka "Wallpaper" tile dashboard.tsx (Feed) ko batata hai ki
// wallpaper set/change/remove flow chalao. Wallpaper state Feed ke paas hi hai.

let listeners: (() => void)[] = [];

export function subscribeFeedWallpaper(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function requestFeedWallpaper(): void {
  listeners.forEach((l) => l());
}