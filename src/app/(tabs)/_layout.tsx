import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import Header from '../../shared/components/Header';
import BottomNav from '../../shared/components/BottomNav';
import QuickActionsSheet from '../../shared/components/QuickActionsSheet';
import CommunityListScreen from '../../features/communities/components/CommunityListScreen';
import CommunityDetailScreen from '../../features/communities/components/CommunityDetailScreen';
import useCommunityState from '../../features/dashboard/hooks/useCommunityState';
import DMOverlayScreen from '../../features/dm/components/DMOverlayScreen';
import RoomsOverlayScreen from '../../features/rooms/components/RoomsOverlayScreen';
import { getMyId } from '../../shared/utils/auth';
import { subscribeOpenOverlay } from '../../shared/utils/navOverlayBus';

// ---------------------------------------------------------------------------
// ASLI FIX #1 (pehle se yahan tha): `<Slot/>` ki jagah `<Tabs/>` navigator,
// taaki Dashboard/Profile ek baar khulne ke baad MOUNTED rahein (sirf
// hidden), remount na ho.
//
// ASLI FIX #2 (yeh pass): Rooms aur DM ab is `<Tabs/>` ke andar routes
// (Tabs.Screen) NAHI hain - dono Community list/detail jaisa hi PERSISTENT
// overlay hain, seedha yahan is shell mein render hote hain aur `show`
// boolean se slide hote hain. Pehle jab in par jaate the to `router.push`
// chalta tha -> `usePathname()` badalta -> neeche wala poora Reanimated
// wrapper (`slotAnimatedStyle`) re-animate hota tha - yeh EK BADA, coarse
// translateX tha (poora Tabs blob), aur route-change ka apna overhead bhi
// saath mein aata tha. Isi wajah se Community list (jo hamesha isolated,
// route-independent overlay tha) zyada smooth feel hoti thi, Rooms/DM
// "lag" jaisa.
//
// Ab Rooms/DM bhi Community jaisa isolated `PersistentSlide` overlay hain
// (dekho DMOverlayScreen.tsx/RoomsOverlayScreen.tsx) - koi route/pathname
// involve nahi, sirf ek chhota dedicated Reanimated translateX. Dashboard
// (Home/Feed) hi ab is neeche wale `<Tabs/>` mein akela "real" tab hai
// (Profile bhi abhi tab route hi hai - is pass ka scope Rooms/DM tak
// limited rakha hai, Profile mein koi lag report nahi hui thi).
//
// Feed hamesha persistent rehta hai (base layer), Rooms/DM/Community sab
// uske UPAR slide-in overlays hain - jaisa maanga gaya tha.
// ---------------------------------------------------------------------------

