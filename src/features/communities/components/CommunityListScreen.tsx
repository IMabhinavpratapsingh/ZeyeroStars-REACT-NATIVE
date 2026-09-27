import React, { memo, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';
import CommunityCard from './CommunityCard';
import CreateCommunityModal from './CreateCommunityModal';
import {
  listCommunities,
  searchCommunities,
  communitiesResource,
  myCommunitiesResource,
} from '../services/communitiesApi';

const PAGE_SIZE = 20;

interface CommunityListScreenProps {
  show: boolean;
  onClose: () => void;
  onOpenCommunity: (community: any) => void;
  initialTab?: 'all' | 'mine';
}

// Self-contained: apna list/search pages khud fetch karta hai. Do tabs -
// "All" (discover/search, paginated) aur "My Communities" (sirf joined
// wali, /communities/mine se seedha, koi pagination/search nahi).
const CommunityListScreen = ({ show, onClose, onOpenCommunity, initialTab = 'all' }: CommunityListScreenProps) => {
  const zIndex = useTopZIndex(show);
  useBackButtonHandler(show, onClose);

  const [tab, setTab] = useState<'all' | 'mine'>(initialTab);

  const [communities, setCommunities] = useState<any[]>(() => communitiesResource.getSnapshot()?.list || []);
  const [loading, setLoading] = useState(() => communitiesResource.getSnapshot() == null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => communitiesResource.getSnapshot()?.hasMore || false);
  const [offset, setOffset] = useState(() => communitiesResource.getSnapshot()?.list?.length || 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const [myList, setMyList] = useState<any[]>(() => myCommunitiesResource.getSnapshot()?.list || []);
  const [myLoading, setMyLoading] = useState(false);

  const fetchPage = (query: string, off: number) =>
    query ? searchCommunities(query, off, PAGE_SIZE) : listCommunities(off, PAGE_SIZE);

  const loadFirstPage = async (query: string) => {
    if (!query) {
      const cached = communitiesResource.getSnapshot();
      if (cached) {
        setCommunities(cached.list);
        setHasMore(cached.hasMore);
        setOffset(cached.list.length);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const data = await communitiesResource.fetchAndApply();
        if (data) {
          setCommunities(data.list);
          setHasMore(data.hasMore);
          setOffset(data.list.length);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await fetchPage(query, 0);
      setCommunities(res.data.communities || []);
      setHasMore(!!res.data.has_more);
      setOffset((res.data.communities || []).length);
    } catch (err: any) {
      console.error('Communities load error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  // "Mine" tab har baar khulne par force-refresh - cache se pehle purana
  // data dikha dete hain (khaali list flash na ho), revalidate background me.
  const loadMyCommunities = async () => {
    if (myLoading) return;
    const cached = myCommunitiesResource.getSnapshot();
    if (cached) {
      setMyList(cached.list);
    } else {
      setMyLoading(true);
    }
    try {
      const data = await myCommunitiesResource.fetchAndApply(true);
      if (data) setMyList(data.list);
    } catch (err: any) {
      console.error('My communities load error:', err.response?.data || err.message);
    } finally {
      setMyLoading(false);
    }
  };

  useEffect(() => {
    if (!show) return;
    setTab(initialTab);
    setSearchTerm('');
    setActiveQuery('');
    loadFirstPage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  useEffect(() => {
    if (!show || tab !== 'mine') return;
    loadMyCommunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, tab]);

  const runSearch = () => {
    setActiveQuery(searchTerm);
    loadFirstPage(searchTerm);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setActiveQuery('');
    loadFirstPage('');
  };

  const loadMore = async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(activeQuery, offset);
      const newList = res.data.communities || [];
      setCommunities((prev) => [...prev, ...newList]);
      setOffset((prev: any) => prev + newList.length);
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Communities load more error:', err.response?.data || err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const activeData = tab === 'all' ? communities : myList;
  const activeLoading = tab === 'all' ? loading : myLoading;
  const emptyText =
    tab === 'all'
      ? activeQuery
        ? `No communities found for "${activeQuery}"`
        : 'No communities yet - be the first to create one.'
      : "You haven't joined any community yet.";

  return (
    <>
      <SlideInRight show={show} style={[styles.overlay, { zIndex, elevation: zIndex }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </Pressable>
          {tab === 'all' ? (
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#f2a65a" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search communities"
                placeholderTextColor="#6b6b6b"
                value={searchTerm}
                onChangeText={setSearchTerm}
                onSubmitEditing={runSearch}
                maxLength={50}
              />
              {!!searchTerm && (
                <Pressable onPress={clearSearch} hitSlop={8}>
                  <Ionicons name="close" size={14} color="#6b6b6b" />
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={styles.headerTitle}>Communities</Text>
          )}
          <Pressable onPress={() => setShowCreate(true)} style={styles.createBtn}>
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.tabsRow}>
          <Pressable onPress={() => setTab('all')} style={[styles.tabBtn, tab === 'all' && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === 'all' && styles.tabBtnTextActive]}>All</Text>
          </Pressable>
          <Pressable onPress={() => setTab('mine')} style={[styles.tabBtn, tab === 'mine' && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === 'mine' && styles.tabBtnTextActive]}>My Communities</Text>
          </Pressable>
        </View>

        {activeLoading ? (
          <View style={styles.grid}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.skeletonCard} />
            ))}
          </View>
        ) : activeData.length === 0 ? (
          <Text style={styles.emptyText}>{emptyText}</Text>
        ) : (
          <FlatList
            key={tab}
            data={activeData}
            keyExtractor={(c) => String(c.id)}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            onEndReachedThreshold={0.4}
            onEndReached={tab === 'all' ? loadMore : undefined}
            renderItem={({ item: c }) => (
              <View style={styles.cardWrap}>
                <CommunityCard community={c} onPress={() => onOpenCommunity(c)} />
              </View>
            )}
            ListFooterComponent={
              tab === 'all' && !hasMore && communities.length > 0 ? (
                <Text style={styles.footerText}>No more communities</Text>
              ) : loadingMore ? (
                <View style={styles.skeletonCard} />
              ) : null
            }
          />
        )}
      </SlideInRight>

      <CreateCommunityModal
        show={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(community: any) => {
          setShowCreate(false);
          setCommunities((prev) => [community, ...prev]);
          setMyList((prev) => (prev.some((mc) => mc.id === community.id) ? prev : [community, ...prev]));
          onOpenCommunity(community);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17, color: '#fff' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161616',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, color: '#fff', padding: 0 },
  createBtn: { backgroundColor: '#f2a65a', padding: 8, borderRadius: 10 },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, backgroundColor: '#161616' },
  tabBtnActive: { backgroundColor: '#f2a65a' },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: '#9a9a9a' },
  tabBtnTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  listContent: { padding: 16 },
  row: { gap: 12, marginBottom: 12 },
  cardWrap: { flex: 1 },
  skeletonCard: { flex: 1, aspectRatio: 3 / 4, backgroundColor: '#161616', borderRadius: 12, borderWidth: 2, borderColor: '#2a2a2a' },
  emptyText: { color: '#6b6b6b', textAlign: 'center', marginTop: 24 },
  footerText: { color: '#3a3a3a', textAlign: 'center', fontSize: 11, paddingVertical: 8 },
});

export default memo(CommunityListScreen);