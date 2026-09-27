import { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useAvatarImage from '../../avatar/hooks/useAvatarImage';
import OnlineStatusDot from '../../../shared/components/OnlineStatusDot';
import RankBadge from '../../../shared/components/RankBadge';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import CommunityAvatar from '../../communities/components/CommunityAvatar';
import { renderWithMentions } from '../../../shared/utils/renderMentions';
import { getProfile, truncate } from '../../../shared/utils/profileHelpers';
import type { FeedPost } from '../../dashboard/hooks/useFeedState';

// WEB -> RN PARITY PASS: pehle FeedList.tsx sirf ek MVP core list tha
// (pfp + username + time + text + like). Ab web ke FeedList.jsx jaisi
// saari feed-card details wapas aa gayi hain: RankBadge/VerifiedBadge/
// EliteBadge, power, "currently in room" chip, community chip
// (showCommunityChip), hashtag chip, @mention/Z(community) rich text
// (truncate + "Show more"), aur post image. Click-through navigation
// (profile/room/community screens abhi RN mein exist nahi karte) optional
// callback props se hai - jab wo screens bane, feed.tsx mein wire kar dena.

const POST_AVATAR_SIZE = 44;

const formatPostTime = (iso?: string): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const PostAvatar = ({
  userId,
  username,
  avatarUrl,
  avatarVersion,
}: {
  userId: string | number;
  username?: string;
  avatarUrl?: string | null;
  avatarVersion?: number | string | null;
}) => {
  const avatarSrc = useAvatarImage(userId, avatarUrl, avatarVersion);
  return (
    <View style={styles.avatarWrap}>
      <View style={styles.avatarCircle}>
        {avatarSrc ? (
          <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarInitial}>{(username || '?').charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <OnlineStatusDot userId={userId} size={12} />
    </View>
  );
};

interface PostCardCallbacks {
  onOpenProfile?: (user: { id: string | number; username?: string }) => void;
  onOpenUserRoom?: (user: { id: string | number; username?: string }, room: any) => void;
  onOpenHashtag?: (hashtag: string) => void;
  onOpenCommunity?: (communityId: string | number) => void;
  onOpenCommunityBySlug?: (slug: string, communityName: string) => void;
}

const PostCard = memo(function PostCard({
  post,
  onToggleLike,
  onOpenPost,
  onOpenProfile,
  onOpenUserRoom,
  onOpenHashtag,
  onOpenCommunity,
  onOpenCommunityBySlug,
  showCommunityChip = true,
}: {
  post: FeedPost;
  onToggleLike: (id: string | number) => void;
  onOpenPost?: (post: FeedPost) => void;
  showCommunityChip?: boolean;
} & PostCardCallbacks) {
  // Backend `/feed/posts` username/rank/badges ko flat `post.username`
  // field mein nahi bhejta - Supabase relation ke through nested
  // `post.players` (object ya array, dono possible) mein aata hai.
  // getProfile() dono shape handle karke ek flat profile object deta hai
  // (web wale profileHelpers.getProfile jaisa hi).
  const profile = getProfile(post as any);
  const currentRoom = (post as any).current_room;
  const community = (post as any).communities;
  const hashtag = (post as any).hashtag as string | undefined;

  return (
    <Pressable style={styles.card} onPress={() => onOpenPost?.(post)}>
      <View style={styles.header}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onOpenProfile?.({ id: post.user_id, username: profile.username });
          }}
        >
          <PostAvatar
            userId={post.user_id}
            username={profile.username}
            avatarUrl={profile.avatar_url}
            avatarVersion={profile.avatar_version}
          />
        </Pressable>
        <View style={styles.headerText}>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>{profile.username || 'Unknown'}</Text>
            {!!profile.is_verified && <VerifiedBadge size="sm" />}
            {!!profile.is_elite && <EliteBadge size="sm" />}
            {!!formatPostTime(post.created_at) && (
              <Text style={styles.time}>· {formatPostTime(post.created_at)}</Text>
            )}
          </View>
          <View style={styles.metaRow}>
            {profile.rank != null && <RankBadge rank={profile.rank} size="sm" />}
            {profile.power != null && (
              <View style={styles.powerChip}>
                <Ionicons name="flash" size={11} color="#facc15" />
                <Text style={styles.powerText}>{profile.power}</Text>
              </View>
            )}
            {!!currentRoom && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onOpenUserRoom?.({ id: post.user_id, username: profile.username }, currentRoom);
                }}
                style={styles.roomChip}
              >
                <Ionicons name="home" size={11} color="#818cf8" />
                <Text style={styles.roomText}>{currentRoom.room_name}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* community_id har post par mandatory hai - global feed mein chip
          dikhati hai ki post kis community se aayi; kisi ek community ke
          apne feed (CommunityDetailScreen) ke andar hide (showCommunityChip
          false) hoti hai, header khud repeat na ho. */}
      {showCommunityChip && !!community && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onOpenCommunity?.((post as any).community_id);
          }}
          style={styles.communityChip}
        >
          <CommunityAvatar
            communityId={(post as any).community_id}
            iconId={community.icon_id}
            iconUrl={community.icon_url}
            size="xs"
          />
          <Text style={styles.communityText}>{community.name}</Text>
        </Pressable>
      )}

      {!!hashtag && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onOpenHashtag?.(hashtag);
          }}
          style={styles.hashtagChip}
        >
          <Text style={styles.hashtagText}>#{hashtag}</Text>
        </Pressable>
      )}

      {!!post.content && (
        <Text style={styles.content}>
          {renderWithMentions(truncate(post.content), null, onOpenCommunityBySlug)}
        </Text>
      )}
      {!!post.content && post.content.length > 180 && (
        <Text style={styles.showMore}>Show more</Text>
      )}

      {!!post.image_url && (
        <Image source={{ uri: post.image_url as string }} style={styles.postImage} />
      )}

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionBtn} onPress={() => onToggleLike(post.id)} hitSlop={8}>
          <Ionicons
            name={post.liked_by_me ? 'heart' : 'heart-outline'}
            size={20}
            color={post.liked_by_me ? '#f87171' : '#a1a1aa'}
          />
          <Text style={styles.actionCount}>{post.likes_count || 0}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => onOpenPost?.(post)} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={19} color="#a1a1aa" />
          <Text style={styles.actionCount}>{post.comments_count || 0}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
});

