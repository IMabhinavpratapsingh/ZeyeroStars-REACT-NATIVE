import React, { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../../shared/utils/alertBus';
import { showRulesWarning } from '../../../shared/utils/rulesWarningBus';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';
import CommunityAvatar from './CommunityAvatar';
import CommunityMembersModal from './CommunityMembersModal';
import FeedList from '../../feed/components/FeedList';
import { getCommunity, getCommunityFeed, joinCommunity, leaveCommunity, listCommunityMembers } from '../services/communitiesApi';
import { togglePostLike } from '../../feed/services/feedApi';
import { getMyId } from '../../../shared/utils/auth';

const PAGE_SIZE = 10;

interface CommunityDetailScreenProps {
  show: boolean;
  onClose: () => void;
  communityId: number | string;
  myId?: string | null;
  onOpenCreatePost?: (community: any) => void;
  postedTick?: number;
  deletedPost?: { id?: number | string } | null;
  onMembershipChange?: (community: any, joined: boolean) => void;
}

// NOTE: "Edit community" (gear icon web version) is intentionally left out
// - web's communities/EditCommunityModal.jsx is actually a stray duplicate
// of rooms/EditRoomModal.jsx (edits ROOM icon/background, not the
// community itself) - there's no real community-edit UI to port. Batao
// agar asli "edit community" (name/description/category/icon) screen
// chahiye, wo naya banana padega.
//
// FeedList yahan abhi sirf pass-1 (pfp+username+time+text+like) support
// karta hai - comments/open-post modal poore app mein hi pending hain.
const CommunityDetailScreen = ({
  show,
  onClose,
  communityId,
  myId,
  onOpenCreatePost,
  postedTick,
  deletedPost,
  onMembershipChange,
}: CommunityDetailScreenProps) => {
  const zIndex = useTopZIndex(show);
  const insets = useSafeAreaInsets();
  useBackButtonHandler(show, onClose);

  const [community, setCommunity] = useState<any>(null);
  const [myRole, setMyRole] = useState<'owner' | 'mod' | 'member' | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [joinBusy, setJoinBusy] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [isMember, setIsMember] = useState(false);

  const loadCommunity = async () => {
    try {
      const res = await getCommunity(communityId);
      setCommunity(res.data.community);
    } catch (err: any) {
      console.error('Get community error:', err.response?.data || err.message);
    }
  };

  const loadFeed = async () => {
    setLoading(true);
    try {
      const res = await getCommunityFeed(communityId, 0, PAGE_SIZE);
      setPosts(res.data.posts || []);
      setOffset((res.data.posts || []).length);
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Community feed error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!show || !communityId) return;
    loadCommunity();
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, communityId]);

  useEffect(() => {
    if (show && communityId && postedTick) loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postedTick]);

  useEffect(() => {
    if (!deletedPost || !deletedPost.id) return;
    setPosts((prev) => prev.filter((p) => String(p.id) !== String(deletedPost.id)));
  }, [deletedPost]);

  const loadMore = async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await getCommunityFeed(communityId, offset, PAGE_SIZE);
      const newList = res.data.posts || [];
      setPosts((prev) => [...prev, ...newList]);
      setOffset((prev) => prev + newList.length);
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Community feed load more error:', err.response?.data || err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleLike = async (postId: string | number) => {
    setPosts((prev) =>
      prev.map((p) =>
        String(p.id) === String(postId)
          ? { ...p, liked_by_me: !p.liked_by_me, like_count: (p.like_count || 0) + (p.liked_by_me ? -1 : 1) }
          : p
      )
    );
    try {
      await togglePostLike(postId);
    } catch (err: any) {
      console.error('Toggle like error:', err.response?.data || err.message);
    }
  };

  // Membership/role GET /communities/{id} mein nahi aata - cheapest signal
  // members list scan karke milta hai (Join/Leave + New Post button gate
  // karne ke liye kaafi hai, backend hi asli source-of-truth rehta hai).
  useEffect(() => {
    if (!show || !communityId) return;
    (async () => {
      try {
        let off = 0;
        let found: any = null;
        for (let i = 0; i < 10 && !found; i++) {
          const res = await listCommunityMembers(communityId, off, 100);
          const rows = res.data.members || [];
          found = rows.find((m: any) => m.user_id === (myId || getMyId()));
          if (!res.data.has_more) break;
          off += rows.length;
        }
        setIsMember(!!found);
        setMyRole(found ? found.role : null);
      } catch (err: any) {
        console.error('Membership check error:', err.response?.data || err.message);
      }
    })();
  }, [show, communityId, myId]);

  const handleJoinLeave = async () => {
    if (joinBusy) return;
    setJoinBusy(true);
    try {
      if (isMember) {
        if (myRole === 'owner') {
          showAlert('Transfer ownership or delete the community before leaving.');
          return;
        }
        await leaveCommunity(communityId);
        setIsMember(false);
        setMyRole(null);
        setCommunity((prev: any) => (prev ? { ...prev, member_count: Math.max(0, (prev.member_count || 1) - 1) } : prev));
        onMembershipChange && onMembershipChange(community, false);
      } else {
        const proceed = await showRulesWarning('community');
        if (!proceed) return;
        await joinCommunity(communityId);
        setIsMember(true);
        setMyRole('member');
        setCommunity((prev: any) => (prev ? { ...prev, member_count: (prev.member_count || 0) + 1 } : prev));
        onMembershipChange && onMembershipChange(community, true);
      }
    } catch (err: any) {
      console.error('Join/leave error:', err.response?.data || err.message);
      showAlert(err.response?.data?.detail || "Couldn't update membership, try again.");
    } finally {
      setJoinBusy(false);
    }
  };

  if (!community) {
    return (
      <SlideInRight show={show} bouncy={false} style={[styles.overlay, { zIndex, elevation: zIndex }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </Pressable>
        </View>
      </SlideInRight>
    );
  }

  return (
    <>
      <SlideInRight show={show} bouncy={false} style={[styles.overlay, { zIndex, elevation: zIndex }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {community.name}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <CommunityAvatar communityId={community.id} iconId={community.icon_id} iconUrl={community.icon_url} size="lg" />
          <View style={styles.infoText}>
            {!!community.description && <Text style={styles.description}>{community.description}</Text>}
            <Pressable onPress={() => setShowMembers(true)} style={styles.membersBtn} hitSlop={6}>
              <Ionicons name="people" size={12} color="#9a9a9a" />
              <Text style={styles.membersBtnText}>{community.member_count ?? 0} members</Text>
            </Pressable>
            <Pressable
              onPress={handleJoinLeave}
              disabled={joinBusy}
              style={[styles.joinBtn, isMember ? styles.joinBtnJoined : styles.joinBtnNew, joinBusy && styles.disabledBtn]}
            >
              <Text style={[styles.joinBtnText, !isMember && styles.joinBtnTextNew]}>
                {joinBusy ? '...' : isMember ? (myRole === 'owner' ? 'Owner' : 'Joined') : 'Join'}
              </Text>
            </Pressable>
          </View>
        </View>

        {isMember && (
          <Pressable
            onPress={() =>
              onOpenCreatePost &&
              onOpenCreatePost({ id: community.id, name: community.name, icon_id: community.icon_id, icon_url: community.icon_url })
            }
            style={styles.postBtn}
          >
            <Ionicons name="add" size={16} color="#9a9a9a" />
            <Text style={styles.postBtnText}>Post in {community.name}</Text>
          </Pressable>
        )}

        <FeedList
          posts={posts}
          loading={loading}
          loadingMore={loadingMore}
          refreshing={false}
          onRefresh={loadFeed}
          onLoadMore={loadMore}
          onToggleLike={handleToggleLike}
          showCommunityChip={false}
        />
      </SlideInRight>

      <CommunityMembersModal
        show={showMembers}
        onClose={() => setShowMembers(false)}
        communityId={communityId}
        myRole={myRole}
        onMemberChanged={loadCommunity}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  headerTitle: { flex: 1, fontWeight: '700', fontSize: 17, color: '#fff' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  infoText: { flex: 1, minWidth: 0 },
  description: { color: '#c2c2c2', fontSize: 13, marginBottom: 8 },
  membersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  membersBtnText: { color: '#9a9a9a', fontSize: 11 },
  joinBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
  joinBtnJoined: { backgroundColor: '#2a2a2a' },
  joinBtnNew: { backgroundColor: '#f2a65a' },
  disabledBtn: { opacity: 0.5 },
  joinBtnText: { fontSize: 11, fontWeight: '700', color: '#c2c2c2' },
  joinBtnTextNew: { color: '#fff' },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  postBtnText: { color: '#9a9a9a', fontSize: 13 },
});

export default memo(CommunityDetailScreen);