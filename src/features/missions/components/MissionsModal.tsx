import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CurrencyIcon from '../../../shared/components/CurrencyIcon';
import useMissions from '../hooks/useMissions';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { FadeIn, CardPop } from '../../../shared/components/motion/ScreenTransition';

/**
 * Daily + Weekly missions popup - DailyRewardPopup jaisa hi center card
 * pattern. Tab switch se daily/weekly ke beech toggle hota hai.
 *
 * balance: { coins, z_money } - Dashboard se aata hai
 * onBalanceUpdate: (newBalance) => void - claim ke baad coins turant update
 *
 * WEB -> RN CHANGES:
 * - `lucide-react` (X/Target/Coins/Check/PartyPopper) -> `Ionicons`.
 * - `overflow-y-auto` list -> `ScrollView`.
 * - Progress bar (`div` width%) -> `View` with animated-free plain width%
 *   (RN supports percentage width directly, no transition needed here).
 */
interface Mission {
  mission_id: number | string;
  title: string;
  description: string;
  icon?: string;
  coin_reward: number;
  progress_count: number;
  target_count: number;
  is_completed: boolean;
  is_claimed: boolean;
}

interface MissionRowProps {
  mission: Mission;
  onClaim: (id: number | string) => void;
  claimingId: number | string | null;
}