interface FeedListProps extends PostCardCallbacks {
  posts: FeedPost[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onToggleLike: (id: string | number) => void;
  onOpenPost?: (post: FeedPost) => void;
  // Ek community ke apne feed (CommunityDetailScreen) ke andar false pass
  // karo - us screen ka header hi bata deta hai kis community mein ho.
  showCommunityChip?: boolean;
}

export default function FeedList({
  posts,
  loading,
  loadingMore,
  refreshing,
  onRefresh,
  onLoadMore,
  onToggleLike,
  onOpenPost,
  onOpenProfile,
  onOpenUserRoom,
  onOpenHashtag,
  onOpenCommunity,
  onOpenCommunityBySlug,
  showCommunityChip = true,
}: FeedListProps) {
  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <PostCard
        post={item}
        onToggleLike={onToggleLike}
        onOpenPost={onOpenPost}
        onOpenProfile={onOpenProfile}
        onOpenUserRoom={onOpenUserRoom}
        onOpenHashtag={onOpenHashtag}
        onOpenCommunity={onOpenCommunity}
        onOpenCommunityBySlug={onOpenCommunityBySlug}
        showCommunityChip={showCommunityChip}
      />
    ),
    [
      onToggleLike,
      onOpenPost,
      onOpenProfile,
      onOpenUserRoom,
      onOpenHashtag,
      onOpenCommunity,
      onOpenCommunityBySlug,
      showCommunityChip,
    ]
  );

  if (loading && posts.length === 0) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.emptyText}>No posts yet - be the first to post!</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />
      }
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loadingMore ? <ActivityIndicator color="#ffffff" style={{ marginVertical: 16 }} /> : null
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#71717a', fontSize: 13 },
  card: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatarWrap: { width: POST_AVATAR_SIZE, height: POST_AVATAR_SIZE },
  avatarCircle: {
    width: POST_AVATAR_SIZE,
    height: POST_AVATAR_SIZE,
    borderRadius: POST_AVATAR_SIZE / 2,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  headerText: { flex: 1 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  username: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  time: { color: '#71717a', fontSize: 11 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap' },
  powerChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  powerText: { color: '#facc15', fontSize: 11, fontWeight: '700' },
  roomChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  roomText: { color: '#818cf8', fontSize: 11, fontWeight: '700' },
  communityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  communityText: { color: '#a1a1aa', fontSize: 12, fontWeight: '700' },
  hashtagChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  hashtagText: { color: '#818cf8', fontSize: 12, fontWeight: '700' },
  content: { color: '#e4e4e7', fontSize: 14, lineHeight: 19 },
  showMore: { color: '#818cf8', fontSize: 13, marginTop: 2, marginBottom: 4 },
  postImage: {
    width: '100%',
    height: 260,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#18181b',
  },
  actionsRow: { flexDirection: 'row', gap: 20, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { color: '#a1a1aa', fontSize: 12 },
});