function tabIndexFromPath(pathname: string) {
  if (pathname.includes('/profile')) return 1;
  return 0; // dashboard / home / '/'
}

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isHomeActive = pathname === '/dashboard' || pathname === '/(tabs)/dashboard' || pathname === '/';
  const isProfileActive = pathname.includes('/profile');

  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rooms/DM: ab Community jaisa hi persistent-overlay boolean state,
  // is shell (_layout.tsx) mein hi rakha - taaki BottomNav ke Rooms/DM
  // icon, Home button (dono close karna) sab ek hi jagah se control ho
  // sakein (bilkul useCommunityState jaisa hi pattern).
  const [showRooms, setShowRooms] = useState(false);
  const [showDM, setShowDM] = useState(false);

  const closeRooms = useCallback(() => setShowRooms(false), []);
  const closeDM = useCallback(() => setShowDM(false), []);

  // Communities: list/detail screens self-contained hain, yeh hook sirf
  // unke show/close + navigation ka wiring hai (BottomNav ke Communities
  // icon se yahin se khulte hain, taaki kisi bhi tab par mount rahein -
  // Dashboard ki tarah yeh bhi persistent shell ka hissa hai).
  const community = useCommunityState();

  // Kisi bhi overlay (Rooms/DM/Community) ko dusra kholne se pehle band
  // karo - warna do overlays ek saath stacked reh sakte hain.
  const closeAllOverlayPanels = useCallback(() => {
    setShowRooms(false);
    setShowDM(false);
    community.closeAllCommunityPanels();
  }, [community]);

  const openRooms = useCallback(() => {
    setShowDM(false);
    community.closeAllCommunityPanels();
    setShowRooms(true);
  }, [community]);

  const openDM = useCallback(() => {
    setShowRooms(false);
    community.closeAllCommunityPanels();
    setShowDM(true);
  }, [community]);

  const openCommunities = useCallback(() => {
    setShowRooms(false);
    setShowDM(false);
    community.openCommunitiesList('all');
  }, [community]);

  // Rooms/DM ab routes nahi hain - Dashboard/Feed jaisi sibling screens
  // (jo pehle `router.push('/(tabs)/rooms')`/`.../dm` karti thi) ab is
  // bus se overlay khulwaane ka event bhejti hain, yahan sunte hain.
  useEffect(() => subscribeOpenOverlay((kind: string) => (kind === 'rooms' ? openRooms() : openDM())), [openRooms, openDM]);

  // BUG FIX (jaisa web me tha): kisi doosre tab (Dashboard/Profile) par
  // jaate waqt Rooms/DM/Communities sab force-close ho jaayein, taaki
  // peeche "stuck" na rahein.
  const goToTab = (path: string) => {
    closeAllOverlayPanels();
    router.push(path as any);
  };

  // --- swipe transition state (ab sirf Dashboard<->Profile ke beech) ----
  const prevIndexRef = useRef(tabIndexFromPath(pathname));
  const translateX = useSharedValue(0);

  useLayoutEffect(() => {
    const currentIndex = tabIndexFromPath(pathname);
    const prevIndex = prevIndexRef.current;

    if (currentIndex !== prevIndex) {
      // JHATKA FIX: `useLayoutEffect` PAINT SE PEHLE (synchronously)
      // chalta hai, to startX par jump user ko kabhi dikhta hi nahi -
      // seedha smooth slide-in dikhega.
      const goingForward = currentIndex > prevIndex;
      const startX = goingForward ? width * 0.35 : -width * 0.35;

      translateX.value = startX;
      translateX.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });

      prevIndexRef.current = currentIndex;
    }
  }, [pathname, width, translateX]);

  const slotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const openQuickActions = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setShowQuickActions(true);
    setQuickActionsOpen(true);
  };
  const closeQuickActions = () => {
    setQuickActionsOpen(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setShowQuickActions(false), 280);
  };

  // Home ka "+" / "X" FAB: Tabs navigator ke andar `router.push` yahan
  // stack-push NAHI karta - yeh sirf us tab ko focus karta hai (screen
  // already mounted hai to turant switch hota hai).
  const handleHomeActionClick = () => {
    // Rooms/DM/Communities sab is persistent shell ke upar overlay hain
    // (route change nahi karte), isliye Home button pehle inhe band kare -
    // warna route already `/dashboard` hone ki wajah se yeh sirf
    // quick-actions sheet toggle kar deta tha aur overlay khula reh jaata.
    if (showRooms || showDM || community.showCommunities || community.openCommunity) {
      closeAllOverlayPanels();
      return;
    }
    if (isHomeActive) {
      quickActionsOpen ? closeQuickActions() : openQuickActions();
    } else {
      closeQuickActions();
      router.push('/(tabs)/dashboard');
    }
  };

  const handleComposeClick = () => {
    closeQuickActions();
    router.push({ pathname: '/(tabs)/dashboard', params: { compose: '1' } });
  };

  return (
    <View style={[styles.screen, isHomeActive && { paddingTop: insets.top }]}>
      {isHomeActive && (
        <Header
          onSearchClick={() => {}}
          onNotificationsClick={() => {}}
          hasUnreadNotifications={false}
          onProfileClick={() => router.push('/(tabs)/profile')}
          myAvatarUrl={null}
          onShopClick={() => router.push('/(tabs)/profile')}
        />
      )}

      <View style={styles.body}>
        <Animated.View style={[styles.body, slotAnimatedStyle]}>
          <Tabs
            // WHITE FLASH FIX + BOTTOM-NAV BOUNDARY FIX (dono pehle jaisa
            // hi): tab-bar hide + black scene background.
            tabBar={() => null}
            screenOptions={{
              headerShown: false,
              sceneStyle: { backgroundColor: '#000000' },
              animation: 'none',
            }}
          >
            <Tabs.Screen name="dashboard" />
            <Tabs.Screen name="profile" />
          </Tabs>
        </Animated.View>
      </View>

      <BottomNav
        onRoomsClick={openRooms}
        onDMClick={openDM}
        onHomeClick={() => goToTab('/(tabs)/dashboard')}
        onCommunitiesClick={openCommunities}
        onGameClick={() => {}}
        isHomeActive={isHomeActive && !showRooms && !showDM && !community.showCommunities && !community.openCommunity}
        isRoomsActive={showRooms}
        isDMActive={showDM}
        quickActionsOpen={quickActionsOpen}
        onHomeActionClick={handleHomeActionClick}
      />

      <QuickActionsSheet
        show={showQuickActions}
        open={quickActionsOpen}
        onClose={closeQuickActions}
        onComposeClick={handleComposeClick}
      />

      <RoomsOverlayScreen show={showRooms} onClose={closeRooms} />

      <DMOverlayScreen show={showDM} onClose={closeDM} />

      <CommunityListScreen
        show={community.showCommunities}
        onClose={community.closeCommunities}
        initialTab={community.communitiesInitialTab}
        onOpenCommunity={(c) => community.openCommunityById(c)}
      />

      <CommunityDetailScreen
        show={!!community.openCommunity}
        onClose={community.closeCommunityDetail}
        communityId={community.openCommunity?.id as any}
        myId={getMyId()}
        postedTick={community.postedTick}
        deletedPost={community.deletedPost}
        onOpenCreatePost={(c) => {
          community.closeAllCommunityPanels();
          router.push({
            pathname: '/(tabs)/dashboard',
            params: {
              compose: '1',
              lockedCommunityId: String(c.id),
              lockedCommunityName: c.name || '',
              lockedCommunityIconId: c.icon_id != null ? String(c.icon_id) : '',
              lockedCommunityIconUrl: c.icon_url || '',
            },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  body: { flex: 1 },
});