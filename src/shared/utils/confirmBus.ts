// Same pattern as alertBus.ts, but for a Yes/No confirmation instead of
// a fire-and-forget toast. Any file can just `await confirmAction({...})`
// - no prop drilling, no per-component modal state. ConfirmPopupHost
// (mounted once, in root _layout.tsx) is the only subscriber that renders
// anything; it resolves the promise when the user taps Confirm/Cancel.
//
// No web APIs used here - works identically in RN, no changes needed.

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

let listener: ((req: ConfirmRequest) => void) | null = null;

export function subscribeConfirm(fn: (req: ConfirmRequest) => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

// Resolves true if user confirmed, false if cancelled/dismissed.
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      // Host isn't mounted for some reason - fail safe to "not confirmed"
      // rather than silently deleting something.
      resolve(false);
      return;
    }
    listener({ ...options, resolve });
  });
}

export default confirmAction;