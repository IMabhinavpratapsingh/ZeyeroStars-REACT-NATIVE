import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import axios from 'axios';
import { router } from 'expo-router';
import { API_BASE } from '../../shared/config/config';
import { getMyId, clearMyId } from '../../shared/utils/auth';
import { getToken, clearToken } from '../../shared/services/NetworkManager';
import ProfileCard from '../../shared/components/ProfileCard';
import RankBadge from '../../shared/components/RankBadge';
import VerifiedBadge from '../../shared/components/VerifiedBadge';
import EliteBadge from '../../shared/components/EliteBadge';
import useItemsCatalog from '../../shared/hooks/useItemsCatalog';
import useInventory from '../../shared/hooks/useInventory';
import useDashboardBalance from '../../features/dashboard/hooks/useDashboardBalance';
import { confirmAction } from '../../shared/utils/confirmBus';

// WEB -> RN SCOPE NOTE: Dashboard.jsx (web) mein "apni profile" alag screen
// nahi thi - ek DM-header/ProfileViewModal hi self aur others dono dikhata
// tha. Yahan alag, simple self-profile TAB banaya hai: avatar + rank/badges +
// balance + logout. Edit-profile (bio, skills), "My Room" card, aur
// followers/following abhi is pass mein nahi hain.
interface MyProfile {
  username?: string;
  rank?: string | number;
  is_verified?: boolean;
  is_elite?: boolean;
  photo_url?: string | null;
  [key: string]: unknown;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { itemsById } = useItemsCatalog();
  const { equippedIds } = useInventory();
  const { balance, fetchBalance } = useDashboardBalance();

  const loadProfile = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const token = getToken();
      const res = await axios.get(`${API_BASE}/profile/${getMyId()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(res.data);
    } catch (err: any) {
      console.error('Self profile fetch error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    fetchBalance();
  }, [loadProfile, fetchBalance]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile({ silent: true });
    fetchBalance();
  };

  const handleLogout = async () => {
    const ok = await confirmAction({ message: 'Log out of your account?' });
    if (!ok) return;
    await clearToken();
    await clearMyId();
    router.replace('/login');
  };

  if (loading && !profile) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
    >
      <View style={styles.avatarWrap}>
        <ProfileCard
          username={profile?.username}
          size="lg"
          equippedItems={equippedIds}
          itemsById={itemsById}
          photoUrl={profile?.photo_url}
        />
      </View>

      <View style={styles.nameRow}>
        <Text style={styles.username}>{profile?.username}</Text>
        {!!profile?.is_verified && <VerifiedBadge size="sm" />}
        {!!profile?.is_elite && <EliteBadge size="sm" />}
      </View>

      {profile?.rank != null && (
        <View style={styles.rankRow}>
          <RankBadge rank={profile.rank} size="sm" />
        </View>
      )}

      <View style={styles.balanceCard}>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Coins</Text>
          <Text style={styles.balanceValue}>{balance.coins}</Text>
        </View>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Z Money</Text>
          <Text style={styles.balanceValue}>{balance.z_money}</Text>
        </View>
      </View>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
  content: { paddingTop: 16, paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  avatarWrap: { width: '100%', maxWidth: 260, marginBottom: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  username: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  rankRow: { marginTop: 8 },
  balanceCard: {
    width: '100%',
    marginTop: 24,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceLabel: { color: '#a1a1aa', fontSize: 14 },
  balanceValue: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  logoutBtn: {
    marginTop: 28,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3f3f46',
    alignItems: 'center',
  },
  logoutText: { color: '#f87171', fontWeight: '700', fontSize: 14 },
});