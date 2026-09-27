import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import axios from 'axios';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { getBottomNavTotal } from '../../../shared/constants/layout';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';

const GRID_PADDING = 16;
const GRID_GAP = 12;

/**
 * Time-limited store - normal shop se alag hai (avatar cosmetics nahi,
 * generic khareed-ne wali items - boosts, bundles, event items waghera).
 * Naya item add karna ho to seedha 'limited_store_items' table me ek row
 * daal do (item_name, description, image_url, coin_price, z_money_price,
 * is_active) - koi code change nahi chahiye, ye modal khud hi dikha dega.
 *
 * balance: { coins, z_money } - Dashboard se aata hai
 * onBalanceUpdate: (newBalance) => void - purchase ke baad Dashboard/Header
 *   ka balance bhi refresh ho jaye
 *
 * WEB -> RN CHANGES (ShopModal jaisi hi):
 * - `fixed top-0 inset-x-0 bottom-20` -> in-tree absolute overlay, bottom =
 *   getBottomNavTotal(insets.bottom), top par insets.top padding. Parent
 *   full-screen View ho.
 * - localStorage token -> getToken().
 * - `<img src=image_url>` -> expo-image (`contentFit="contain"`, disk cache).
 * - Toast timeout unmount par clear hota hai.
 */
interface Balance {
  coins: number;
  z_money: number;
}

interface LimitedStoreModalProps {
  show: boolean;
  onClose: () => void;
  balance?: Balance;
  onBalanceUpdate?: (balance: any) => void;
}

const DEFAULT_BALANCE: Balance = { coins: 0, z_money: 0 };

