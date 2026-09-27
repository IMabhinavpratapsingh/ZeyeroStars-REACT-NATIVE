import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import useRankRewards from '../hooks/useRankRewards';
import useItemsCatalog from '../hooks/useItemsCatalog';
import useBackButtonHandler from '../hooks/useBackButtonHandler';
import useStableCallback from '../hooks/useStableCallback';
import useTopZIndex from '../hooks/useTopZIndex';
import AvatarItemThumb from '../../features/avatar/components/AvatarItemThumb';
import RankBadge from './RankBadge';
import { getAssetUrl } from '../../features/avatar/utils/avatarAssets';
import { getRankStyle } from '../utils/rankStyles';

/**
 * Full-screen "page-like" UI (BattlePage jaisa - koi route change nahi,
 * sirf `show` prop se control). Vertical chain: har milestone ek BADA
 * circle (rank number), circles ko line jodti hai, dayein taraf reward box.
 * Line ka segment gold hai agar neeche wala (aasan) milestone unlock ho chuka hai.
 *
 * WEB -> RN CHANGES:
 * - `fixed inset-0 z-[150]` -> in-tree absoluteFill + useTopZIndex (parent
 *   full-screen View ho).
 * - `translateY(-50%)` RN mein % nahi chalta -> reward box ki fixed height
 *   (BOX_H) se top = center - BOX_H/2.
 * - `scrollRef.scrollTop` + requestAnimationFrame -> ScrollView.scrollTo
 *   (viewport height `onLayout` se milti hai).
 * - Top bar mein safe-area top inset add kiya.
 * - Tailwind gradients -> expo-linear-gradient.
 */
const NODE = 64; // rank-number circle ka diameter
const ROW_H = 132; // do consecutive milestones ke centers ke beech ki distance
const TOP_PAD = 60; // topmost node se upar extra line
const LINE_X = NODE / 2;
const BOX_H = 64; // reward box ki height

interface RankRewardsScreenProps {
  show: boolean;
  onClose: () => void;
  balance?: { coins: number; z_money: number };
  onBalanceUpdate?: (newBalance: { coins: number; z_money: number }) => void;
}

