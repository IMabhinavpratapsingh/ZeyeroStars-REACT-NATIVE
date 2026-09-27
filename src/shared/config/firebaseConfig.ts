import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
// `getReactNativePersistence` runtime mein 'firebase/auth' ke react-native
// build (Metro automatically chunta hai) mein hota hai, lekin kuch firebase
// versions ke TypeScript typings mein missing dikhta hai - isliye ts-ignore.
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';

// Yeh Firebase "Web app" ka public config hai (secret nahi) - JS SDK ke
// liye RN mein bhi wahi web appId chalta hai.
const firebaseConfig = {
  apiKey: 'AIzaSyD9S08d4UpIVuDicr9DS1lyGx_6jzlfF8g',
  authDomain: 'zeyerostars-0.firebaseapp.com',
  projectId: 'zeyerostars-0',
  storageBucket: 'zeyerostars-0.firebasestorage.app',
  messagingSenderId: '873276585181',
  appId: '1:873276585181:web:799179007dd39349be1734',
};

// Fast Refresh / hot reload mein module dobara chalta hai - initializeApp()
// / initializeAuth() dobara call karne par "already exists" error aata hai,
// isliye pehle check.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// WEB -> RN DIFFERENCE: web mein getAuth(app) browser storage se login
// session khud yaad rakhta tha. RN mein AsyncStorage persistence
// EXPLICITLY dena padta hai (initializeAuth se) - warna app restart par
// Firebase user logout ho jaata hai.
function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already initialized (hot reload) - maujooda instance wapas lo
    return getAuth(app);
  }
}

export const auth = createAuth();