const MissionRow = ({ mission, onClaim, claimingId }: MissionRowProps) => {
  const pct = Math.min(100, Math.round((mission.progress_count / mission.target_count) * 100));
  const isClaiming = claimingId === mission.mission_id;

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowTitleWrap}>
          <Text style={styles.rowIcon}>{mission.icon || '🎯'}</Text>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>{mission.title}</Text>
            <Text style={styles.rowDesc}>{mission.description}</Text>
          </View>
        </View>
        <View style={styles.rowReward}>
          <CurrencyIcon type="coin" size={12} />
          <Text style={styles.rowRewardText}>{mission.coin_reward}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${pct}%`, backgroundColor: mission.is_completed ? '#22c55e' : '#f5a623' },
          ]}
        />
      </View>

      <View style={styles.rowBottom}>
        <Text style={styles.progressLabel}>{mission.progress_count}/{mission.target_count}</Text>

        {mission.is_claimed ? (
          <View style={styles.claimedTag}>
            <Ionicons name="checkmark" size={12} color="#4ade80" />
            <Text style={styles.claimedText}>Claimed</Text>
          </View>
        ) : mission.is_completed ? (
          <Pressable
            onPress={() => onClaim(mission.mission_id)}
            disabled={isClaiming}
            style={[styles.claimBtn, isClaiming && styles.claimBtnDisabled]}
          >
            <Text style={styles.claimBtnText}>{isClaiming ? '...' : 'Claim'}</Text>
          </Pressable>
        ) : (
          <Text style={styles.inProgressText}>In progress</Text>
        )}
      </View>
    </View>
  );
};

interface Balance { coins: number; z_money: number; }
interface MissionsModalProps {
  show: boolean;
  onClose: () => void;
  balance?: Balance;
  onBalanceUpdate?: (balance: Balance) => void;
  onMissionsUpdate?: (hasClaimable: boolean) => void;
}

const MissionsModal = ({
  show,
  onClose,
  balance = { coins: 0, z_money: 0 },
  onBalanceUpdate,
  onMissionsUpdate,
}: MissionsModalProps) => {
  const __z = useTopZIndex(show);
  const { daily, weekly, loading, fetchDaily, fetchWeekly, claimDailyMission, claimWeeklyMission } = useMissions();

  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [claimingId, setClaimingId] = useState<number | string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (show) {
      fetchDaily();
      fetchWeekly();
    }
  }, [show, fetchDaily, fetchWeekly]);

  // Jab bhi daily/weekly data badle (fetch ya claim ke baad), Dashboard ko
  // batao ki quick drawer / missions tile ka red dot dikhna chahiye ya nahi.
  useEffect(() => {
    if (!onMissionsUpdate) return;
    const allMissions: Mission[] = [...(daily?.missions || []), ...(weekly?.missions || [])];
    onMissionsUpdate(allMissions.some((m) => m.is_completed && !m.is_claimed));
  }, [daily, weekly, onMissionsUpdate]);

  const data = tab === 'daily' ? daily : weekly;
  const missions: Mission[] = data?.missions || [];

  const handleClaim = async (missionId: number | string) => {
    if (claimingId) return;
    setClaimingId(missionId);
    try {
      const res = tab === 'daily' ? await claimDailyMission(missionId) : await claimWeeklyMission(missionId);

      if (res.success) {
        setToast(`+${res.coins_earned} coins earned!`);
        if (onBalanceUpdate && typeof res.new_coin_balance === 'number') {
          onBalanceUpdate({ ...balance, coins: res.new_coin_balance });
        }
        // Naye status (is_claimed: true) ke aane tak wait karo, warna
        // "Claim" button thodi der ke liye wapas dikh jaata hai (purana
        // stale data) jab tak refetch complete na ho.
        tab === 'daily' ? await fetchDaily() : await fetchWeekly();
      } else {
        setToast(res.message || "Can't claim right now");
      }
    } catch (err: any) {
      setToast(err?.response?.data?.detail || 'Claim failed');
    } finally {
      setClaimingId(null);
      setTimeout(() => setToast(''), 2500);
    }
  };

  return (
    <FadeIn show={show} style={[styles.backdrop, { zIndex: __z }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <CardPop style={styles.card}>
        <Pressable onPress={onClose} accessibilityLabel="Close" style={styles.closeBtn}>
          <Ionicons name="close" size={16} color="#c0b8d8" />
        </Pressable>

        <View style={styles.titleRow}>
          <Ionicons name="flag" size={18} color="#f5c451" />
          <Text style={styles.title}>Missions</Text>
        </View>
        <Text style={styles.subtitle}>Complete missions, earn coins</Text>

        <View style={styles.tabRow}>
          <Pressable onPress={() => setTab('daily')} style={[styles.tabBtn, tab === 'daily' && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === 'daily' && styles.tabBtnTextActive]}>Daily</Text>
          </Pressable>
          <Pressable onPress={() => setTab('weekly')} style={[styles.tabBtn, tab === 'weekly' && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === 'weekly' && styles.tabBtnTextActive]}>Weekly</Text>
          </Pressable>
        </View>

        {!!toast && (
          <View style={styles.toastRow}>
            <Ionicons name="sparkles" size={16} color="#f5c451" />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 4 }}>
          {loading && !data ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color="#a8a0c0" />
            </View>
          ) : missions.length === 0 ? (
            <Text style={styles.emptyText}>No {tab === 'daily' ? 'daily' : 'weekly'} missions right now.</Text>
          ) : (
            missions.map((m) => (
              <MissionRow key={m.mission_id} mission={m} onClaim={handleClaim} claimingId={claimingId} />
            ))
          )}
        </ScrollView>
      </CardPop>
    </FadeIn>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 24,
  },
  card: {
    position: 'relative',
    backgroundColor: '#1c1730',
    borderWidth: 1,
    borderColor: '#2c2545',
    borderRadius: 20,
    width: '100%',
    maxWidth: 384,
    maxHeight: '85%',
    padding: 20,
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(18,16,31,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2 },
  title: { fontWeight: '700', fontSize: 18, color: '#ffffff', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#a8a0c0', fontSize: 12, marginBottom: 16 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(18,16,31,0.7)', alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#f5a623' },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: '#a8a0c0' },
  tabBtnTextActive: { color: '#1c1730' },
  toastRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  toastText: { textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#f5c451' },
  list: { flexGrow: 0 },
  emptyWrap: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: '#5f5878', textAlign: 'center', paddingVertical: 24 },
  row: {
    backgroundColor: 'rgba(18,16,31,0.7)', borderWidth: 1, borderColor: '#2c2545',
    borderRadius: 12, padding: 12, marginBottom: 10,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  rowTitleWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flexShrink: 1 },
  rowIcon: { fontSize: 20, lineHeight: 22 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  rowDesc: { fontSize: 11, color: '#a8a0c0', marginTop: 2 },
  rowReward: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  rowRewardText: { fontSize: 12, fontWeight: '700', color: '#f5c451' },
  progressTrack: { marginTop: 10, height: 8, borderRadius: 999, backgroundColor: '#332b52', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: 11, color: '#a8a0c0' },
  claimedTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  claimedText: { fontSize: 11, fontWeight: '700', color: '#4ade80' },
  claimBtn: { backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  claimBtnDisabled: { opacity: 0.6 },
  claimBtnText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  inProgressText: { fontSize: 11, color: '#5f5878' },
});

export default memo(MissionsModal);