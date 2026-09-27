import { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useAvatarImage from '../../avatar/hooks/useAvatarImage';
import OnlineStatusDot from '../../../shared/components/OnlineStatusDot';
import type { FeedPost } from '../../dashboard/hooks/useFeedState';

// WEB -> RN SCOPE NOTE: capacitor wale FeedList.jsx me community chips,
// post images, RankBadge/VerifiedBadge/EliteBadge, hashtag/mention rich
// text, aur comment-count-tap-to-open-PostDetailModal sab tha. Yeh pehla
// RN version un sabko skip karta hai aur sirf core Instagram-jaisi list
// (pfp + username + time + text + like) deta hai, taaki feed tab turant
// kaam karna shuru ho jaaye. Baaki (images, badges, comments modal) agla
// pass hain - jab chahiye ho batana.

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

const PostAvatar = ({ userId, username }: { userId: string | number; username?: string }) => {
  const avatarSrc = useAvatarImage(userId, null, null);
  return (
    <View style={styles.avatarWrap}>
      <View style={styles.avatarCircle}>
        {avatarSrc ? (
          <Ionicons name="person-circle" size={POST_AVATAR_SIZE} color="#3f3f46" />
        ) : (
          <Text style={styles.avatarInitial}>{(username || '?').charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <OnlineStatusDot userId={userId} size={12} />
    </View>
  );
};

const PostCard = memo(function PostCard({
  post,
  onToggleLike,
  onOpenPost,
}: {
  post: FeedPost;
  onToggleLike: (id: string | number) => void;
  onOpenPost?: (post: FeedPost) => void;
}) {
  return (
    <Pressable style={styles.card} onPress={() => onOpenPost?.(post)}>
      <View style={styles.header}>
        <PostAvatar userId={post.user_id} username={post.username} />
        <View style={styles.headerText}>
          <Text style={styles.username}>{post.username || 'Unknown'}</Text>
          {!!formatPostTime(post.created_at) && (
            <Text style={styles.time}>{formatPostTime(post.created_at)}</Text>
          )}
        </View>
      </View>

      {!!post.content && <Text style={styles.content}>{post.content}</Text>}

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

interface FeedListProps {
  posts: FeedPost[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onToggleLike: (id: string | number) => void;
  onOpenPost?: (post: FeedPost) => void;
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
}: FeedListProps) {
  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <PostCard post={item} onToggleLike={onToggleLike} onOpenPost={onOpenPost} />
    ),
    [onToggleLike, onOpenPost]
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
  avatarInitial: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  headerText: { flex: 1 },
  username: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  time: { color: '#71717a', fontSize: 11, marginTop: 1 },
  content: { color: '#e4e4e7', fontSize: 14, lineHeight: 19, marginBottom: 10 },
  actionsRow: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { color: '#a1a1aa', fontSize: 12 },
});