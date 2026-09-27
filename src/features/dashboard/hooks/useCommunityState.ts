import { useCallback, useState } from 'react';

// WEB -> RN: Dashboard.jsx ke "=== Communities ===" state block ka port
// (showCommunities/openCommunity/communitiesInitialTab/postedTick/
// deletedPost/myCommunities waghera) - list/detail screens khud
// self-contained hain (apna fetch/pagination karte hain), yeh hook sirf
// unhe kholne/band karne aur ek se doosre me navigate karne ka wiring hai
// taaki persistent (tabs)/_layout.tsx se (BottomNav ke Communities icon,
// SearchModal ke community result, feed/notification community-mentions
// waghera) sab ek hi jagah se control ho sakein.

export interface CommunityLite {
  id: number | string;
  name?: string;
  icon_id?: string | number | null;
  icon_url?: string | null;
  [key: string]: any;
}

export default function useCommunityState() {
  const [showCommunities, setShowCommunities] = useState(false);
  const [communitiesInitialTab, setCommunitiesInitialTab] = useState<'all' | 'mine'>('all');
  const [openCommunity, setOpenCommunity] = useState<CommunityLite | null>(null);

  // CommunityDetailScreen ke andar "+ Post" se create-post modal locked
  // community ke saath khulta hai - dashboard tab is value ko dekh kar
  // CreatePostModal ko us community par pre-select kar deta hai.
  const [createPostLockedCommunity, setCreatePostLockedCommunity] = useState<CommunityLite | null>(null);

  // Community-scoped post create hone ke baad CommunityDetailScreen ka
  // FeedList refetch karane ke liye tick, aur delete hone par turant
  // list se hata dene ke liye deletedPost.
  const [postedTick, setPostedTick] = useState(0);
  const [deletedPost, setDeletedPost] = useState<{ id?: number | string } | null>(null);

  const openCommunitiesList = useCallback((tab: 'all' | 'mine' = 'all') => {
    setCommunitiesInitialTab(tab);
    setShowCommunities(true);
  }, []);

  const openCommunityById = useCallback((community: CommunityLite) => {
    setOpenCommunity(community);
  }, []);

  const closeCommunities = useCallback(() => {
    setShowCommunities(false);
  }, []);

  const closeCommunityDetail = useCallback(() => {
    setOpenCommunity(null);
  }, []);

  // Home/Rooms/DM tab par navigate karte waqt (BUG FIX jaisa web me tha)
  // in dono ko force-close karne ke liye.
  const closeAllCommunityPanels = useCallback(() => {
    setShowCommunities(false);
    setOpenCommunity(null);
  }, []);

  const requestCreatePost = useCallback((community: CommunityLite) => {
    setCreatePostLockedCommunity(community);
  }, []);

  const clearCreatePostLock = useCallback(() => {
    setCreatePostLockedCommunity(null);
  }, []);

  const notifyPostCreated = useCallback(() => {
    setPostedTick((t) => t + 1);
  }, []);

  const notifyPostDeleted = useCallback((id: number | string) => {
    setDeletedPost({ id });
  }, []);

  return {
    showCommunities,
    communitiesInitialTab,
    openCommunity,
    createPostLockedCommunity,
    postedTick,
    deletedPost,
    openCommunitiesList,
    openCommunityById,
    closeCommunities,
    closeCommunityDetail,
    closeAllCommunityPanels,
    requestCreatePost,
    clearCreatePostLock,
    notifyPostCreated,
    notifyPostDeleted,
  };
}