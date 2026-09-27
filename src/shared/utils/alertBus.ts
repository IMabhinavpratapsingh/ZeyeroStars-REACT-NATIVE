// Module-level pub-sub (no context/provider needed) - lets ANY file
// (deep inside a modal, a service, wherever) trigger the app's popup UI
// with a single `showAlert("...")` call, same as `alert(...)` used to
// work, but rendered as our own styled popup instead of the browser's
// native "localhost says" dialog. AlertPopupHost (mounted once, in
// root _layout.tsx) is the only subscriber that actually renders anything.
//
// No web APIs used here - works identically in RN, no changes needed.

export type AlertType = 'error' | 'success' | 'info';

export interface AlertPopup {
  id: number;
  message: string;
  type: AlertType;
}

let listeners: ((popup: AlertPopup) => void)[] = [];
let nextId = 1;

export function subscribeAlert(listener: (popup: AlertPopup) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// type: 'error' (default) | 'success' | 'info' - AlertPopupHost picks an
// icon/color per type, message is whatever text would've gone to alert().
export function showAlert(message: string, type: AlertType = 'error'): void {
  if (!message) return;
  const popup: AlertPopup = { id: nextId++, message: String(message), type };
  listeners.forEach((l) => l(popup));
}

export default showAlert;