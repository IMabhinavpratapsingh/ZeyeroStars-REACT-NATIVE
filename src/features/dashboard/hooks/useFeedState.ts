import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createPost as createPostApi,
  getFeedPosts,
  togglePostLike,
  uploadPostImage,
  type FeedScope,
} from '../../feed/services/feedApi';
import { compressImage, toUploadFormPart } from '../../../shared/utils/imageCompress';
import { getToken } from '../../../shared/services/NetworkManager';

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
  // Backend bhejega to card ke bottom-right mein "1.8k views" dikhta hai.
  views_count?: number;
  liked_by_me?: boolean;
  hashtag?: string;
  community_id?: string | number;
  communities?: { name: string; icon_id?: string | number | null; icon_url?: string | null };
  current_room?: { room_name: string; [key: string]: unknown };
  [key: string]: unknown;
}

export type { FeedScope };

// MODULE-LEVEL CACHE: Home tab (dashboard.tsx) is Slot-based (tabs)/_layout
// ke andar hai - kisi doosre tab (Rooms/DM/Profile) par jaate hi Home
// UNMOUNT ho jaata hai, aur wapas aane par REMOUNT (fresh useState([])) -
// isi wajah se pehle har baar Home par wapas aate hi feed refetch/refresh
// ho raha tha. Fix: yeh data ab component ke bahar (module scope) rakha
// hai, isliye remount hone par bhi zinda rehta hai - sirf pehli baar hi
// network call hota hai, uske baad har mount sirf isi cache se hydrate
// hota hai. Sirf explicit pull-to-refresh (refreshFeed) hamesha fresh
// backend hit karta hai aur cache ko update karta hai.
//
// FEED SCOPE: Home par "Global" ya "My Communities" (sirf joined
// communities ki posts) - dono ka ALAG cache hai, taaki toggle karne par
// dono taraf ka scroll/offset/hasMore alag rahe. Chuna hua scope
// AsyncStorage me save hota hai (app dobara khulne par wahi feed).
// "joined" chuna ho to global feed fetch hi nahi hoti.
interface ScopeCache {
  posts: FeedPost[];
  hasMore: boolean;
  offset: number;
  loadedOnce: boolean;
}

const newScopeCache = (): ScopeCache => ({ posts: [], hasMore: true, offset: 0, loadedOnce: false });
const SCOPES: FeedScope[] = ['global', 'joined'];

let caches: Record<FeedScope, ScopeCache> = { global: newScopeCache(), joined: newScopeCache() };
// Kis token (user session) ka cache hai. Login / signup / logout par token
// badalta hai - tab purana (khaali ya doosre user ka) cache nahi chalna
// chahiye, warna feed "No posts" par atka rehta tha.
let cacheToken: string | null = null;

let currentScope: FeedScope = 'global';
let userChangedScope = false;
const scopeListeners = new Set<(s: FeedScope) => void>();
const SCOPE_STORAGE_KEY = 'feed_scope_v1';

// Saved scope AsyncStorage se aata hai (async) - fetchFeed isi ka wait karta
// hai, taaki "joined" saved ho to pehle global feed na kheenche.
const scopeReady: Promise<void> = AsyncStorage.getItem(SCOPE_STORAGE_KEY)
  .then((v) => {
    if ((v === 'global' || v === 'joined') && !userChangedScope && v !== currentScope) {
      currentScope = v;
      scopeListeners.forEach((l) => l(v));
    }
  })
  .catch(() => {});

function resetCacheIfSessionChanged() {
  const t = getToken();
  if (cacheToken !== t) {
    caches = { global: newScopeCache(), joined: newScopeCache() };
    cacheToken = t;
  }
}