const LimitedStoreModal = ({
  show,
  onClose,
  balance = DEFAULT_BALANCE,
  onBalanceUpdate,
}: LimitedStoreModalProps) => {
  const zIndex = useTopZIndex(show);
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  const [items, setItems] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | number | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ek baar catalog + inventory load ho chuki ho to dobara modal khulne par
  // poora "Loading..." dikha ke fresh reload nahi karna - Inbox/Notifications
  // jaisa hi pattern (loaded flag). Purchase hone par quantities already
  // local state update (handleBuy) se ho jaati hain.
  const [loaded, setLoaded] = useState(false);

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const loadCatalogAndInventory = useCallback(() => {
    setLoading(true);
    const token = getToken();
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    Promise.all([
      axios.get(`${API_BASE}/limited-store/items`, config),
      token
        ? axios.get(`${API_BASE}/limited-store/me`, config)
        : Promise.resolve({ data: { quantities: {} } }),
    ])
      .then(([itemsRes, invRes]) => {
        setItems(itemsRes.data || []);
        setQuantities(invRes.data?.quantities || {});
        setLoaded(true);
      })
      .catch((err: any) => {
        console.error('Limited store fetch error:', err.response?.data || err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (show && !loaded) loadCatalogAndInventory();
  }, [show, loaded, loadCatalogAndInventory]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }, []);

  const handleBuy = async (item: any) => {
    if (buyingId) return; // ek waqt me ek hi purchase chalne do

    const coinPrice = item.coin_price || 0;
    const zMoneyPrice = item.z_money_price || 0;

    if (balance.coins < coinPrice || balance.z_money < zMoneyPrice) {
      showToast('Not enough money!');
      return;
    }

    setBuyingId(item.items_id);
    try {
      const token = getToken();
      const res = await axios.post(
        `${API_BASE}/limited-store/buy`,
        { item_id: item.items_id, quantity: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.balance) onBalanceUpdate?.(res.data.balance);
      setQuantities((prev) => ({
        ...prev,
        [item.items_id]: res.data?.new_quantity ?? (prev[item.items_id] || 0) + 1,
      }));
      showToast(`${item.item_name} khareed liya!`);
    } catch (err: any) {
      console.error('Buy error:', err.response?.data || err.message);
      showToast(err.response?.data?.detail || 'Purchase failed');
    } finally {
      setBuyingId(null);
    }
  };

  const cardWidth = (screenW - GRID_PADDING * 2 - GRID_GAP) / 2;

  return (
    <SlideInRight
      show={show}
      style={[
        styles.screen,
        { zIndex, elevation: 20, bottom: getBottomNavTotal(insets.bottom), paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={16} color="#ffffff" />
          <Text style={styles.headerBtnText}>Close</Text>
        </Pressable>
        <View style={styles.headerTitleRow}>
          <Ionicons name="timer-outline" size={18} color="#ffffff" />
          <Text style={styles.headerTitle} numberOfLines={1}>
            Time Limited Store
          </Text>
        </View>
        <View style={styles.balanceRow}>
          <Ionicons name="cash-outline" size={14} color="#ffffff" />
          <Text style={styles.balanceText}>{balance.coins}</Text>
          <Text style={styles.balanceText}>|</Text>
          <Text style={styles.balanceText}>ⓩ</Text>
          <Ionicons name="cash-outline" size={13} color="#ffffff" />
          <Text style={styles.balanceText}>{balance.z_money}</Text>
        </View>
      </View>

      {/* Items grid */}
      <ScrollView style={styles.flex} contentContainerStyle={styles.gridContent}>
        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>No items in the store right now. Check back soon!</Text>
        ) : (
          <View style={styles.grid}>
            {items.map((item) => {
              const owned = quantities[item.items_id] || 0;
              const coinPrice = item.coin_price || 0;
              const zMoneyPrice = item.z_money_price || 0;
              const isBuying = buyingId === item.items_id;
              const canAfford = balance.coins >= coinPrice && balance.z_money >= zMoneyPrice;

              return (
                <View key={item.items_id} style={[styles.card, { width: cardWidth }]}>
                  {owned > 0 && (
                    <View style={styles.ownedBadge}>
                      <Text style={styles.ownedText}>x{owned}</Text>
                    </View>
                  )}

                  <View style={styles.thumbBox}>
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.fill}
                        contentFit="contain"
                        cachePolicy="disk"
                        accessibilityLabel={item.item_name}
                      />
                    ) : (
                      <Ionicons name="timer-outline" size={28} color="#6e6e6e" />
                    )}
                  </View>

                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.item_name}
                  </Text>
                  {!!item.description && (
                    <Text style={styles.description} numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}

                  <View style={styles.priceRow}>
                    {coinPrice > 0 && (
                      <View style={styles.priceChip}>
                        <Ionicons name="cash-outline" size={12} color="#ffffff" />
                        <Text style={styles.priceText}>{coinPrice}</Text>
                      </View>
                    )}
                    {zMoneyPrice > 0 && (
                      <View style={styles.priceChip}>
                        <Text style={styles.priceText}>ⓩ</Text>
                        <Ionicons name="cash-outline" size={11} color="#ffffff" />
                        <Text style={styles.priceText}>{zMoneyPrice}</Text>
                      </View>
                    )}
                    {coinPrice === 0 && zMoneyPrice === 0 && (
                      <Text style={[styles.priceText, { color: '#4ade80' }]}>Free</Text>
                    )}
                  </View>

                  <Pressable
                    onPress={() => handleBuy(item)}
                    disabled={isBuying || !canAfford}
                    style={({ pressed }) => [
                      styles.buyBtn,
                      !canAfford ? styles.buyBtnOff : styles.buyBtnOn,
                      canAfford && isBuying && styles.dim,
                      pressed && canAfford && { backgroundColor: '#eab308' }, // star-gold-500
                    ]}
                  >
                    <Text style={[styles.buyText, !canAfford && { color: '#6e6e6e' }]}>
                      {isBuying ? 'Buying...' : owned > 0 ? 'Buy More' : 'Buy'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Toast */}
      {!!toast && (
        <View style={[styles.toastWrap, { top: insets.top + 64 }]} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      )}
    </SlideInRight>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  dim: { opacity: 0.5 },
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, marginHorizontal: 8 },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 16, flexShrink: 1 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  gridContent: { padding: GRID_PADDING, paddingBottom: 32 },
  emptyText: { color: '#6e6e6e', textAlign: 'center', marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  card: {
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 8,
    borderWidth: 2,
    borderColor: 'rgba(161,98,7,0.4)', // star-gold-700/40
  },
  ownedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: '#16a34a', // star-success-600
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  ownedText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  thumbBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    width: '100%',
    marginTop: 6,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    width: '100%',
    textAlign: 'center',
    color: '#9a9a9a', // star-400
    fontSize: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  priceChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  priceText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  buyBtn: { width: '100%', marginTop: 8, paddingVertical: 6, borderRadius: 999, alignItems: 'center' },
  buyBtnOn: { backgroundColor: '#ca8a04' }, // yellow-600
  buyBtnOff: { backgroundColor: '#262626' },
  buyText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  toast: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});

export default memo(LimitedStoreModal);