import AsyncStorage from '@react-native-async-storage/async-storage';

// IMPORTANT (web -> RN difference):
// Web mein localStorage SYNC tha, isliye getMyId() turant value de deta tha.
// RN mein AsyncStorage hamesha ASYNC hai - koi sync read possible nahi.
// Fix: app start pe (login ke baad, aur app boot pe) ek baar loadMyId()
// call karo jo value ko in-memory cache (myIdCache) mein bhar deta hai.
// Uske baad getMyId() turant (sync) cached value de dega - jaise pehle
// localStorage se milta tha. Agar cache abhi khali hai, use getMyIdAsync().

let myIdCache: string | null = null;

// App boot pe (_layout.tsx) aur Login.tsx mein login success ke turant
// baad ye call karo taaki cache bhar jaye.
export const loadMyId = async (): Promise<string | null> => {
  myIdCache = await AsyncStorage.getItem('my_id');
  if (!myIdCache) {
    console.error("loadMyId: 'my_id' not found in AsyncStorage. Log in again so Login.tsx can save it.");
  }
  return myIdCache;
};

// Login.tsx mein login success hone par ye call karke id save + cache karo.
export const setMyId = async (id: string): Promise<void> => {
  myIdCache = id;
  await AsyncStorage.setItem('my_id', id);
};

// Purani jagah jaha seedha localStorage.getItem('my_id') tha, wahan ye use karo.
// NOTE: ye sirf cache se deta hai - loadMyId() pehle call hona chahiye
// (app boot pe), warna null milega.
export const getMyId = (): string | null => {
  if (!myIdCache) {
    console.error("getMyId: cache empty. Call loadMyId() first (usually in root _layout.tsx on app start).");
  }
  return myIdCache;
};

// Jahan bhi fresh/guaranteed value chahiye (cache miss ka risk na lena ho),
// wahan ye async version use karo.
export const getMyIdAsync = async (): Promise<string | null> => {
  if (myIdCache) return myIdCache;
  return loadMyId();
};

export const clearMyId = async (): Promise<void> => {
  myIdCache = null;
  await AsyncStorage.removeItem('my_id');
};

// Ban message ka ek hi fixed format - teen jagah (authInterceptor.ts,
// Login.tsx, useWebSocket.ts) use hota hai, isliye yahan ek jagah rakha
// hai taaki teeno jagah hamesha same dikhe.
export const buildBanMessage = (reason?: string | null): string => {
  const trimmedReason = (reason || '').trim();
  return (
    'You are permanently banned from ZeyeroStars.\n\n' +
    `Reason: ${trimmedReason || 'No reason provided'}\n\n` +
    "If you'd like to talk about this, email zeyerotech@gmail.com"
  );
};