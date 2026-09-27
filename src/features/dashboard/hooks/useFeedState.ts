import { useCallback, useRef, useState } from 'react';
import { createPost as createPostApi, getFeedPosts, togglePostLike } from '../../feed/services/feedApi';

const FEED_PAGE_SIZE = 10;

export interface FeedPost {
  id: string | number;
  user_id: string | number;
  // Backend nests username/avatar/rank etc. under `players` (Supabase
  // relation - object ya array, dono possible) - flat `username` field
  // yahan bhejta hi nahi. getProfile() (shared/utils/profileHelpers) se
  // isko flat profile object mein nikalo, seedha post.username mat padho.
  players?: Record<string, any> | Record<string, any>[];
  username?: string;
  content?: string;
  image_url?: string;
  created_at?: string;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
  hashtag?: string;
  community_id?: string | number;
  communities?: { name: string; icon_id?: string | number | null; icon_url?: string | null };
  current_room?: { room_name: string; [key: string]: unknown };
  [key: string]: unknown;
}

// MODULE-LEVEL CACHE: Home tab (dashboard.tsx) is Slot-based (tabs)/_layout
// ke andar hai - kisi doosre tab (Rooms/DM/Profile) par jaate hi Home
// UNMOUNT ho jaata hai, aur wapas aane par REMOUNT (fresh useState([])) -
// isi wajah se pehle har baar Home par wapas aate hi feed refetch/refresh
// ho raha tha. Fix: yeh data ab component ke bahar (module scope) rakha
// hai, isliye remount hone par bhi zinda rehta hai - sirf pehli baar hi
// network call hota hai, uske baad har mount sirf isi cache se hydrate
// hota hai. Sirf explicit pull-to-refresh (refreshFeed) hamesha fresh
// backend hit karta hai aur cache ko update karta hai.
let cache = {
  posts: [] as FeedPost[],
  hasMore: true,
  offset: 0,
  loadedOnce: false,
};

export default function useFeedState() {
  const [posts, setPostsState] = useState<FeedPost[]>(cache.posts);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMoreState] = useState(cache.hasMore);
  const offsetRef = useRef(cache.offset);

  // Har setPosts call ko cache ke saath bhi sync rakho, taaki agli baar
  // component remount ho to yehi latest data mile.
  const setPosts = useCallback((updater: FeedPost[] | ((prev: FeedPost[]) => FeedPost[])) => {
    setPostsState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: FeedPost[]) => FeedPost[])(prev) : updater;
      cache.posts = next;
      return next;
    });
  }, []);

  const setHasMore = useCallback((v: boolean) => {
    cache.hasMore = v;
    setHasMoreState(v);
  }, []);

  // Pehli baar hi network call karo (cache.loadedOnce false ho) - baaki
  // har baar (tab switch se remount) yeh sirf no-op hai, cache se hydrate
  // ho hi chuka hai (initial useState upar).
  const fetchFeed = useCallback(async () => {
    if (cache.loadedOnce) return;
    cache.loadedOnce = true;
    setLoading(true);
    try {
      const res = await getFeedPosts(0, FEED_PAGE_SIZE);
      const list: FeedPost[] = res.data.posts || [];
      setPosts(list);
      offsetRef.current = list.length;
      cache.offset = list.length;
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Feed load error:', err.response?.data || err.message);
      cache.loadedOnce = false; // fail hua to agli baar phir try kare
    } finally {
      setLoading(false);
    }
  }, [setPosts, setHasMore]);

  // Pull-to-refresh - hamesha fresh backend hit, offset 0 se, aur cache
  // ko bhi update karta hai.
  const refreshFeed = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await getFeedPosts(0, FEED_PAGE_SIZE);
      const list: FeedPost[] = res.data.posts || [];
      setPosts(list);
      offsetRef.current = list.length;
      cache.offset = list.length;
      cache.loadedOnce = true;
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Feed refresh error:', err.response?.data || err.message);
    } finally {
      setRefreshing(false);
    }
  }, [setPosts, setHasMore]);

  // Instagram jaisa "scroll down to load more" - FlatList onEndReached se call karo.
  const loadMoreFeed = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await getFeedPosts(offsetRef.current, FEED_PAGE_SIZE);
      const newList: FeedPost[] = res.data.posts || [];
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...newList.filter((p) => !existingIds.has(p.id))];
      });
      offsetRef.current += newList.length;
      cache.offset = offsetRef.current;
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Feed load more error:', err.response?.data || err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, setPosts, setHasMore]);

  // Optimistic toggle - turant UI update, backend fail hua to wapas revert.
  const toggleLike = useCallback(
    async (postId: string | number) => {
      let prevSnapshot: FeedPost[] = [];
      setPosts((prev) => {
        prevSnapshot = prev;
        return prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_me: !p.liked_by_me,
                likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1),
              }
            : p
        );
      });
      try {
        const res = await togglePostLike(postId);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, liked_by_me: !!res.data.liked, likes_count: res.data.likes } : p
          )
        );
      } catch (err: any) {
        console.error('Toggle like error:', err.response?.data || err.message);
        setPosts(prevSnapshot); // revert
      }
    },
    [setPosts]
  );

  // Naya post banane ke baad seedha list ke top par daal do - reload ka
  // wait nahi karna padta (Instagram jaisa optimistic feel).
  const createPost = useCallback(
    async (args: { content: string; communityId: string | number; hashtag?: string | null }) => {
      const res = await createPostApi(args);
      const newPost: FeedPost | undefined = res.data.post;
      if (newPost) {
        setPosts((prev) => [newPost, ...prev]);
        offsetRef.current += 1;
        cache.offset = offsetRef.current;
      }
      return newPost;
    },
    [setPosts]
  );

  // Post delete hone ke baad list se turant hata do (PostDetailModal ka
  // onPostDeleted isi ko call karta hai) - reload ka wait nahi karna padta.
  const removePost = useCallback(
    (postId: string | number) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    },
    [setPosts]
  );

  return {
    posts,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    fetchFeed,
    refreshFeed,
    loadMoreFeed,
    toggleLike,
    createPost,
    removePost,
  };
}