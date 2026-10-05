import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import FeedList from '../../features/feed/components/FeedList';
import RoomsStrip from '../../features/feed/components/RoomsStrip';
import CreatePostModal, { type PickerCommunity } from '../../features/feed/components/CreatePostModal';
import PostDetailModal from '../../features/feed/components/PostDetailModal';
import HashtagSearchModal from '../../features/feed/components/HashtagSearchModal';
import useFeedState, { type FeedPost } from '../../features/dashboard/hooks/useFeedState';
import { listMyCommunities } from '../../features/communities/services/communitiesApi';
import { showAlert } from '../../shared/utils/alertBus';
import { requestOpenRooms } from '../../shared/utils/navOverlayBus';
import { requestOpenCommunityById, requestOpenCommunityBySlug } from '../../shared/utils/communityOpenBus';
import { requestOpenProfile } from '../../shared/utils/profileOpenBus';
import { setFullscreenOverlayOpen } from '../../shared/utils/fullscreenOverlayBus';
import KebabMenu, { type KebabMenuHandle } from '../../shared/components/KebabMenu';
import { getMyId } from '../../shared/utils/auth';
import { useFeedWallpaper } from '../../features/dm/services/dmWallpaper';
import useMyVerified from '../../features/dm/services/useMyVerified';
import WallpaperCropModal from '../../features/dm/components/WallpaperCropModal';

