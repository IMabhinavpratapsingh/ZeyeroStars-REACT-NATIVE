import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import useDashboardBalance from '../../features/dashboard/hooks/useDashboardBalance';

// TODO: yeh abhi bhi ek chhota slice hai - Dashboard.jsx (web, 4281 lines)
// ka baaki hissa (feed/rooms/DM/games/communities) alag hooks/screens mein
// todna baaki hai. Balance wala part (useDashboardBalance) wire kar diya
// hai taaki Header aur baaki dashboard components isse consume kar sakein.
export default function DashboardScreen() {
  const { balance, fetchBalance } = useDashboardBalance();

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return (
    <View style={styles.screen}>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Coins</Text>
        <Text style={styles.balanceValue}>{balance.coins}</Text>
      </View>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Z Money</Text>
        <Text style={styles.balanceValue}>{balance.z_money}</Text>
      </View>
      <Text style={styles.placeholder}>Rest of Home - coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000', paddingTop: 60, paddingHorizontal: 20, gap: 12 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#27272a', paddingBottom: 10 },
  balanceLabel: { color: '#a1a1aa', fontSize: 14 },
  balanceValue: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  placeholder: { color: '#71717a', fontSize: 13, marginTop: 24, textAlign: 'center' },
});