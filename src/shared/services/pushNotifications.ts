// Push notifications setup (FCM via expo-notifications).
//
// Install (ek baar):
//   npx expo install expo-notifications
//
// app.json / app.config:
//   "plugins": ["expo-notifications"],
//   "android": { "googleServicesFile": "./google-services.json" }
//
// Android: google-services.json (Firebase console -> Project settings ->
//   Android app -> download) project root mein rakho - Expo config plugin
//   Gradle setup khud kar deta hai (Capacitor ki tarah manual
//   build.gradle edit nahi karna). Iske bina getDevicePushTokenAsync()
//   fail hota hai - neeche try/catch se app crash nahi hoti, push bas skip.
// iOS: Firebase se GoogleService-Info.plist + Apple Developer account mein
//   APNs key chahiye (EAS build credentials sambhal leta hai).
//
// IMPORTANT: push Expo Go mein nahi chalta (Android SDK 53+) - development
//   build (`npx expo run:android` ya EAS dev build) use karo.
//
// BACKEND NOTE: `/devices/register` ko wahi NATIVE token milta hai jo
//   Capacitor deta tha - getDevicePushTokenAsync() Android par FCM token
//   deta hai, to backend mein koi change nahi chahiye. (iOS par APNs token
//   milta hai, FCM nahi - agar iOS push chahiye to backend/Firebase side alag
//   se dekhna padega, Capacitor mein bhi yehi limitation thi.)

import axios from 'axios';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { API_BASE } from '../config/config';
import { getToken } from './NetworkManager';

export type PushTapData = {
  type?: string;
  sender_id?: string | number;
  [key: string]: unknown;
};
type PushTapHandler = (data: PushTapData) => void;

// App khuli hote hue (foreground) DM push ka banner + sound dikhao - backend
// sirf tab bhejta hai jab user Inbox / us sender ki chat par NAHI hai (dm_view).
// Baaki push types foreground mein pehle jaise silent (app ka apna UI dikhata hai).
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isDM = (notification.request.content.data as any)?.type === 'dm';
    return {
      shouldShowBanner: isDM,
      shouldShowList: isDM,
      shouldPlaySound: isDM,
      shouldSetBadge: false,
    };
  },
});

type Subscription = { remove: () => void };
let tokenSub: Subscription | null = null;
let receivedSub: Subscription | null = null;
let responseSub: Subscription | null = null;

// Notification tap ka navigation yahan hardcode nahi karte (web mein
// `/dm/${sender_id}` route tha - ab DM Dashboard ke andar khulta hai).
// Dashboard/_layout mein register karo:
//   setPushTapHandler((d) => { if (d.type === 'dm' && d.sender_id) openDM(d.sender_id); });
// Agar app notification tap se cold-start hui thi aur handler abhi register
// nahi hua, to tap yaad rehta hai aur register hote hi deliver ho jaata hai.
let tapHandler: PushTapHandler | null = null;
let pendingTap: PushTapData | null = null;

export function setPushTapHandler(handler: PushTapHandler | null): void {
  tapHandler = handler;
  if (handler && pendingTap) {
    const data = pendingTap;
    pendingTap = null;
    handler(data);
  }
}

function dispatchTap(data: PushTapData) {
  if (tapHandler) tapHandler(data);
  else pendingTap = data;
}

async function registerTokenWithBackend(deviceToken: string) {
  const authToken = getToken();
  if (!authToken) return; // login ke baad hi call hona chahiye
  try {
    await axios.post(
      `${API_BASE}/devices/register`,
      { token: deviceToken, platform: Platform.OS },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('[PUSH] token registered with backend:', deviceToken.slice(0, 16) + '...');
  } catch (e) {
    console.error('push token register failed', e);
  }
}

// Login ke BAAD call karo (taaki z_token available ho). Dobara call karna
// safe hai - purane listeners hata ke naye lagte hain (duplicate nahi).
export async function setupPushNotifications(): Promise<void> {
  // Web/unsupported platform par skip.
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  try {
    if (Platform.OS === 'android') {
      // Android 8+ par channel ke bina notification dikhti hi nahi.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
      });
      // Backend (push_service.py) channel_id="messages" bhejta hai - ye channel
      // na ho to Android 8+ par notification sahi importance/sound ke bina aata hai.
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
      });
    }

    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) {
      console.log('[PUSH] notification permission denied');
      return; // user ne deny kar diya
    }

    tokenSub?.remove();
    receivedSub?.remove();
    responseSub?.remove();

    // Token rotate/refresh hone par bhi backend ko naya token mil jaye.
    tokenSub = Notifications.addPushTokenListener((t: { data: string; }) => {
      if (typeof t.data === 'string') registerTokenWithBackend(t.data);
    });

    receivedSub = Notifications.addNotificationReceivedListener((notification: any) => {
      console.log('push received in foreground', notification);
      // yahan apna useNotification() wala showNotification() call kar sakte ho
    });

    // User ne notification tap karke app open kiya.
    responseSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      dispatchTap(response.notification.request.content.data as PushTapData);
    });

    // App band thi aur notification tap se khuli (cold start).
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      dispatchTap(last.notification.request.content.data as PushTapData);
      Notifications.clearLastNotificationResponse();
    }

    const deviceToken = await Notifications.getDevicePushTokenAsync();
    if (typeof deviceToken.data === 'string') {
      await registerTokenWithBackend(deviceToken.data);
    }
  } catch (err) {
    // Push setup fail hui (google-services.json missing, permission cancel,
    // etc.) - kabhi bhi poori app ko crash/block nahi karna.
    console.error('setupPushNotifications failed (non-fatal):', err);
  }
}