import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
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
import ProfileViewModal from '../../features/dm/components/ProfileViewModal';
import ShopModal from '../../features/dm/components/ShopModal';
import SettingsMenu from '../../features/dm/components/SettingsMenu';
import LeaderboardModal from '../../features/dm/components/LeaderboardModal';
import MissionsModal from '../../features/missions/components/MissionsModal';
import DailyRewardPopup from '../../shared/components/DailyRewardPopup';
import RankRewardsScreen from '../../shared/components/RankRewardsScreen';
import StoreScreen from '../../shared/components/StoreScreen';
import SearchModal from '../../features/dm/components/SearchModal';
import NotificationsModal from '../../features/dm/components/NotificationsModal';
import PostDetailModal from '../../features/feed/components/PostDetailModal';
import useDashboardBalance from '../../features/dashboard/hooks/useDashboardBalance';
import { getPost, togglePostLike } from '../../features/feed/services/feedApi';
import { requestOpenProfile } from '../../shared/utils/profileOpenBus';
import { getMyId, getMyIdAsync } from '../../shared/utils/auth';
import axios from 'axios';
import { API_BASE } from '../../shared/config/config';
import networkManager, { getToken } from '../../shared/services/NetworkManager';
import { FIELD } from '../../shared/utils/profileFields';
import { setMyAvatarUrl } from '../../shared/utils/myAvatarBus';
import useMyAvatarUrl from '../../shared/hooks/useMyAvatarUrl';
import { getCommunityBySlug } from '../../features/communities/services/communitiesApi';
import { showAlert } from '../../shared/utils/alertBus';
import { subscribeOpenOverlay, requestOpenDM, subscribeOpenRoom } from '../../shared/utils/navOverlayBus';
import { subscribeOpenQuickActions } from '../../shared/utils/quickActionsBus';
import { requestFeedScrollTopReload } from '../../shared/utils/feedScrollBus';
import { subscribeOpenCommunity, requestOpenCommunityBySlug, requestOpenCommunityById } from '../../shared/utils/communityOpenBus';
import { subscribeOpenProfile, type ProfileOpenPayload } from '../../shared/utils/profileOpenBus';
import { subscribeFullscreenOverlay } from '../../shared/utils/fullscreenOverlayBus';
import { requestOpenGame, subscribeGameActive } from '../../shared/utils/gameOverlayBus';
import GameOverlayScreen from '../../features/battle/components/GameOverlayScreen';

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
  // WebSocket app khulte hi connect karo. Pehle poori app mein kahin connect()
  // call hi nahi hota tha - socket tab khulta tha jab koi action (game start, DM
  // send) "not connected" milne par reconnect() chalata, isliye PEHLI baar hamesha
  // "No connection" aata tha. onDisconnect -> reconnect (backoff ke saath), aur
  // app background se wapas aane par socket band mila to turant dobara connect.
  useEffect(() => {
    if (!getToken()) return;
    const onDisconnect = () => networkManager.reconnect();
    if (!networkManager.isConnected() && !networkManager.isConnecting()) {
      networkManager.connect(undefined, onDisconnect);
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (networkManager.isConnected()) {
        // OPEN dikhne wala socket zombie ho sakta hai (background mein OS ne
        // network tod diya) - ping se confirm karo, zombie nikla to khud reconnect.
        networkManager.ensureAlive();
      } else if (!networkManager.isConnecting()) {
        networkManager.forceReconnect();
      }
    });
    return () => sub.remove();
  }, []);

  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isHomeActive = pathname === '/dashboard' || pathname === '/(tabs)/dashboard' || pathname === '/';
  const isProfileActive = pathname.includes('/profile');

  // Header ke Profile button ki pfp - GET /profile/{myId} se ek baar
  // (boot pe) fetch, baad mein ProfileViewModal upload/remove par bus se
  // update karta hai. Fail ho to chup-chaap default icon.
  const myAvatarUrl = useMyAvatarUrl();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const myId = await getMyIdAsync();
        const token = getToken();
        if (!myId || !token) return;
        const res = await axios.get(`${API_BASE}/profile/${myId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          setMyAvatarUrl(res.data?.[FIELD.avatar] ?? null);
          setMyUsername(res.data?.username || '');
        }
      } catch {
        // ignore - Header default icon dikha dega
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Quick-actions sheet ke tiles ki screens - Header ke Shop/Search jaise
  // hi in-tree overlays (route nahi), sirf `show` boolean se khulte hain.
  const [showStore, setShowStore] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [showDailyPopup, setShowDailyPopup] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showRankRewards, setShowRankRewards] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasClaimableMission, setHasClaimableMission] = useState(false);
  const [myUsername, setMyUsername] = useState('');
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

  // Header ke Shop / Search / Notifications - yeh bhi DM/Profile/Community
  // jaise overlay hain (route nahi), sirf `show` boolean se slide-in.
  const [showShop, setShowShop] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [notifPost, setNotifPost] = useState<any | null>(null);
  const { balance, fetchBalance, setBalance, handleAdRewardCredited } = useDashboardBalance();

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // App khulte hi bell ka red-dot (unread) check
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    axios
      .get(`${API_BASE}/notifications/unread_count`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setHasUnreadNotifications((res.data?.count || 0) > 0))
      .catch(() => {});
  }, []);

  const closeHeaderOverlays = useCallback(() => {
    setShowShop(false);
    setShowSearch(false);
    setShowNotifications(false);
  }, []);

  const openShop = useCallback(() => {
    setShowRooms(false);
    setShowDM(false);
    setShowSearch(false);
    setShowNotifications(false);
    setShowShop(true);
  }, []);

  const openSearch = useCallback(() => {
    setShowRooms(false);
    setShowDM(false);
    setShowShop(false);
    setShowNotifications(false);
    setShowSearch(true);
  }, []);

  const openNotifications = useCallback(() => {
    setShowRooms(false);
    setShowDM(false);
    setShowShop(false);
    setShowSearch(false);
    setShowNotifications(true);
    setHasUnreadNotifications(false);
  }, []);

  // Users tab ka search - web wale Dashboard.handleSearch jaisa hi
  const handleUserSearch = useCallback(async () => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const token = getToken();
      const res = await axios.get(`${API_BASE}/search/${encodeURIComponent(term)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSearchResults(res.data?.items || []);
    } catch (err: any) {
      console.error('Search error:', err?.response?.data || err?.message);
      setSearchResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  }, [searchTerm]);

  const openPostFromNotification = useCallback(async (postId: string | number) => {
    try {
      const res = await getPost(postId);
      if (res.data?.post) setNotifPost(res.data.post);
    } catch (err: any) {
      console.error('Open post from notification error:', err?.response?.data || err?.message);
    }
  }, []);

  const handleNotifPostLike = useCallback(async (id: string | number) => {
    setNotifPost((p: any) =>
      p && p.id === id
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1) }
        : p
    );
    try {
      const res = await togglePostLike(id);
      setNotifPost((p: any) => (p && p.id === id ? { ...p, liked_by_me: !!res.data.liked, likes_count: res.data.likes } : p));
    } catch {
      // ignore - next open pe sahi state aayegi
    }
  }, []);

  // Kisi bhi overlay (Rooms/DM/Community) ko dusra kholne se pehle band
  // karo - warna do overlays ek saath stacked reh sakte hain.
  const closeAllOverlayPanels = useCallback(() => {
    setShowRooms(false);
    setShowDM(false);
    closeHeaderOverlays();
    community.closeAllCommunityPanels();
  }, [community, closeHeaderOverlays]);

  const openRooms = useCallback(() => {
    closeHeaderOverlays();
    setShowDM(false);
    community.closeAllCommunityPanels();
    setShowRooms(true);
  }, [community, closeHeaderOverlays]);

  const openDM = useCallback(() => {
    closeHeaderOverlays();
    setShowRooms(false);
    community.closeAllCommunityPanels();
    setShowDM(true);
  }, [community, closeHeaderOverlays]);

  const openCommunities = useCallback(() => {
    closeHeaderOverlays();
    setShowRooms(false);
    setShowDM(false);
    community.openCommunitiesList('all');
  }, [community, closeHeaderOverlays]);

  // Rooms/DM ab routes nahi hain - Dashboard/Feed jaisi sibling screens
  // (jo pehle `router.push('/(tabs)/rooms')`/`.../dm` karti thi) ab is
  // bus se overlay khulwaane ka event bhejti hain, yahan sunte hain.
  useEffect(() => subscribeOpenOverlay((kind: string) => (kind === 'rooms' ? openRooms() : openDM())), [openRooms, openDM]);
  // RoomsStrip se kisi room par tap -> Rooms overlay khol do (join RoomsOverlayScreen khud karega).
  useEffect(() => subscribeOpenRoom(() => openRooms()), [openRooms]);

  // PostDetailModal jaisa true-fullscreen overlay khula ho to Header aur
  // BottomNav dono hide - post pura screen le, neeche sirf apna comment
  // input rahe.
  const [fullscreenOverlayOpen, setFullscreenOverlayOpenState] = useState(false);
  useEffect(() => subscribeFullscreenOverlay((isOpen) => setFullscreenOverlayOpenState(isOpen)), []);

  // Game tab (Battle/Bluff Court) - GameOverlayScreen apna poora state
  // khud rakhta hai (Rooms/DM jaisa persistent overlay), BottomNav ka
  // "Game" icon sirf gameOverlayBus se isse toggle karne ko bolta hai.
  const [isGameActive, setIsGameActive] = useState(false);
  useEffect(() => subscribeGameActive(setIsGameActive), []);

  // Feed/PostDetailModal/@mentions se "community naam par tap" -> yahi
  // bus sunta hai aur community.openCommunityById() call karta hai (ya
  // pehle slug se community fetch karke). Overlay-close hierarchy same
  // rakhne ke liye baaki panels bhi band kar dete hain.
  useEffect(
    () =>
      subscribeOpenCommunity(async ({ byId, bySlug }) => {
        setShowRooms(false);
        setShowDM(false);
        if (byId) {
          community.openCommunityById(byId);
          return;
        }
        if (bySlug) {
          try {
            const res = await getCommunityBySlug(bySlug.slug);
            const found = res.data?.community || res.data;
            if (found) {
              community.openCommunityById(found);
            } else {
              showAlert("Couldn't find that community.");
            }
          } catch (err: any) {
            console.error('Open community by slug error:', err.response?.data || err.message);
            showAlert("Couldn't find that community.");
          }
        }
      }),
    [community],
  );

  // Feed/PostDetailModal/comment avatar se "username/pfp par tap" -> yahi
  // bus sunta hai aur ProfileViewModal ko is user ke saath khol deta hai.
  const [viewingProfile, setViewingProfile] = useState<ProfileOpenPayload | null>(null);
  useEffect(
    () =>
      subscribeOpenProfile((user) => {
        setShowRooms(false);
        setShowDM(false);
        closeHeaderOverlays();
        community.closeAllCommunityPanels();
        setViewingProfile(user);
      }),
    [community, closeHeaderOverlays],
  );

  // Feed list ke floating "++" quick-actions FAB (dashboard.tsx, sirf feed
  // list ke saath render hota hai) se request - Home button ab is sheet ko
  // nahi kholta (woh sirf Home hai), isliye ek dedicated bus se sunte hain.
  useEffect(() => subscribeOpenQuickActions(() => openQuickActions()), []);

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

  // Home button - ab Instagram jaisa: Tabs navigator ke andar
  // `router.push` yahan stack-push NAHI karta - yeh sirf us tab ko focus
  // karta hai (screen already mounted hai to turant switch hota hai).
  const anyOverlayOpen = showRooms || showDM || community.showCommunities || !!community.openCommunity;

  // SINGLE TAP: feed par wapas. Rooms/DM/Communities sab is persistent
  // shell ke upar overlay hain (route change nahi karte), isliye pehle
  // inhe band karo - warna route already `/dashboard` hone ki wajah se
  // kuch na hota aur overlay khula reh jaata. Already feed par ho, koi
  // overlay khula na ho -> no-op (Instagram mein bhi home tab par home
  // tap se kuch nahi hota, sirf double-tap scroll karta hai).
  const handleHomeSingleTap = () => {
    closeQuickActions();
    if (anyOverlayOpen) {
      closeAllOverlayPanels();
      return;
    }
    if (!isHomeActive) {
      router.push('/(tabs)/dashboard');
    }
  };

  // DOUBLE TAP: sirf tab fire hota hai jab already home par ho aur koi
  // overlay khula na ho (BottomNav ka `canDoubleTap` isi ko guard karta
  // hai) - feed list ko top par scroll + reload karne ka event bhejo.
  const handleHomeDoubleTap = () => {
    requestFeedScrollTopReload();
  };

  // Quick-actions tiles - sheet band hone ke saath hi (BottomNav-active wale)
  // baaki overlays bhi hata do, phir target screen kholo.
  const openStore = useCallback(() => {
    closeAllOverlayPanels();
    setShowStore(true);
  }, [closeAllOverlayPanels]);
  const openMissions = useCallback(() => {
    closeAllOverlayPanels();
    setShowMissions(true);
  }, [closeAllOverlayPanels]);
  const openDaily = useCallback(() => {
    closeAllOverlayPanels();
    setShowDailyPopup(true);
  }, [closeAllOverlayPanels]);
  const openLeaderboard = useCallback(() => {
    closeAllOverlayPanels();
    setShowLeaderboard(true);
  }, [closeAllOverlayPanels]);
  const openRankRewards = useCallback(() => {
    closeAllOverlayPanels();
    setShowRankRewards(true);
  }, [closeAllOverlayPanels]);
  const openSettings = useCallback(() => {
    closeAllOverlayPanels();
    setShowSettings(true);
  }, [closeAllOverlayPanels]);

  const mergeBalance = useCallback(
    (nb: any) => nb && setBalance((prev) => ({ ...prev, ...nb })),
    [setBalance],
  );

  const handleComposeClick = () => {
    closeQuickActions();
    router.push({ pathname: '/(tabs)/dashboard', params: { compose: '1' } });
  };

  return (
    <View style={[styles.screen, isHomeActive && { paddingTop: insets.top }]}>
      {isHomeActive && !fullscreenOverlayOpen && (
        <Header
          onSearchClick={openSearch}
          onNotificationsClick={openNotifications}
          hasUnreadNotifications={hasUnreadNotifications}
          onProfileClick={() => router.push('/(tabs)/profile')}
          myAvatarUrl={myAvatarUrl}
          onShopClick={openShop}
          isShopActive={showShop}
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
              lazy: true,
              freezeOnBlur: true,
            }}
          >
            <Tabs.Screen name="dashboard" />
            <Tabs.Screen name="profile" />
          </Tabs>
        </Animated.View>
      </View>

      {!fullscreenOverlayOpen && (
      <BottomNav
        onRoomsClick={openRooms}
        onDMClick={openDM}
        onCommunitiesClick={openCommunities}
        onGameClick={requestOpenGame}
        isHomeActive={isHomeActive && !anyOverlayOpen}
        isRoomsActive={showRooms}
        isDMActive={showDM}
        isGameActive={isGameActive}
        onHomeSingleTap={handleHomeSingleTap}
        onHomeDoubleTap={handleHomeDoubleTap}
      />
      )}

      <GameOverlayScreen />

      <QuickActionsSheet
        show={showQuickActions}
        open={quickActionsOpen}
        onClose={closeQuickActions}
        onComposeClick={handleComposeClick}
        onStoreClick={openStore}
        onMissionsClick={openMissions}
        hasClaimableMission={hasClaimableMission}
        onRewardsClick={openDaily}
        onLeaderboardClick={openLeaderboard}
        onSettingsClick={openSettings}
        onRankRewardsClick={openRankRewards}
        onCommunitiesClick={openCommunities}
        onAdRewardCredited={handleAdRewardCredited}
      />

      <RoomsOverlayScreen show={showRooms} onClose={closeRooms} />

      <DMOverlayScreen
        show={showDM}
        onClose={closeDM}
        onOpenOverlay={openDM}
        myBalance={balance}
        onBalanceMerge={(nb) => setBalance((prev) => ({ ...prev, ...nb }))}
      />

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

      <ShopModal
        show={showShop}
        onClose={() => setShowShop(false)}
        balance={balance}
        onBalanceUpdate={(b: any) => b && setBalance((prev) => ({ ...prev, ...b }))}
      />

      <StoreScreen
        show={showStore}
        onClose={() => setShowStore(false)}
        onBalanceUpdate={(updater: any) => setBalance((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }))}
      />

      <MissionsModal
        show={showMissions}
        onClose={() => setShowMissions(false)}
        balance={balance}
        onBalanceUpdate={mergeBalance}
        onMissionsUpdate={setHasClaimableMission}
      />

      <DailyRewardPopup
        show={showDailyPopup}
        onClose={() => setShowDailyPopup(false)}
        balance={balance}
        onBalanceUpdate={mergeBalance}
      />

      <RankRewardsScreen
        show={showRankRewards}
        onClose={() => setShowRankRewards(false)}
        balance={balance}
        onBalanceUpdate={mergeBalance}
      />

      <LeaderboardModal
        show={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        onOpenProfile={(u) => {
          setShowLeaderboard(false);
          requestOpenProfile({ id: u.id, username: u.username });
        }}
      />

      <SettingsMenu
        show={showSettings}
        onClose={() => setShowSettings(false)}
        balance={balance}
        onBalanceUpdate={(updater: any) => setBalance((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }))}
        currentUsername={myUsername}
        onUsernameChanged={setMyUsername}
        onLogout={() => router.replace('/login')}
      />

      <SearchModal
        show={showSearch}
        onChangeSearchTerm={setSearchTerm}
        onSearch={handleUserSearch}
        results={searchResults}
        loading={isSearchingUsers}
        onClose={() => setShowSearch(false)}
        onSelectUser={(u) => requestOpenProfile({ id: u.id, username: u.username })}
        onOpenCommunity={(c) => {
          setShowSearch(false);
          community.openCommunityById(c);
        }}
      />

      <NotificationsModal
        show={showNotifications}
        onClose={() => setShowNotifications(false)}
        onOpenPost={openPostFromNotification}
        onOpenProfile={(u) => requestOpenProfile({ id: u.id, username: u.username })}
        onOpenCommunity={(c) => {
          setShowNotifications(false);
          community.openCommunityById(c);
        }}
      />

      <PostDetailModal
        post={notifPost}
        topInset={insets.top + 12}
        onClose={() => setNotifPost(null)}
        onToggleLike={handleNotifPostLike}
        onOpenProfile={(u) => requestOpenProfile(u)}
        onOpenCommunity={(id) => requestOpenCommunityById({ id })}
        onOpenCommunityBySlug={(slug, name) => requestOpenCommunityBySlug(slug, name)}
      />

      {!!viewingProfile && (
        <ProfileViewModal
          profile={viewingProfile}
          isMe={String(viewingProfile.id) === String(getMyId())}
          onClose={() => setViewingProfile(null)}
          onMessageClick={() => {
            setViewingProfile(null);
            requestOpenDM();
          }}
          onOpenCommunity={(slug, name) => {
            setViewingProfile(null);
            requestOpenCommunityBySlug(slug, name);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  body: { flex: 1 },
});