// WEB -> RN: Dashboard.jsx (web, 4281 lines) ka "Feed" slice yahan aa gaya -
// list + pull-to-refresh + infinite scroll + like, CreatePostModal (naya
// post + community picker + hashtag), PostDetailModal (comments),
// HashtagSearchModal (tag search) aur ab RoomsStrip (feed ke upar active
// rooms) bhi wire ho gaye. RoomsStrip abhi "myRoom" ke bina generic dikhta
// hai - poori tarah wire karne ke liye Dashboard-level useRoomState
// (isPrivileged/beginScreenLoading waghera) chahiye, jo abhi khud stub
// hai. Photo attach abhi bhi agla pass hai.
export default function FeedScreen() {
  const router = useRouter();
  const { posts, loading, loadingMore, refreshing, fetchFeed, refreshFeed, loadMoreFeed, toggleLike, createPost, removePost } =
    useFeedState();

  const [myCommunities, setMyCommunities] = useState<PickerCommunity[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [content, setContent] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [communityId, setCommunityId] = useState<string | number | null>(null);
  const [posting, setPosting] = useState(false);

  const [openedPost, setOpenedPost] = useState<FeedPost | null>(null);
  const [showHashtagSearch, setShowHashtagSearch] = useState(false);

  // Custom Feed wallpaper - sirf is phone me (AsyncStorage), sirf verified users.
  // Tab focus par verified status dobara check hota hai (naya verified hone par lock turant hat jaye).
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  const iAmVerified = useMyVerified(focused);
  const {
    wallpaper,
    pending: wpPending,
    saving: wpSaving,
    startPick: wpStartPick,
    confirmCrop: wpConfirmCrop,
    cancelCrop: wpCancelCrop,
    clear: wpClear,
  } = useFeedWallpaper(getMyId());
  const wpMenuRef = useRef<KebabMenuHandle>(null);
  // Feed screen ka asli size - crop frame isi shape ka banta hai.
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null);

  const handleWallpaperBtn = async () => {
    if (iAmVerified === undefined) {
      showAlert('Checking your account, try again in a moment.', 'info');
      return;
    }
    if (!iAmVerified) {
      showAlert('Custom wallpaper is only for verified users.', 'info');
      return;
    }
    if (wallpaper) {
      wpMenuRef.current?.open(); // Change / Remove
    } else {
      const r = await wpStartPick();
      if (r === 'error') showAlert('Could not open the image.');
    }
  };

  const handleWallpaperChange = async () => {
    const r = await wpStartPick();
    if (r === 'error') showAlert('Could not open the image.');
  };

  const handleWallpaperRemove = async () => {
    await wpClear();
    showAlert('Wallpaper removed.', 'success');
  };

  const handleWallpaperCropConfirm = async (region: { originX: number; originY: number; width: number; height: number }) => {
    const res = await wpConfirmCrop(region);
    if (res.ok) showAlert('Wallpaper updated (saved on this device only).', 'success');
    else if (res.reason === 'too_large') showAlert('Image is too large, try a different one.');
    else showAlert('Could not set wallpaper.');
  };

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const loadMyCommunities = useCallback(async () => {
    try {
      const res = await listMyCommunities();
      setMyCommunities(res.data.communities || res.data || []);
    } catch (err: any) {
      console.error('My communities load error:', err.response?.data || err.message);
    }
  }, []);

  const openCreate = () => {
    setContent('');
    setHashtag('');
    setCommunityId(null);
    loadMyCommunities();
    setShowCreate(true);
  };

  const handleSubmit = async () => {
    if (!content.trim() || !communityId || posting) return;
    setPosting(true);
    try {
      await createPost({ content: content.trim(), communityId, hashtag: hashtag || null });
      setShowCreate(false);
    } catch (err: any) {
      console.error('Create post error:', err.response?.data || err.message);
      showAlert(err.response?.data?.detail || "Couldn't create post, try again.");
    } finally {
      setPosting(false);
    }
  };

  // PostDetailModal me like toggle hone ke baad wapas feed list ke us post
  // ka bhi state sync rahe, isliye yahi shared toggleLike use ho raha hai;
  // openedPost ko bhi naye posts array se refresh kar dete hain.
  const handleToggleLike = (id: string | number) => {
    toggleLike(id);
    setOpenedPost((prev) => (prev && prev.id === id ? { ...prev, liked_by_me: !prev.liked_by_me } : prev));
  };

  const liveOpenedPost = openedPost ? posts.find((p) => p.id === openedPost.id) || openedPost : null;

  useEffect(() => {
    setFullscreenOverlayOpen(!!openedPost);
    return () => setFullscreenOverlayOpen(false);
  }, [openedPost]);

  return (
    <View
      style={styles.screen}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBoxSize((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
      }}
    >
      {/* Wallpaper: sirf tab jab abhi bhi verified ho (verification lapse -> default bg) */}
      {!!wallpaper && iAmVerified !== false && (
        <>
          <ExpoImage source={{ uri: wallpaper }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.wallpaperDim} pointerEvents="none" />
        </>
      )}
      <WallpaperCropModal
        source={wpPending}
        aspect={boxSize ? boxSize.w / boxSize.h : undefined}
        saving={wpSaving}
        onCancel={wpCancelCrop}
        onConfirm={handleWallpaperCropConfirm}
      />
      <View style={styles.topBar}>
        <Pressable onPress={handleWallpaperBtn} hitSlop={8}>
          <Ionicons
            name={iAmVerified === false ? 'lock-closed-outline' : 'image-outline'}
            size={20}
            color="#a1a1aa"
          />
        </Pressable>
        <KebabMenu
          ref={wpMenuRef}
          hideButton
          items={[
            {
              label: 'Change wallpaper',
              icon: <Ionicons name="image-outline" size={16} color="#ffffff" />,
              onClick: handleWallpaperChange,
            },
            {
              label: 'Remove wallpaper',
              icon: <Ionicons name="trash-outline" size={16} color="#ffffff" />,
              onClick: handleWallpaperRemove,
            },
          ]}
        />
        <Pressable onPress={() => setShowHashtagSearch(true)} hitSlop={8}>
          <Ionicons name="pricetag-outline" size={20} color="#a1a1aa" />
        </Pressable>
        <Pressable onPress={openCreate} hitSlop={8} style={styles.createBtn}>
          <Ionicons name="add" size={20} color="#ffffff" />
        </Pressable>
      </View>

      <RoomsStrip
        onOpenRooms={() => requestOpenRooms()}
        onOpenRoomDirect={() => requestOpenRooms()}
      />

      <FeedList
        adEvery={4}
        posts={posts}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refreshFeed}
        onLoadMore={loadMoreFeed}
        onToggleLike={handleToggleLike}
        onOpenPost={setOpenedPost}
        onOpenProfile={(u) => requestOpenProfile(u)}
        onOpenCommunity={(id) => requestOpenCommunityById({ id })}
        onOpenCommunityBySlug={(slug, name) => requestOpenCommunityBySlug(slug, name)}
      />

      <CreatePostModal
        show={showCreate}
        content={content}
        onChangeContent={setContent}
        hashtag={hashtag}
        onChangeHashtag={setHashtag}
        onClose={() => setShowCreate(false)}
        onSubmit={handleSubmit}
        posting={posting}
        myCommunities={myCommunities}
        communityId={communityId}
        onChangeCommunityId={setCommunityId}
      />

      <PostDetailModal
        post={liveOpenedPost}
        onClose={() => setOpenedPost(null)}
        onToggleLike={handleToggleLike}
        onOpenProfile={(u) => requestOpenProfile(u)}
        onOpenCommunity={(id) => requestOpenCommunityById({ id })}
        onOpenCommunityBySlug={(slug, name) => requestOpenCommunityBySlug(slug, name)}
      />

      <HashtagSearchModal
        show={showHashtagSearch}
        onClose={() => setShowHashtagSearch(false)}
        onToggleLike={handleToggleLike}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000', paddingTop: 12 },
  wallpaperDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  createBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});