const RankRewardsScreen = ({
  show,
  onClose,
  balance = { coins: 0, z_money: 0 },
  onBalanceUpdate,
}: RankRewardsScreenProps) => {
  const insets = useSafeAreaInsets();
  const zIndex = useTopZIndex(show);
  const { userRank, claimedRewardIds, rankRewards, loading, fetchRankRewardsList, claimRankReward } =
    useRankRewards();
  const { itemsById } = useItemsCatalog();
  const [claimingId, setClaimingId] = useState<number | string | null>(null);
  const [toast, setToast] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [viewportH, setViewportH] = useState(0);
  const didAutoScroll = useRef(false);

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  useEffect(() => {
    if (show) fetchRankRewardsList();
    else didAutoScroll.current = false;
  }, [show, fetchRankRewardsList]);

  const handleClaim = useCallback(
    async (reward: any) => {
      if (claimingId) return;
      setClaimingId(reward.id);
      setToast('');
      try {
        const res = await claimRankReward(reward.id);
        if (res.status) {
          if (res.category === 'coins' && typeof res.new_coin_balance === 'number' && onBalanceUpdate) {
            onBalanceUpdate({ ...balance, coins: res.new_coin_balance });
          }
          setToast(res.category === 'coins' ? `+${res.quantity} coins earned!` : 'Reward claimed!');
          await fetchRankRewardsList();
        } else {
          setToast(res.message || "Can't claim right now");
        }
      } catch (err: any) {
        setToast(err?.response?.data?.detail || 'Claim failed');
      } finally {
        setClaimingId(null);
      }
    },
    [claimingId, claimRankReward, fetchRankRewardsList, onBalanceUpdate, balance]
  );

  // Highest rank sabse upar, lowest sabse neeche - climb-up jaisi chain.
  const sortedRewardsDesc = useMemo(
    () => [...rankRewards].sort((a: any, b: any) => b.rank - a.rank),
    [rankRewards]
  );
  const n = sortedRewardsDesc.length;
  const trackHeight = TOP_PAD + Math.max(n - 1, 0) * ROW_H + NODE + 20;

  const nodeTop = (i: number) => TOP_PAD + i * ROW_H;
  const nodeCenter = (i: number) => nodeTop(i) + NODE / 2;

  // Page khulte hi player ke sabse paas wale milestone par auto-scroll (ek baar).
  useEffect(() => {
    if (!show || n === 0 || viewportH === 0 || didAutoScroll.current) return;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      if (sortedRewardsDesc[i].rank <= userRank) {
        idx = i;
        break;
      }
      idx = i;
    }
    didAutoScroll.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, nodeCenter(idx) - viewportH / 2), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, n, viewportH, userRank]);

  if (!show) return null;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 220 }}
      style={[styles.root, { zIndex, elevation: 20 }]}
    >
      <LinearGradient colors={['#0b0b12', '#141420', '#000000']} style={StyleSheet.absoluteFill} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onClose} accessibilityLabel="Back" style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#d4d4d8" />
        </Pressable>
        <View style={styles.topTitleRow}>
          <Ionicons name="ribbon-outline" size={14} color="#fde047" />
          <Text style={styles.topTitle}>RANK REWARDS</Text>
        </View>
      </View>

      {!!toast && (
        <View style={styles.toastRow}>
          <Ionicons name="sparkles-outline" size={16} color="#fcd34d" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <View style={styles.rankRow}>
        <Text style={styles.rankLabel}>Your rank: </Text>
        <RankBadge rank={userRank} size="sm" />
      </View>

      {loading && n === 0 ? (
        <Text style={styles.muted}>Loading...</Text>
      ) : n === 0 ? (
        <Text style={styles.muted}>No rank rewards available yet.</Text>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 + insets.bottom }}
          onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ height: trackHeight }}>
            {/* Topmost node se upar wala stub - hamesha grey */}
            <View style={[styles.lineGrey, { left: LINE_X - 2, top: 0, height: TOP_PAD + NODE / 2 }]} />

            {sortedRewardsDesc.map((reward: any, i: number) => {
              const isClaimed = claimedRewardIds.includes(reward.id);
              const isUnlocked = userRank >= reward.rank;
              const isCoins = reward.category === 'coins';
              const item: any = !isCoins ? (itemsById as any)?.[reward.item_id] : null;
              const iconUrl = item ? getAssetUrl(item.item_category, reward.item_id) : null;
              const top = nodeTop(i);
              const center = nodeCenter(i);
              const rankStyle = getRankStyle(reward.rank);

              const hasNext = i < n - 1;
              const nextUnlocked = hasNext && userRank >= sortedRewardsDesc[i + 1].rank;

              return (
                <View key={reward.id}>
                  {/* Is node se agle (neeche/aasan) node tak line-segment */}
                  {hasNext &&
                    (nextUnlocked ? (
                      <LinearGradient
                        colors={['#eab308', '#fbbf24']}
                        style={[styles.line, { left: LINE_X - 2, top: center, height: ROW_H }]}
                      />
                    ) : (
                      <View style={[styles.lineGrey, { left: LINE_X - 2, top: center, height: ROW_H }]} />
                    ))}

                  {/* Rank-number circle + tier-name */}
                  <View style={[styles.nodeCol, { top, width: NODE }]}>
                    <View
                      style={[
                        styles.node,
                        isClaimed
                          ? styles.nodeClaimed
                          : isUnlocked
                          ? styles.nodeUnlocked
                          : styles.nodeLocked,
                      ]}
                    >
                      {isUnlocked && !isClaimed && (
                        <LinearGradient colors={['#fde047', '#f59e0b']} style={StyleSheet.absoluteFill} />
                      )}
                      <Text
                        style={[
                          styles.nodeText,
                          isClaimed && { color: '#ffffff' },
                          isUnlocked && !isClaimed && { color: '#141420' },
                          !isUnlocked && { color: '#71717a' },
                        ]}
                      >
                        {reward.rank}
                      </Text>
                    </View>
                    <Text
                      style={[styles.tierText, { color: isUnlocked ? rankStyle.color : '#52525b' }]}
                      numberOfLines={1}
                    >
                      {rankStyle.tierName}
                    </Text>
                  </View>

                  {/* Reward box, node ke dayein taraf */}
                  <View
                    style={[
                      styles.box,
                      { left: NODE + 16, top: center - BOX_H / 2 },
                      isClaimed ? styles.boxClaimed : isUnlocked ? styles.boxUnlocked : styles.boxLocked,
                    ]}
                  >
                    <View style={styles.thumb}>
                      {isCoins ? (
                        <Ionicons name="cash-outline" size={22} color="#eab308" />
                      ) : item ? (
                        <AvatarItemThumb url={iconUrl} alt={item.item_name} />
                      ) : (
                        <Ionicons name="ribbon-outline" size={20} color="#71717a" />
                      )}
                    </View>

                    <View style={styles.boxText}>
                      <Text style={styles.boxTitle} numberOfLines={1}>
                        {isCoins
                          ? `${reward.quantity} Coins`
                          : item
                          ? item.item_name
                          : `Item #${reward.item_id}`}
                      </Text>
                    </View>

                    {isClaimed ? (
                      <View style={styles.statusRow}>
                        <Ionicons name="checkmark" size={14} color="#22c55e" />
                        <Text style={styles.claimedText}>Claimed</Text>
                      </View>
                    ) : !isUnlocked ? (
                      <View style={styles.statusRow}>
                        <Ionicons name="lock-closed-outline" size={14} color="#71717a" />
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleClaim(reward)}
                        disabled={claimingId === reward.id}
                        style={({ pressed }) => [
                          styles.claimBtn,
                          pressed && { backgroundColor: '#22c55e' },
                          claimingId === reward.id && { opacity: 0.6 },
                        ]}
                      >
                        <Text style={styles.claimBtnText}>{claimingId === reward.id ? '...' : 'Claim'}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </MotiView>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,30,42,0.8)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,42,0.8)',
  },
  topTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 2, color: '#e4e4e7' },
  toastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  toastText: { fontSize: 14, fontWeight: '700', color: '#fcd34d' },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  rankLabel: { fontSize: 12, color: '#9ca3af' },
  muted: { textAlign: 'center', color: '#71717a', paddingVertical: 40 },
  scroll: { flex: 1 },
  line: { position: 'absolute', width: 4 },
  lineGrey: { position: 'absolute', width: 4, backgroundColor: '#2a2a38' },
  nodeCol: { position: 'absolute', left: 0, alignItems: 'center' },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nodeClaimed: { backgroundColor: '#16a34a', borderColor: '#86efac' },
  nodeUnlocked: { borderColor: '#fde68a' },
  nodeLocked: { backgroundColor: '#1e1e2a', borderColor: '#2a2a38' },
  nodeText: { fontSize: 16, fontWeight: '800' },
  tierText: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  box: {
    position: 'absolute',
    right: 0,
    height: BOX_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    backgroundColor: '#141420', // star-900
  },
  boxClaimed: { borderColor: '#16a34a' },
  boxUnlocked: { borderColor: '#fbbf24' },
  boxLocked: { borderColor: '#2a2a38', opacity: 0.6 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f4f4f5', // star-100
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: { flex: 1, minWidth: 0 },
  boxTitle: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  claimedText: { fontSize: 11, fontWeight: '700', color: '#22c55e' },
  claimBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  claimBtnText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
});

export default memo(RankRewardsScreen);