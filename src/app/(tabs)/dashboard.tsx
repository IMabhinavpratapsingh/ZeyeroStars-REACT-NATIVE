import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import RoomsStrip from '../../features/feed/components/RoomsStrip';
import FeedList from '../../features/feed/components/FeedList';
import CreatePostModal, { type PickerCommunity } from '../../features/feed/components/CreatePostModal';
import PostDetailModal from '../../features/feed/components/PostDetailModal';

import useDashboardBalance from '../../features/dashboard/hooks/useDashboardBalance';
import useFeedState, { type FeedPost } from '../../features/dashboard/hooks/useFeedState';
import useRoomState from '../../features/dashboard/hooks/useRoomState';
import { listMyCommunities } from '../../features/communities/services/communitiesApi';
import type { PickerCommunity as LockedCommunity } from '../../features/feed/components/CreatePostModal';
import { showAlert } from '../../shared/utils/alertBus';
import { requestOpenRooms } from '../../shared/utils/navOverlayBus';

// WEB -> RN: Home ka body (RoomsStrip + FeedList + post modals). Header/
// BottomNav/QuickActionsSheet ab (tabs)/_layout.tsx ke persistent shell
// mein hain (dekho us file ka comment) - yahan sirf feed-specific content
// aur state hai, taaki Rooms/DM/Profile tab par jaate waqt woh gayab na
// hon.
//
// `?compose=1` query param: layout ke QuickActionsSheet ka "Create Post"
// tile is tab par navigate karke yeh param bhejta hai - hum use dekh kar
// CreatePostModal khol dete hain (sheet khud dashboard.tsx ke andar nahi
// hai, isliye direct function-call se nahi khol sakte).
export default function DashboardScreen() {
  const router = useRouter();
  const { compose, lockedCommunityId, lockedCommunityName, lockedCommunityIconId, lockedCommunityIconUrl } =
    useLocalSearchParams<{
      compose?: string;
      lockedCommunityId?: string;
      lockedCommunityName?: string;
      lockedCommunityIconId?: string;
      lockedCommunityIconUrl?: string;
    }>();

  const { fetchBalance } = useDashboardBalance();
  const { posts, loading, loadingMore, refreshing, fetchFeed, refreshFeed, loadMoreFeed, toggleLike, createPost } =
    useFeedState();

  // Home tab ke andar RoomsStrip ke liye chahiye - poora room-floor
  // system (chat/gifting waghera) abhi is Home wiring ka scope nahi hai,
  // isliye no-op stubs (jaisa rooms.tsx tab bhi apna khud ka isPrivileged
  // self-profile-fetch banata hai, filhaal simple false).
  const { myRoom, myRoomLoading, roomsStripRefreshKey, openRoom } = useRoomState({
    isPrivileged: () => false,
    closeOtherNavPanels: () => {},
    beginScreenLoading: () => {},
    endScreenLoading: () => {},
  });

  const [myCommunities, setMyCommunities] = useState<PickerCommunity[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [content, setContent] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [communityId, setCommunityId] = useState<string | number | null>(null);
  const [posting, setPosting] = useState(false);
  // CommunityDetailScreen ke "+ Post" se aaya hua locked community (agar
  // koi hai to picker chhup jaata hai, post seedha isi community me jaati
  // hai) - (tabs)/_layout.tsx CommunityDetailScreen se yahan navigate
  // karte waqt query params me bhejta hai.
  const [lockedCommunity, setLockedCommunity] = useState<LockedCommunity | null>(null);
  const [openedPost, setOpenedPost] = useState<FeedPost | null>(null);
  // Home ke pull-to-refresh par RoomsStrip ko bhi refresh karana hai -
  // useRoomState wala roomsStripRefreshKey sirf real room-events (join/
  // leave/save) par badalta hai, isliye apna khud ka tick jodkar dono ko
  // OR kar dete hain (jo bhi pehle badle, RoomsStrip refetch karega).
  const [roomsPullRefreshTick, setRoomsPullRefreshTick] = useState(0);

  useEffect(() => {
    fetchBalance();
    fetchFeed();
  }, [fetchBalance, fetchFeed]);

  const loadMyCommunities = useCallback(async () => {
    try {
      const res = await listMyCommunities();
      setMyCommunities(res.data.communities || res.data || []);
    } catch (err: any) {
      console.error('My communities load error:', err.response?.data || err.message);
    }
  }, []);

  const openCreate = useCallback(() => {
    setContent('');
    setHashtag('');
    setCommunityId(null);
    loadMyCommunities();
    setShowCreate(true);
  }, [loadMyCommunities]);

  // Layout ke QuickActionsSheet se `?compose=1` aaya - modal kholo aur
  // param clear kar do (warna wapas is tab par aane par dubara khul jaata).
  useEffect(() => {
    if (compose) {
      if (lockedCommunityId) {
        // Locked path: community picker/loadMyCommunities skip karo,
        // seedha is community par post modal kholo.
        setContent('');
        setHashtag('');
        setCommunityId(lockedCommunityId);
        setLockedCommunity({
          id: lockedCommunityId,
          name: lockedCommunityName || '',
          icon_id: lockedCommunityIconId || null,
          icon_url: lockedCommunityIconUrl || null,
        });
        setShowCreate(true);
      } else {
        openCreate();
      }
      router.setParams({
        compose: undefined,
        lockedCommunityId: undefined,
        lockedCommunityName: undefined,
        lockedCommunityIconId: undefined,
        lockedCommunityIconUrl: undefined,
      } as any);
    }
  }, [compose, lockedCommunityId, lockedCommunityName, lockedCommunityIconId, lockedCommunityIconUrl, openCreate, router]);

  const handleSubmit = async () => {
    const targetCommunityId = lockedCommunity?.id || communityId;
    if (!content.trim() || !targetCommunityId || posting) return;
    setPosting(true);
    try {
      await createPost({ content: content.trim(), communityId: targetCommunityId, hashtag: hashtag || null });
      setShowCreate(false);
      setLockedCommunity(null);
    } catch (err: any) {
      console.error('Create post error:', err.response?.data || err.message);
      showAlert(err.response?.data?.detail || "Couldn't create post, try again.");
    } finally {
      setPosting(false);
    }
  };

  const handleToggleLike = (id: string | number) => {
    toggleLike(id);
    setOpenedPost((prev) => (prev && prev.id === id ? { ...prev, liked_by_me: !prev.liked_by_me } : prev));
  };

  const liveOpenedPost = openedPost ? posts.find((p) => p.id === openedPost.id) || openedPost : null;

  return (
    <View style={styles.screen}>
      <RoomsStrip
        myRoom={myRoom}
        myRoomLoading={myRoomLoading}
        onOpenRoom={(room) => openRoom(room as any)}
        onOpenRooms={() => requestOpenRooms()}
        onOpenRoomDirect={(room) => openRoom(room as any)}
        refreshSignal={`${roomsStripRefreshKey}:${roomsPullRefreshTick}`}
      />
      <FeedList
        posts={posts}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={() => {
          refreshFeed();
          setRoomsPullRefreshTick((t) => t + 1);
        }}
        onLoadMore={loadMoreFeed}
        onToggleLike={handleToggleLike}
        onOpenPost={setOpenedPost}
      />

      <CreatePostModal
        show={showCreate}
        content={content}
        onChangeContent={setContent}
        hashtag={hashtag}
        onChangeHashtag={setHashtag}
        onClose={() => {
          setShowCreate(false);
          setLockedCommunity(null);
        }}
        onSubmit={handleSubmit}
        posting={posting}
        lockedCommunity={lockedCommunity}
        myCommunities={myCommunities}
        communityId={communityId}
        onChangeCommunityId={setCommunityId}
      />

      <PostDetailModal post={liveOpenedPost} onClose={() => setOpenedPost(null)} onToggleLike={handleToggleLike} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
});