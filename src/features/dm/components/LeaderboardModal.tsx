import React, { memo, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import RankBadge from '../../../shared/components/RankBadge';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';
import useAvatarImage from '../../avatar/hooks/useAvatarImage';
import { createCachedResource } from '../../../shared/services/persistentCache';
import { useCachedResource } from '../../../shared/hooks/useCachedResource';

const SkeletonRow = () => (
  <View style={styles.row}>
    <View style={styles.skeletonRank} />
    <View style={styles.skeletonAvatar} />
    <View style={styles.skeletonLine} />
    <View style={styles.skeletonTail} />
  </View>
);

type LeaderboardTab = 'rank' | 'power' | 'stars';

interface LeaderboardPlayer {
  id: string | number;
  username?: string;
  avatar_url?: string | null;
  avatar_version?: number | string | null;
  rank?: number | null;
  power?: number;
  star_count?: number;
}

/**
 * Ek row alag component me - taaki `.map()` ke andar useAvatarImage
 * (ek Hook) safely call ho sake.
 */
const LeaderboardRow = memo(
  ({
    player,
    rank_position,
    tab,
    onOpenProfile,
  }: {
    player: LeaderboardPlayer;
    rank_position: number;
    tab: LeaderboardTab;
    onOpenProfile?: (p: { id: string | number; username?: string }) => void;
  }) => {
    const avatarSrc = useAvatarImage(player.id, player.avatar_url, player.avatar_version);
    return (
      <Pressable
        onPress={() => onOpenProfile?.({ id: player.id, username: player.username })}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <Text style={styles.rank}>{rank_position}</Text>
        <View style={styles.avatar}>
          {avatarSrc ? (
            <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarFallback}>{(player.username || '?').charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {player.username}
        </Text>
        {tab === 'rank' ? (
          player.rank != null && <RankBadge rank={player.rank} size="sm" />
        ) : tab === 'power' ? (
          <View style={styles.statRow}>
            <Ionicons name="flash-outline" size={13} color="#818cf8" />
            <Text style={styles.powerText}>{player.power ?? 0}</Text>
          </View>
        ) : (
          <View style={styles.statRow}>
            <Ionicons name="star-outline" size={13} color="#facc15" />
            <Text style={styles.starText}>{player.star_count}</Text>
          </View>
        )}
      </Pressable>
    );
  }
);
LeaderboardRow.displayName = 'LeaderboardRow';

// PEHLE: har tab-switch/modal-open par plain axios.get - koi cache hi nahi
// thi (in-memory bhi nahi), app band-khol karne par to bilkul hi khaali se
// shuru. Ab teeno tabs (rank/power/stars alag endpoints hain) ke apne
// AsyncStorage-backed cache (createCachedResource) - app dobara khulte hi
// aakhri dekha hua leaderboard TURANT dikhta hai, background me silently
// revalidate hota hai. Leaderboard live-ish/competitive data hai isliye
// catalogs jitna lamba TTL nahi - 45s - itni der ke andar dobara khola/tab
// switch kiya to network call skip, cached list hi mil jaati hai. Global
// data hai (sab users ke liye same), isliye userScoped NAHI - logout par
// clear karne ki zaroorat nahi.
const LEADERBOARD_TTL_MS = 45_000;
const LEADERBOARD_ENDPOINTS: Record<LeaderboardTab, string> = {
  rank: '/leaderboard/rank',
  power: '/leaderboard/power',
  stars: '/leaderboard/stars',
};

function fetchLeaderboardTab(tab: LeaderboardTab) {
  const token = getToken();
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  return axios.get(`${API_BASE}${LEADERBOARD_ENDPOINTS[tab]}`, config).then((res) => res.data || []);
}

const leaderboardResources = {
  rank: createCachedResource({ key: 'leaderboard_rank', fetchFn: () => fetchLeaderboardTab('rank'), ttlMs: LEADERBOARD_TTL_MS }),
  power: createCachedResource({ key: 'leaderboard_power', fetchFn: () => fetchLeaderboardTab('power'), ttlMs: LEADERBOARD_TTL_MS }),
  stars: createCachedResource({ key: 'leaderboard_stars', fetchFn: () => fetchLeaderboardTab('stars'), ttlMs: LEADERBOARD_TTL_MS }),
};

interface LeaderboardModalProps {
  show: boolean;
  onClose: () => void;
  onOpenProfile?: (p: { id: string | number; username?: string }) => void;
}

const LeaderboardModal = ({ show, onClose, onOpenProfile }: LeaderboardModalProps) => {
  const zIndex = useTopZIndex(show);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<LeaderboardTab>('power'); // power ranking sabse pehle

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  const { data: rankList, loading: rankLoading, refresh: refreshRank } = useCachedResource(leaderboardResources.rank, []);
  const { data: powerList, loading: powerLoading, refresh: refreshPower } = useCachedResource(leaderboardResources.power, []);
  const { data: starList, loading: starLoading, refresh: refreshStar } = useCachedResource(leaderboardResources.stars, []);

  // Modal khulte hi current tab ka data ensure karo (TTL ke andar ho to
  // yeh khud hi network call skip kar dega - purana kaam jaisa hi feel
  // hoga, bas backend baar-baar disturb nahi hota).
  useEffect(() => {
    if (!show) return;
    if (tab === 'rank') refreshRank();
    else if (tab === 'power') refreshPower();
    else refreshStar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, tab]);

  const list = tab === 'rank' ? rankList : tab === 'power' ? powerList : starList;
  const loading = (tab === 'rank' ? rankLoading : tab === 'power' ? powerLoading : starLoading) && list.length === 0;

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
          <Ionicons name="trophy-outline" size={18} color="#ffffff" />
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setTab('power')}
          style={[styles.tabBtn, tab === 'power' ? styles.tabBtnActive : styles.tabBtnInactive]}
        >
          <Ionicons name="flash-outline" size={14} color={tab === 'power' ? '#ffffff' : '#9a9a9a'} />
          <Text style={[styles.tabBtnText, tab === 'power' ? styles.tabTextActive : styles.tabTextInactive]}>
            By Power
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('stars')}
          style={[styles.tabBtn, tab === 'stars' ? styles.tabBtnActive : styles.tabBtnInactive]}
        >
          <Ionicons name="star-outline" size={14} color={tab === 'stars' ? '#ffffff' : '#9a9a9a'} />
          <Text style={[styles.tabBtnText, tab === 'stars' ? styles.tabTextActive : styles.tabTextInactive]}>
            By Stars
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('rank')}
          style={[styles.tabBtn, tab === 'rank' ? styles.tabBtnActive : styles.tabBtnInactive]}
        >
          <Text style={[styles.tabBtnText, tab === 'rank' ? styles.tabTextActive : styles.tabTextInactive]}>
            By Rank
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(player: LeaderboardPlayer) => String(player.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No data found.</Text>}
          renderItem={({ item, index }) => (
            <LeaderboardRow player={item} rank_position={index + 1} tab={tab} onOpenProfile={onOpenProfile} />
          )}
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
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabBtnActive: { backgroundColor: '#4f46e5' }, // star-primary-600
  tabBtnInactive: { backgroundColor: '#161616' }, // star-800
  tabBtnText: { fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#ffffff' },
  tabTextInactive: { color: '#9a9a9a' }, // star-400
  listContent: { padding: 16, gap: 8 },
  emptyText: { color: '#6e6e6e', textAlign: 'center', marginTop: 24 },
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
  rank: { width: 24, textAlign: 'center', fontWeight: '700', color: '#9a9a9a' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { color: '#ffffff', fontWeight: '700' },
  name: { flex: 1, fontWeight: '700', color: '#ffffff' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  powerText: { fontSize: 13, color: '#818cf8', fontWeight: '600' },
  starText: { fontSize: 13, color: '#facc15', fontWeight: '700' }, // star-gold-400
  skeletonRank: { width: 24, height: 16, borderRadius: 4, backgroundColor: '#262626' },
  skeletonAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#262626' },
  skeletonLine: { flex: 1, height: 12, borderRadius: 6, backgroundColor: '#262626' },
  skeletonTail: { width: 64, height: 12, borderRadius: 6, backgroundColor: '#262626' },
});

export default memo(LeaderboardModal);