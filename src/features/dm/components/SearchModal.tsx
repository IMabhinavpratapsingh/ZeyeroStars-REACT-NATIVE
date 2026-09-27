import React, { memo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';
import { searchCommunities } from '../../communities/services/communitiesApi';
import CommunityCard from '../../communities/components/CommunityCard';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';

const TABS = [
  { id: 'users', label: 'Users' },
  { id: 'communities', label: 'Communities' },
  { id: 'hashtags', label: 'Hashtags' },
] as const;

type SearchTab = (typeof TABS)[number]['id'];

interface SearchUser {
  id: string | number;
  username?: string;
}

interface SearchModalProps {
  show: boolean;
  onChangeSearchTerm: (q: string) => void;
  onSearch: () => void;
  results: SearchUser[];
  onClose: () => void;
  onSelectUser: (user: SearchUser) => void;
  onOpenCommunity?: (community: any) => void;
  onOpenHashtag?: (tag: string) => void;
}

/**
 * Ek hi search bar - upar tabs (Users / Communities / Hashtags). Jo bhi
 * tab active hai usi category mein search hota hai, aur tab badalne par
 * (agar box mein pehle se kuch type ho) turant usi query se naye tab
 * ka search chal jaata hai - dobara type karne ki zaroorat nahi.
 *
 * Users tab Dashboard ke existing search state (onChangeSearchTerm/
 * onSearch/results) use karta hai - jaisa pehle tha. Communities aur
 * Hashtags apna khud ka chhota self-contained fetch karte hain (koi
 * naya Dashboard-wide state nahi chahiye).
 *
 * WEB -> RN CHANGES:
 * - `fixed top-0 inset-x-0` + viewport-height-lock hook -> full-screen
 *   absolute View + KeyboardAvoidingView (RN native keyboard handling ke
 *   liye custom viewport hook ki zaroorat nahi padti).
 * - Gradient search-bar background -> flat star-primary color (LinearGradient
 *   install ho to `expo-linear-gradient` se asli gradient laga sakte ho).
 * - localStorage token -> getToken().
 */
const SearchModal = ({
  show,
  onChangeSearchTerm,
  onSearch,
  results,
  onClose,
  onSelectUser,
  onOpenCommunity,
  onOpenHashtag,
}: SearchModalProps) => {
  const zIndex = useTopZIndex(show);
  const insets = useSafeAreaInsets();
  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  const [tab, setTab] = useState<SearchTab>('users');
  const [query, setQuery] = useState('');

  const [communityResults, setCommunityResults] = useState<any[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);

  const [hashtagResults, setHashtagResults] = useState<{ tag: string; count: number }[]>([]);
  const [hashtagLoading, setHashtagLoading] = useState(false);

  const runCommunitySearch = async (q: string) => {
    if (!q.trim()) {
      setCommunityResults([]);
      return;
    }
    setCommunityLoading(true);
    try {
      const res = await searchCommunities(q, 0, 20);
      setCommunityResults(res.data.communities || []);
    } catch (err: any) {
      console.error('Community search error:', err.response?.data || err.message);
      setCommunityResults([]);
    } finally {
      setCommunityLoading(false);
    }
  };

  const runHashtagSearch = async (q: string) => {
    if (!q.trim()) {
      setHashtagResults([]);
      return;
    }
    setHashtagLoading(true);
    try {
      const token = getToken();
      const res = await axios.get(`${API_BASE}/feed/hashtag/search`, {
        params: { query: q, offset: 0, limit: 30 },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const posts = res.data?.posts || [];
      // Matching posts se unique hashtags nikalo (post-count ke saath) -
      // yahan poori post list dikhane ki zaroorat nahi, tag select karne
      // par dedicated HashtagSearchModal poore posts dikha deta hai.
      const counts: Record<string, number> = {};
      posts.forEach((p: any) => {
        if (!p.hashtag) return;
        counts[p.hashtag] = (counts[p.hashtag] || 0) + 1;
      });
      setHashtagResults(Object.entries(counts).map(([tag, count]) => ({ tag, count })));
    } catch (err: any) {
      console.error('Hashtag search error:', err.response?.data || err.message);
      setHashtagResults([]);
    } finally {
      setHashtagLoading(false);
    }
  };

  const runSearch = (q: string = query, activeTab: SearchTab = tab) => {
    if (activeTab === 'users') {
      onChangeSearchTerm(q);
      onSearch();
    } else if (activeTab === 'communities') {
      runCommunitySearch(q);
    } else {
      runHashtagSearch(q);
    }
  };

  const handleChangeQuery = (value: string) => {
    setQuery(value);
    if (tab === 'users') onChangeSearchTerm(value);
  };

  const handleTabChange = (nextTab: SearchTab) => {
    setTab(nextTab);
    if (query.trim()) runSearch(query, nextTab);
  };

  const placeholder =
    tab === 'users' ? 'Search user...' : tab === 'communities' ? 'Search communities...' : 'Search hashtags...';

  return (
    <SlideInRight
      show={show}
      style={[styles.screen, { zIndex, elevation: 20, paddingTop: insets.top }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.searchRow}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="arrow-back" size={18} color="#ffffff" />
          </Pressable>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.9)" />
            <TextInput
              autoFocus
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor="rgba(255,255,255,0.8)"
              value={query}
              onChangeText={handleChangeQuery}
              onSubmitEditing={() => runSearch()}
              returnKeyType="search"
            />
          </View>
          <Pressable onPress={() => runSearch()}>
            <Text style={styles.searchBtnText}>Search</Text>
          </Pressable>
        </View>

        <View style={styles.tabsRow}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => handleTabChange(t.id)}
              style={[styles.tabBtn, tab === t.id ? styles.tabBtnActive : styles.tabBtnInactive]}
            >
              <Text style={[styles.tabBtnText, tab === t.id ? styles.tabTextActive : styles.tabTextInactive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'users' && (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{query.trim() ? 'No users found.' : 'Search for a username.'}</Text>
            }
            renderItem={({ item }) => (
              <Pressable onPress={() => onSelectUser(item)} style={styles.userRow}>
                <Ionicons name="people-outline" size={14} color="#6e6e6e" />
                <Text style={styles.userRowText}>{item.username}</Text>
              </Pressable>
            )}
          />
        )}

        {tab === 'communities' && (
          <FlatList
            data={communityResults}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.communityListContent}
            ListEmptyComponent={
              communityLoading ? (
                <ActivityIndicator color="#ffffff" style={styles.loadingSpinner} />
              ) : (
                <Text style={styles.emptyText}>{query.trim() ? 'No communities found.' : 'Search for a community.'}</Text>
              )
            }
            renderItem={({ item }) => (
              <CommunityCard community={item} onPress={() => onOpenCommunity?.(item)} />
            )}
          />
        )}

        {tab === 'hashtags' && (
          <FlatList
            data={hashtagResults}
            keyExtractor={(item) => item.tag}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              hashtagLoading ? (
                <Text style={styles.emptyText}>Searching...</Text>
              ) : (
                <Text style={styles.emptyText}>{query.trim() ? 'No hashtags found.' : 'Search for a hashtag.'}</Text>
              )
            }
            renderItem={({ item }) => (
              <Pressable onPress={() => onOpenHashtag?.(item.tag)} style={styles.userRow}>
                <Ionicons name="pricetag-outline" size={14} color="#818cf8" />
                <Text style={styles.hashtagText}>{item.tag}</Text>
                <Text style={styles.hashtagCount}>
                  {item.count} post{item.count === 1 ? '' : 's'}
                </Text>
              </Pressable>
            )}
          />
        )}
      </KeyboardAvoidingView>
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
  flex: { flex: 1 },
  searchRow: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#161616', // star-800
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6d28d9', // approx of the accent->danger->primary gradient midpoint
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 14, padding: 0 },
  searchBtnText: { color: '#818cf8', fontWeight: '600' }, // star-primary-500
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: '#4f46e5' }, // star-primary-600
  tabBtnInactive: { backgroundColor: '#161616' }, // star-800
  tabBtnText: { fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#ffffff' },
  tabTextInactive: { color: '#d4d4d4' }, // star-300
  listContent: { flexGrow: 1 },
  communityListContent: { flexGrow: 1, padding: 16, gap: 12 },
  emptyText: { color: '#6e6e6e', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  loadingSpinner: { marginTop: 24 },
  userRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userRowText: { color: '#ffffff', flex: 1 },
  hashtagText: { color: '#ffffff', flex: 1 },
  hashtagCount: { color: '#6e6e6e', fontSize: 12 },
});

export default memo(SearchModal);