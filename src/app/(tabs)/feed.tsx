import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
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

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
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
        posts={posts}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refreshFeed}
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
        onClose={() => setShowCreate(false)}
        onSubmit={handleSubmit}
        posting={posting}
        myCommunities={myCommunities}
        communityId={communityId}
        onChangeCommunityId={setCommunityId}
      />

      <PostDetailModal post={liveOpenedPost} onClose={() => setOpenedPost(null)} onToggleLike={handleToggleLike} />

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