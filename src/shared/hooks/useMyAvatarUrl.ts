import { useSyncExternalStore } from 'react';
import { getMyAvatarUrl, subscribeMyAvatar } from '../utils/myAvatarBus';

// Apni pfp URL (ya null) - myAvatarBus badalte hi re-render.
export default function useMyAvatarUrl(): string | null {
  return useSyncExternalStore(subscribeMyAvatar, getMyAvatarUrl, getMyAvatarUrl);
}