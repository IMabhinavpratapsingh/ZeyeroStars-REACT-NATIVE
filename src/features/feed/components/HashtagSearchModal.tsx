import React, { memo, useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import FeedList from './FeedList';
import { searchHashtagPosts } from '../services/feedApi';
import type { FeedPost } from '../../dashboard/hooks/useFeedState';

/**
 * Quick Actions drawer ke "Hashtag" tile se khulta hai - #selling,
 * #item-name jaisa ek hashtag search karke saari matching posts dikhata
 * hai. Pagination FeedList ke onLoadMore se hi hoti hai (same widget
 * reuse - list rendering dono jagah identical rahe).
 */

const PAGE_SIZE = 10;

interface HashtagSearchModalProps {
  show: boolean;
  onClose: () => void;
  onToggleLike: (id: string | number) => void;
}

const HashtagSearchModal = ({ show, onClose, onToggleLike }: HashtagSearchModalProps) => {
  const zIndex = useTopZIndex(show);
  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  const [searchTerm, setSearchTerm] = useState('');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const offsetRef = useRef(0);
  const termRef = useRef('');

  const runSearch = useCallback(async () => {
    const term = searchTerm.trim();
    if (!term) return;
    termRef.current = term;
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchHashtagPosts(term, 0, PAGE_SIZE);
      const list: FeedPost[] = res.data.posts || [];
      setPosts(list);
      offsetRef.current = list.length;
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Hashtag search error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading || !termRef.current) return;
    setLoadingMore(true);
    try {
      const res = await searchHashtagPosts(termRef.current, offsetRef.current, PAGE_SIZE);
      const list: FeedPost[] = res.data.posts || [];
      setPosts((prev) => {
        const existing = new Set(prev.map((p) => p.id));
        return [...prev, ...list.filter((p) => !existing.has(p.id))];
      });
      offsetRef.current += list.length;
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Hashtag load more error:', err.response?.data || err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!show) return null;

  return (
    <View style={[styles.overlay, { zIndex, elevation: 20 }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="arrow-back" size={18} color="#ffffff" />
        </Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="pricetag-outline" size={16} color="#818cf8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hashtag e.g. selling"
            placeholderTextColor="#71717a"
            value={searchTerm}
            onChangeText={(v) => setSearchTerm(v.replace(/[^a-zA-Z0-9_]/g, ''))}
            onSubmitEditing={runSearch}
            maxLength={30}
            autoCapitalize="none"
            autoFocus
            returnKeyType="search"
          />
          {!!searchTerm && (
            <Pressable onPress={() => setSearchTerm('')} hitSlop={8}>
              <Ionicons name="close" size={14} color="#71717a" />
            </Pressable>
          )}
        </View>
        <Pressable onPress={runSearch} hitSlop={8}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      {!loading && searched && posts.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>No posts found for #{searchTerm}</Text>
        </View>
      ) : !searched ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>Search a hashtag to find posts, e.g. #selling</Text>
        </View>
      ) : (
        <FeedList
          posts={posts}
          loading={loading}
          loadingMore={loadingMore}
          refreshing={false}
          onRefresh={runSearch}
          onLoadMore={loadMore}
          onToggleLike={onToggleLike}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#18181b',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 13, padding: 0 },
  searchBtnText: { color: '#818cf8', fontWeight: '700', fontSize: 13 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyText: { color: '#71717a', fontSize: 13, textAlign: 'center' },
});

export default memo(HashtagSearchModal);