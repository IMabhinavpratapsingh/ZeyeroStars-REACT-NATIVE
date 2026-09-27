import { useCallback, useRef, useState } from 'react';
import { createPost as createPostApi, getFeedPosts, togglePostLike } from '../../feed/services/feedApi';

const FEED_PAGE_SIZE = 10;

export interface FeedPost {
  id: string | number;
  user_id: string | number;
  username?: string;
  content?: string;
  created_at?: string;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
  [key: string]: unknown;
}

// WEB -> RN NOTE: Dashboard.jsx (web) ka feed slice `feedResource`
// (persistentCache-backed, localStorage se seeded) use karta tha taaki
// app reopen hote hi purana feed turant dikhe. Yahan pehla version simpler
// rakha hai - seedha fetch, koi disk-persisted snapshot nahi. Agar aage
// "app khulte hi turant purana feed dikhe" chahiye to persistentCache.ts
// (already shared/services mein migrated) ke through yahan bhi wire kar
// denge - abhi ke liye MVP hai.
export default function useFeedState() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFeedPosts(0, FEED_PAGE_SIZE);
      const list: FeedPost[] = res.data.posts || [];
      setPosts(list);
      offsetRef.current = list.length;
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Feed load error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Pull-to-refresh - hamesha fresh backend hit, offset 0 se.
  const refreshFeed = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await getFeedPosts(0, FEED_PAGE_SIZE);
      const list: FeedPost[] = res.data.posts || [];
      setPosts(list);
      offsetRef.current = list.length;
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Feed refresh error:', err.response?.data || err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

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
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Feed load more error:', err.response?.data || err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading]);

  // Optimistic toggle - turant UI update, backend fail hua to wapas revert.
  const toggleLike = useCallback(async (postId: string | number) => {
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
  }, []);

  // Naya post banane ke baad seedha list ke top par daal do - reload ka
  // wait nahi karna padta (Instagram jaisa optimistic feel).
  const createPost = useCallback(
    async (args: { content: string; communityId: string | number; hashtag?: string | null }) => {
      const res = await createPostApi(args);
      const newPost: FeedPost | undefined = res.data.post;
      if (newPost) {
        setPosts((prev) => [newPost, ...prev]);
        offsetRef.current += 1;
      }
      return newPost;
    },
    []
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
  };
}