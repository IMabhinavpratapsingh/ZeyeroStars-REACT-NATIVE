import React, { memo, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CurrencyIcon from './CurrencyIcon';
import useBackButtonHandler from '../hooks/useBackButtonHandler';
import useTopZIndex from '../hooks/useTopZIndex';
import VerifiedBadge from './VerifiedBadge';
import {
  buyVerifiedBadge,
  buyZMoney,
  setVerifiedBadgePurchaseHandlers,
  setZMoneyPurchaseHandlers,
  getProductPrice,
  Z_MONEY_PRODUCTS,
  VERIFIED_PRODUCT_ID,
} from '../services/verifiedBadgePurchase';
import { showAlert } from '../utils/alertBus';

/**
 * Full-screen "page-like" UI (RankRewardsScreen jaisa - fixed inset-0,
 * apna z-index, koi route change nahi, sirf `show` prop se control).
 * Do tabs: "Subscriptions" (Verified badge) aur "Z Money" (one-time).
 *
 * WEB -> RN CHANGES:
 * - `fixed inset-0` -> absoluteFill View + useTopZIndex.
 * - tailwind gradient -> expo-linear-gradient.
 * - lucide-react icons -> @expo/vector-icons (Ionicons).
 */
const TABS = [
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'zmoney', label: 'Z Money' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface StoreScreenProps {
  show: boolean;
  /** Kholte waqt kaunsa tab dikhana hai (default: subscriptions) */
  initialTab?: TabId;
  onClose: () => void;
  onBalanceUpdate?: (updater: (prev: any) => any) => void;
}

const StoreScreen = ({ show, initialTab = 'subscriptions', onClose, onBalanceUpdate }: StoreScreenProps) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabId>('subscriptions');
  const [buyingVerified, setBuyingVerified] = useState(false);
  const [buyingZMoneyId, setBuyingZMoneyId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  useBackButtonHandler(show, onClose);
  const zIndex = useTopZIndex(show);

  // Har baar khulte hi requested tab par jao (jaise Shop ke "+" se Z Money tab)
  useEffect(() => {
    if (show) setTab(initialTab);
  }, [show, initialTab]);

  useEffect(() => {
    if (!show) return;
    const ids = [VERIFIED_PRODUCT_ID, ...Z_MONEY_PRODUCTS.map((p) => p.id)];
    const next: Record<string, string> = {};
    ids.forEach((id) => {
      const price = getProductPrice(id);
      if (price) next[id] = price;
    });
    if (Object.keys(next).length) setPrices((prev) => ({ ...prev, ...next }));
  }, [show]);

  useEffect(() => {
    setVerifiedBadgePurchaseHandlers({
      onSuccess: () => {
        setBuyingVerified(false);
        showAlert('Verified badge activated! 🎉', 'success');
      },
      onError: (msg?: string) => {
        setBuyingVerified(false);
        showAlert(msg || 'Purchase failed, try again.', 'error');
      },
    });

    setZMoneyPurchaseHandlers({
      onSuccess: (data: any) => {
        setBuyingZMoneyId(null);
        showAlert(`+${data?.credited ?? 0} Z Money credited! 🎉`, 'success');
        if (typeof data?.z_money === 'number' && onBalanceUpdate) {
          onBalanceUpdate((prev: any) => ({ ...prev, z_money: data.z_money }));
        }
      },
      onError: (msg?: string) => {
        setBuyingZMoneyId(null);
        showAlert(msg || 'Purchase failed, try again.', 'error');
      },
    });
  }, [onBalanceUpdate]);

  if (!show) return null;

  const handleBuyVerified = () => {
    if (buyingVerified) return;
    setBuyingVerified(true);
    buyVerifiedBadge();
  };

  const handleBuyZMoney = (productId: string) => {
    if (buyingZMoneyId) return;
    setBuyingZMoneyId(productId);
    buyZMoney(productId);
  };

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex, elevation: zIndex }]}>
      <LinearGradient
        colors={['#050505', '#0a0a0a', '#000000']}
        style={StyleSheet.absoluteFill}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#c2c2c2" />
        </Pressable>
        <Text style={styles.topBarTitle}>STORE</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[styles.tabBtn, active ? styles.tabBtnActive : styles.tabBtnInactive]}
            >
              <Text style={[styles.tabBtnText, active ? styles.tabBtnTextActive : styles.tabBtnTextInactive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tab === 'subscriptions' && (
          <View style={styles.card}>
            <View style={styles.rowGap}>
              <VerifiedBadge size="lg" />
              <View>
                <Text style={styles.cardTitle}>Verified Badge</Text>
                <Text style={styles.cardSub}>Recurring subscription</Text>
              </View>
            </View>
            <View style={styles.perksList}>
              {[
                'Verified checkmark on profile',
                'Stand out in chats & leaderboard',
                'No ads on room join',
              ].map((perk) => (
                <View key={perk} style={styles.perkRow}>
                  <Ionicons name="checkmark" size={13} color="#22c55e" />
                  <Text style={styles.perkText}>{perk}</Text>
                </View>
              ))}
            </View>
            <Pressable
              onPress={handleBuyVerified}
              disabled={buyingVerified}
              style={[styles.subscribeBtn, buyingVerified && styles.disabledBtn]}
            >
              <Ionicons name="shield-checkmark" size={16} color="#fff" />
              <Text style={styles.subscribeBtnText}>
                {buyingVerified ? 'Processing…' : `Subscribe - ${prices[VERIFIED_PRODUCT_ID] || '₹99'}/month`}
              </Text>
            </Pressable>
          </View>
        )}

        {tab === 'zmoney' && (
          <View style={styles.zmoneyList}>
            {Z_MONEY_PRODUCTS.map((p) => (
              <View key={p.id} style={styles.zmoneyCard}>
                <View style={styles.zmoneyIconWrap}>
                  <CurrencyIcon type="zmoney" size={22} />
                </View>
                <View style={styles.zmoneyInfo}>
                  <Text style={styles.cardTitle}>{p.amount} Z Money</Text>
                  <Text style={styles.cardSub}>One-time purchase</Text>
                </View>
                <Pressable
                  onPress={() => handleBuyZMoney(p.id)}
                  disabled={buyingZMoneyId === p.id}
                  style={[styles.buyBtn, buyingZMoneyId === p.id && styles.disabledBtn]}
                >
                  <Text style={styles.buyBtnText}>
                    {buyingZMoneyId === p.id ? '...' : prices[p.id] || p.fallbackPrice}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(22,22,22,0.8)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(22,22,22,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: { fontWeight: '700', fontSize: 13, letterSpacing: 2, color: '#e0e0e0' },
  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#f2a65a' },
  tabBtnInactive: { backgroundColor: 'rgba(22,22,22,0.7)' },
  tabBtnText: { fontSize: 13, fontWeight: '700' },
  tabBtnTextActive: { color: '#fff' },
  tabBtnTextInactive: { color: '#c2c2c2' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(22,22,22,0.7)',
    borderWidth: 1,
    borderColor: '#161616',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontWeight: '700', color: '#fff', fontSize: 13 },
  cardSub: { color: '#9a9a9a', fontSize: 11 },
  perksList: { gap: 6, paddingLeft: 4 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perkText: { color: '#c2c2c2', fontSize: 11 },
  subscribeBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f2a65a',
    paddingVertical: 12,
    borderRadius: 12,
  },
  subscribeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  disabledBtn: { opacity: 0.6 },
  zmoneyList: { gap: 12 },
  zmoneyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(22,22,22,0.7)',
    borderWidth: 1,
    borderColor: '#161616',
    borderRadius: 16,
    padding: 16,
  },
  zmoneyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zmoneyInfo: { flex: 1, minWidth: 0 },
  buyBtn: { backgroundColor: '#f59e0b', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  buyBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
});

export default memo(StoreScreen);