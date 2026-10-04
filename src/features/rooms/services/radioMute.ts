import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Room radio ka mute flag. RoomRadioPlayer (root mein mounted) aur RoomChatWindow
// (mute button) dono isi se sync rehte hain. AsyncStorage mein save hota hai,
// isliye app restart / dusre room mein bhi mute yaad rehta hai.
const KEY = 'room_radio_muted';
let muted = false;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === '1' && !muted) {
      muted = true;
      listeners.forEach((fn) => fn());
    }
  })
  .catch(() => {});

export function setRadioMuted(value: boolean) {
  if (muted === value) return;
  muted = value;
  listeners.forEach((fn) => fn());
  AsyncStorage.setItem(KEY, value ? '1' : '0').catch(() => {});
}

export function toggleRadioMuted() {
  setRadioMuted(!muted);
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function useRadioMuted(): boolean {
  return useSyncExternalStore(subscribe, () => muted);
}