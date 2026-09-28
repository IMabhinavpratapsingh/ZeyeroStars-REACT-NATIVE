import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { loadNetworkToken, getToken } from '../shared/services/NetworkManager';
import { loadMyId } from '../shared/utils/auth';
import { hydrateAvatarCache } from '../features/avatar/services/avatarCache';
import { setupAuthInterceptor } from '../shared/services/authInterceptor';
import { setupPushNotifications } from '../shared/services/pushNotifications';
import { handleHardwareBack } from '../shared/utils/backButtonStack';
import { initAds } from '../shared/services/adsService';
import { initVerifiedBadgeStore } from '../shared/services/verifiedBadgePurchase';

import AlertPopupHost from '../shared/components/AlertPopupHost';
import ConfirmPopupHost from '../shared/components/ConfirmPopupHost';
import RulesWarningHost from '../shared/components/RulesWarningHost';
import UpdateRequiredModal from '../shared/components/UpdateRequiredModal';

// WEB -> RN CHANGES (App.jsx se yahan migrate hua):
// - BrowserRouter/Routes ki jagah expo-router ka <Stack> - actual route
//   files (index.tsx, login.tsx, username-selection.tsx, (tabs)/) khud
//   navigation define karte hain, yahan sirf shell hai.
// - UpdateRequiredModal ab AlertPopupHost ke saath yahan mounted hai.
// - `isAuthenticated()` check (localStorage) ab route files (index.tsx,
//   authInterceptor.ts) mein hota hai - yahan sirf boot-time cache warm-up.
// - Capacitor App.addListener('backButton') ki jagah RN ka BackHandler
//   (Android-only, iOS par no-op) - backButtonStack.ts wahi logic hai.
// - window.history dummy-entry / popstate guard RN mein zaroori nahi -
//   expo-router apna khud ka navigation stack rakhta hai.
export default function RootLayout() {
  const [booted, setBooted] = useState(false);

  // App cold-start pe token/my_id AsyncStorage se in-memory cache mein
  // load karo (sync getToken()/getMyId() baaki poori app mein isi cache
  // ka use karte hain), axios 401/ban interceptor ek baar setup karo,
  // aur agar user pehle se logged in hai to push notification register
  // karo (purane users ke liye bhi - dekho original App.jsx comment).
  useEffect(() => {
    (async () => {
      await Promise.all([loadNetworkToken(), loadMyId(), hydrateAvatarCache()]);
      setupAuthInterceptor();

      // main.jsx (capacitor) mein ye dono app-start pe ek baar chalte the -
      // yahan bhi non-fatal, boot ko block nahi karte.
      initAds().catch((e) => console.error('initAds error (non-fatal):', e));
      initVerifiedBadgeStore().catch((e) =>
        console.error('initVerifiedBadgeStore error (non-fatal):', e)
      );

      if (getToken()) {
        setTimeout(() => {
          setupPushNotifications().catch((e) =>
            console.error('push init error (non-fatal):', e)
          );
        }, 0);
      }

      setBooted(true);
    })();
  }, []);

  // Hardware back button (Android) - jo bhi modal/screen abhi top par khuli
  // hai (backButtonStack.ts ke stack se) usi ko close karo; kuch khula
  // nahi to RN ka default behaviour (screen stack back / app minimize) hone do.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => sub.remove();
  }, []);

  if (!booted) return null; // Splash screen expo-splash-screen plugin khud handle karta hai

  return (
    // GestureHandlerRootView: poori app (Stack ke andar har screen) ko
    // wrap karna zaroori hai - warna kahin bhi GestureDetector (jaise
    // ZoomableAvatarView ka pinch-zoom) use hote hi "GestureDetector must
    // be used as a descendant of GestureHandlerRootView" crash aata hai.
    // Pehle import to tha par kahin actually render/wrap nahi ho raha tha.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="username-selection" />
            <Stack.Screen name="(tabs)" />
          </Stack>

          {/* Global overlays - ek hi baar mount, poori app mein kahin se bhi
              showAlert() / confirmAction() / showRulesWarning() call karke
              use kiye ja sakte hain. */}
          <AlertPopupHost />
          <ConfirmPopupHost />
          <RulesWarningHost />
          <UpdateRequiredModal />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}