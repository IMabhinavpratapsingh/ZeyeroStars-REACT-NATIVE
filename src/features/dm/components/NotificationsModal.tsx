import React, { memo, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';

/**
 * WEB -> RN CHANGES:
 * - `overflow-y-auto` + onScroll bottom-check -> FlatList + onEndReached
 *   (isi threshold jitna hi feel dene ke liye onEndReachedThreshold=0.4).
 * - `fixed inset-0` -> full-screen absolute (screen) View + insets padding.
 * - CSS `animate-pulse` skeleton -> plain static skeleton rows (RN mein
 *   pulse ke liye Animated/Reanimated chahiye hoga - abhi simple rakha).
 * - localStorage token -> getToken().
 * - Android hardware back = close.
 */
const SkeletonRow = () => (
  <View style={styles.row}>
    <View style={styles.skeletonAvatar} />
    <View style={styles.skeletonLine} />
  </View>
);

const timeAgo = (iso: string): string => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
};

// Instagram jaisa hi grouping text: "X liked" / "X and Y liked" /
// "X and Y and N more liked"
const likeText = (likers: string[], total: number): string => {
  if (total <= 1) return `${likers[0]} liked your post`;
  if (total === 2) return `${likers[0]} and ${likers[1]} liked your post`;
  return `${likers[0]} and ${likers[1]} and ${total - 2} more liked your post`;
};

const ICON: Record<string, string> = {
  like: 'heart-outline',
  comment: 'chatbubble-ellipses-outline',
  post_mention: 'create-outline',
  comment_mention: 'chatbubble-ellipses-outline',
  star: 'star-outline',
  community_join: 'people-outline',
};

const notifText = (item: any): string => {
  switch (item.type) {
    case 'like':
      return likeText(item.likers, item.total_likers);
    case 'comment':
      return `${item.username} commented on your post: "${item.content}"`;
    case 'post_mention':
      return `${item.username} mentioned you in a post`;
    case 'comment_mention':
      return `${item.username} mentioned you in a comment`;
    case 'star':
      return `${item.username} starred you`;
    case 'community_join':
      return `${item.username} joined ${item.community_name || 'your community'}`;
    default:
      return '';
  }
};

const NOTIFICATIONS_PAGE_SIZE = 30;

interface NotificationsModalProps {
  show: boolean;
  onClose: () => void;
  onOpenPost?: (postId: string | number) => void;
  onOpenProfile?: (profile: { id: string | number; username?: string }) => void;
  onOpenCommunity?: (community: { id: string | number; name?: string }) => void;
}

const NotificationsModal = ({ show, onClose, onOpenPost, onOpenProfile, onOpenCommunity }: NotificationsModalProps) => {
  const zIndex = useTopZIndex(show);
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  useEffect(() => {
    if (!show) return;

    const token = getToken();
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    // Panel khulte hi "seen" mark kar do taaki header ka unread dot hat jaye
    axios.post(`${API_BASE}/notifications/mark_seen`, {}, config).catch(() => {});

    if (loaded) return; // ek baar load ho chuka to dobara fetch nahi

    setLoading(true);
    axios
      .get(`${API_BASE}/notifications`, { ...config, params: { offset: 0, limit: NOTIFICATIONS_PAGE_SIZE } })
      .then((res) => {
        const list = res.data?.items || [];
        setItems(list);
        setOffset(list.length);
        setHasMore(!!res.data?.has_more);
        setLoaded(true);
      })
      .catch((err: any) => console.error('Notifications fetch error:', err.response?.data || err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Purane notifications (30+) neeche scroll karne par load hote hain -
  // Inbox modal jaisa hi "scroll near bottom -> load more" pattern.
  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const token = getToken();
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    axios
      .get(`${API_BASE}/notifications`, { ...config, params: { offset, limit: NOTIFICATIONS_PAGE_SIZE } })
      .then((res) => {
        const newItems = res.data?.items || [];
        setItems((prev) => [...prev, ...newItems]);
        setOffset((prev) => prev + newItems.length);
        setHasMore(!!res.data?.has_more);
      })
      .catch((err: any) => console.error('Notifications load more error:', err.response?.data || err.message))
      .finally(() => setLoadingMore(false));
  };

  const handleTap = (item: any) => {
    if (item.type === 'star') {
      onOpenProfile?.({ id: item.actor_id, username: item.username });
      return;
    }
    if (item.type === 'community_join') {
      onOpenCommunity?.({ id: item.community_id, name: item.community_name });
      return;
    }
    if (item.post_id) {
      onOpenPost?.(item.post_id);
    }
  };

  return (
    <SlideInRight
      show={show}
      style={[
        styles.screen,
        { zIndex, elevation: 20, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={16} color="#ffffff" />
          <Text style={styles.headerBtnText}>Close</Text>
        </Pressable>
        <View style={styles.headerTitleRow}>
          <Ionicons name="notifications-outline" size={18} color="#ffffff" />
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => `${item.type}-${item.post_id || item.comment_id || item.username}-${i}`}
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<Text style={styles.emptyText}>No activity yet.</Text>}
          ListFooterComponent={loadingMore ? <SkeletonRow /> : null}
          renderItem={({ item, index }) => {
            const iconName = ICON[item.type] || 'notifications-outline';
            return (
              <Pressable
                onPress={() => handleTap(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Ionicons name={iconName as any} size={20} color="#ffffff" />
                <Text style={styles.rowText} numberOfLines={3}>
                  {notifText(item)}
                </Text>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </SlideInRight>
  );
};

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0a', // star-900
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#161616', // star-800
  },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtnText: { color: '#ffffff', fontSize: 14 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  headerSpacer: { width: 40 },
  listContent: { padding: 16, gap: 8 },
  emptyText: { color: '#6e6e6e', textAlign: 'center', marginTop: 24 }, // star-500
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161616', // star-800
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#262626', // star-700
    marginBottom: 8,
  },
  rowPressed: { backgroundColor: '#262626' },
  rowText: { flex: 1, fontSize: 14, color: '#ffffff' },
  time: { fontSize: 12, color: '#6e6e6e', flexShrink: 0 },
  skeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#262626',
  },
  skeletonLine: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#262626',
  },
});

export default memo(NotificationsModal);