export default function useFeedState() {
  resetCacheIfSessionChanged();
  const [scope, setScopeState] = useState<FeedScope>(currentScope);
  const [posts, setPostsState] = useState<FeedPost[]>(caches[currentScope].posts);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMoreState] = useState(caches[currentScope].hasMore);

  // Visible state ko CURRENT scope ke cache se sync karo (kisi aur scope ka
  // response late aaye to screen par kuch nahi badalta).
  const showIfCurrent = useCallback((s: FeedScope) => {
    if (s !== currentScope) return;
    const c = caches[s];
    setPostsState(c.posts);
    setHasMoreState(c.hasMore);
  }, []);

  // Scope badla (is ya kisi aur instance se / storage hydrate se) - naye
  // scope ke cache se hydrate karo, purane scope ki loading flags hata do.
  useEffect(() => {
    const listener = (s: FeedScope) => {
      setScopeState(s);
      const c = caches[s];
      setPostsState(c.posts);
      setHasMoreState(c.hasMore);
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    };
    scopeListeners.add(listener);
    if (currentScope !== scope) listener(currentScope);
    return () => {
      scopeListeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poori list replace (fetch / refresh result).
  const commitList = useCallback(
    (s: FeedScope, list: FeedPost[], more: boolean) => {
      caches[s] = { posts: list, hasMore: more, offset: list.length, loadedOnce: true };
      showIfCurrent(s);
    },
    [showIfCurrent]
  );

  // Map/filter type updates (like, delete) - dono scopes ke cache par lagte
  // hain, taaki ek post kisi bhi feed me ho, state consistent rahe.
  const setPosts = useCallback(
    (updater: (prev: FeedPost[]) => FeedPost[]) => {
      SCOPES.forEach((s) => {
        caches[s] = { ...caches[s], posts: updater(caches[s].posts) };
      });
      showIfCurrent(currentScope);
    },
    [showIfCurrent]
  );

  // Pehli baar hi network call karo (scope ka cache loadedOnce na ho) -
  // baaki har baar (tab switch se remount) yeh sirf no-op hai, cache se
  // hydrate ho hi chuka hai.
  const fetchFeed = useCallback(async () => {
    await scopeReady;
    resetCacheIfSessionChanged();
    const s = currentScope;
    setScopeState(s);
    showIfCurrent(s);
    // Cache tabhi use karo jab usme posts hon - khaali cache par dobara fetch.
    if (caches[s].loadedOnce && caches[s].posts.length > 0) return;
    caches[s].loadedOnce = true;
    setLoading(true);
    try {
      const res = await getFeedPosts(0, FEED_PAGE_SIZE, s);
      commitList(s, res.data.posts || [], !!res.data.has_more);
    } catch (err: any) {
      console.error('Feed load error:', err.response?.data || err.message);
      caches[s].loadedOnce = false; // fail hua to agli baar phir try kare
    } finally {
      if (s === currentScope) setLoading(false);
    }
  }, [showIfCurrent, commitList]);

  // Pull-to-refresh - hamesha fresh backend hit, offset 0 se, aur cache
  // ko bhi update karta hai (current scope ka).
  const refreshFeed = useCallback(async () => {
    resetCacheIfSessionChanged();
    const s = currentScope;
    setRefreshing(true);
    try {
      const res = await getFeedPosts(0, FEED_PAGE_SIZE, s);
      commitList(s, res.data.posts || [], !!res.data.has_more);
    } catch (err: any) {
      console.error('Feed refresh error:', err.response?.data || err.message);
    } finally {
      if (s === currentScope) setRefreshing(false);
    }
  }, [commitList]);

  // Instagram jaisa "scroll down to load more" - FlatList onEndReached se call karo.
  const loadMoreFeed = useCallback(async () => {
    const s = currentScope;
    if (loadingMore || loading || !caches[s].hasMore) return;
    setLoadingMore(true);
    try {
      const res = await getFeedPosts(caches[s].offset, FEED_PAGE_SIZE, s);
      const newList: FeedPost[] = res.data.posts || [];
      const cur = caches[s];
      const existingIds = new Set(cur.posts.map((p) => p.id));
      caches[s] = {
        ...cur,
        posts: [...cur.posts, ...newList.filter((p) => !existingIds.has(p.id))],
        offset: cur.offset + newList.length,
        hasMore: !!res.data.has_more,
      };
      showIfCurrent(s);
    } catch (err: any) {
      console.error('Feed load more error:', err.response?.data || err.message);
    } finally {
      if (s === currentScope) setLoadingMore(false);
    }
  }, [loadingMore, loading, showIfCurrent]);

  // Feed ka source badlo (Global <-> My Communities). Naye scope ka cache
  // pehle se bhara ho to turant dikhta hai, warna sirf USI scope ki fetch
  // hoti hai (joined ho to global kabhi nahi aati).
  const setFeedScope = useCallback(
    async (next: FeedScope) => {
      if (next === currentScope) return;
      userChangedScope = true;
      currentScope = next;
      AsyncStorage.setItem(SCOPE_STORAGE_KEY, next).catch(() => {});
      scopeListeners.forEach((l) => l(next));
      await fetchFeed();
    },
    [fetchFeed]
  );

  // Optimistic toggle - turant UI update, backend fail hua to wapas revert.
  const toggleLike = useCallback(
    async (postId: string | number) => {
      const snapshot = { global: caches.global.posts, joined: caches.joined.posts };
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_me: !p.liked_by_me,
                likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1),
              }
            : p
        )
      );
      try {
        const res = await togglePostLike(postId);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, liked_by_me: !!res.data.liked, likes_count: res.data.likes } : p
          )
        );
      } catch (err: any) {
        console.error('Toggle like error:', err.response?.data || err.message);
        caches.global = { ...caches.global, posts: snapshot.global }; // revert
        caches.joined = { ...caches.joined, posts: snapshot.joined };
        showIfCurrent(currentScope);
      }
    },
    [setPosts, showIfCurrent]
  );

  // Naya post banane ke baad current feed ka pehla page dobara fetch hota hai.
  // Dusre scope ka cache invalid kar dete hain (wahan bhi naya post aana
  // chahiye) - agli baar us scope par jaate hi fresh fetch hoga.
  const createPost = useCallback(
    async (args: {
      content: string;
      communityId: string | number;
      hashtag?: string | null;
      imageUri?: string | null; // local file:// uri (expo-image-picker) - pehle upload, phir post
    }) => {
      let imageUrl: string | undefined;
      if (args.imageUri) {
        const compressed = await compressImage(args.imageUri).catch(() => null);
        const part = compressed
          ? toUploadFormPart(compressed)
          : { uri: args.imageUri, name: 'photo.jpg', type: 'image/jpeg' };
        const uploaded = await uploadPostImage(part);
        imageUrl = uploaded.data?.image_url;
      }
      const res = await createPostApi({
        content: args.content,
        communityId: args.communityId,
        hashtag: args.hashtag,
        imageUrl,
      });
      const newPost: FeedPost | undefined = res.data?.post;

      const s = currentScope;
      SCOPES.filter((o) => o !== s).forEach((o) => {
        caches[o].loadedOnce = false;
      });

      // Backend ka `post` (agar aaye bhi) aksar `players` join ke bina hota hai,
      // aur kuch responses mein `post` hota hi nahi - isliye pehle page ko
      // turant dobara fetch karte hain (sahi username/avatar ke saath).
      // Fetch fail ho to fallback: newPost ho to top par daal do.
      try {
        const feedRes = await getFeedPosts(0, FEED_PAGE_SIZE, s);
        let list: FeedPost[] = feedRes.data.posts || [];
        if (newPost && !list.some((p) => p.id === newPost.id)) {
          list = [newPost, ...list];
        }
        commitList(s, list, !!feedRes.data.has_more);
      } catch {
        if (newPost) {
          const cur = caches[s];
          caches[s] = { ...cur, posts: [newPost, ...cur.posts], offset: cur.offset + 1 };
          showIfCurrent(s);
        }
      }
      return newPost;
    },
    [commitList, showIfCurrent]
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
    scope,
    setFeedScope,
    fetchFeed,
    refreshFeed,
    loadMoreFeed,
    toggleLike,
    createPost,
    removePost,
  };
}