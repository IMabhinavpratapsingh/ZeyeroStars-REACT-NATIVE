import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CurrencyIcon from '../../../shared/components/CurrencyIcon';
import { requestOpenStore } from '../../../shared/utils/storeOpenBus';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { getMyIdAsync } from '../../../shared/utils/auth';
import { getEquippedByCategory } from '../../../shared/utils/profileHelpers';
import { getBottomNavTotal } from '../../../shared/constants/layout';
import useItemsCatalog from '../../../shared/hooks/useItemsCatalog';
import useInventory from '../../../shared/hooks/useInventory';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';
import AvatarItemThumb from '../../avatar/components/AvatarItemThumb';
import AvatarLayers, { type EquippedByCategory } from '../../avatar/components/AvatarLayers';
import {
  getAssetUrl,
  CATEGORY_FOLDERS,
  CATEGORY_LABELS as BASE_CATEGORY_LABELS,
  AVATAR_ASPECT_RATIO_NUM,
  MULTI_SELECT_CATEGORIES,
  MAX_MULTI_SELECT,
} from '../../avatar/utils/avatarAssets';

const ALL_TAB = 'all';
const TABS: string[] = [ALL_TAB, ...CATEGORY_FOLDERS];

// avatarAssets.ts ki CATEGORY_LABELS hi single source of truth hai (customize
// modal isi ko use karta hai) - yahan sirf "all" tab ka extra label add hota hai.
const CATEGORY_LABELS: Record<string, string> = { all: 'All', ...BASE_CATEGORY_LABELS };

const MAX_BUY_QTY = 10;
const GRID_PADDING = 16;
const GRID_GAP = 12;

interface Balance {
  coins: number;
  z_money: number;
}

/**
 * balance: { coins, z_money } - Dashboard se aata hai
 * onBalanceUpdate: (newBalance) => void - purchase ke baad Dashboard/Header
 *   ka balance bhi refresh ho jaye
 *
 * WEB -> RN CHANGES:
 * - `fixed top-0 inset-x-0 bottom-20` -> in-tree absolute overlay; bottom =
 *   getBottomNavTotal(insets.bottom) (layout.ts - BottomNav ki height +
 *   safe-area), top par status-bar ke liye insets.top padding. Parent
 *   full-screen View ho.
 * - localStorage token -> getToken() (NetworkManager), getMyId ->
 *   getMyIdAsync (cache miss ka risk nahi).
 * - Quantity `<input type=number>` -> chhota QtyInput (number-pad). Web mein
 *   field khaali karte hi turant 1 ho jaata tha; yahan type karte waqt khaali
 *   rehne deta hai, blur par wapas valid value dikhti hai.
 * - Try-On preview card: `fixed inset-0` -> isi modal ke andar absoluteFill
 *   overlay (web mein bhi transformed parent ke andar hi tha).
 * - `bg-gradient-to-b` -> expo-linear-gradient.
 * - Toast ka timeout ab unmount par clear hota hai.
 * - AvatarItemThumb ab `asset` prop leta hai (url nahi) - naya
 *   AvatarItemThumb.tsx replace kar dena.
 */
interface ShopModalProps {
  show: boolean;
  onClose: () => void;
  balance?: Balance;
  onBalanceUpdate?: (balance: any) => void;
}

const DEFAULT_BALANCE: Balance = { coins: 0, z_money: 0 };

const QtyInput = ({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) => {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  return (
    <TextInput
      value={text}
      editable={!disabled}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={2}
      selectTextOnFocus
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(String(value));
      }}
      onChangeText={(t) => {
        const digits = t.replace(/[^0-9]/g, '');
        if (digits === '') {
          setText('');
          return;
        }
        const n = Math.min(MAX_BUY_QTY, Math.max(1, Number(digits)));
        setText(String(n));
        onChange(n);
      }}
      style={[styles.qtyInput, disabled && styles.dim]}
    />
  );
};

const ShopModal = ({ show, onClose, balance = DEFAULT_BALANCE, onBalanceUpdate }: ShopModalProps) => {
  const zIndex = useTopZIndex(show);
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { itemsById, loading: catalogLoading } = useItemsCatalog();
  const { quantities, loading: invLoading, refresh: refreshInventory } = useInventory();

  const [activeTab, setActiveTab] = useState(ALL_TAB);
  const [buyingId, setBuyingId] = useState<string | number | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // itemId -> shop mein abhi kitni quantity select ki hai (bulk-buy stepper),
  // default 1, max MAX_BUY_QTY.
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const getQty = (itemId: string | number) => buyQuantities[itemId] || 1;
  const setQty = (itemId: string | number, value: number) => {
    const n = Math.min(MAX_BUY_QTY, Math.max(1, Math.floor(Number(value) || 1)));
    setBuyQuantities((prev) => ({ ...prev, [itemId]: n }));
  };
  const bumpQty = (itemId: string | number, delta: number) => setQty(itemId, getQty(itemId) + delta);

  // "Try On" preview - koi item purchase/equip kiye bina, apne avatar par
  // laga ke dikhane ke liye. previewItem set hone par card popup hota hai.
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [myEquippedByCategory, setMyEquippedByCategory] = useState<EquippedByCategory>({});
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);

  const handleClose = useStableCallback(() => onClose?.());
  const closePreview = useStableCallback(() => setPreviewItem(null));
  useBackButtonHandler(show, handleClose);
  useBackButtonHandler(!!previewItem, closePreview);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  // Apna khud ka current equipped avatar (items + photo) ek baar fetch kar lo
  // taaki "Try On" preview mein baaki equipped items bhi sahi dikhein.
  useEffect(() => {
    if (!show || catalogLoading) return;
    let cancelled = false;
    (async () => {
      const myId = await getMyIdAsync();
      if (!myId || cancelled) return;
      const token = getToken();
      try {
        const res = await axios.get(`${API_BASE}/profile/${myId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        const data = res.data || {};
        setMyEquippedByCategory(getEquippedByCategory(data.equipped_items, itemsById));
        setMyAvatarUrl(data.avatar_url || null);
      } catch (err: any) {
        console.error('Own profile fetch (try-on) error:', err.response?.data || err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show, catalogLoading, itemsById]);

  const previewEquippedByCategory = useMemo<EquippedByCategory>(() => {
    if (!previewItem) return myEquippedByCategory;
    const cat: string = previewItem.item_category;
    if ((MULTI_SELECT_CATEGORIES as string[]).includes(cat)) {
      const current = (myEquippedByCategory[cat] as (string | number)[] | undefined) || [];
      // Preview me existing equipped items ke saath ye naya bhi daal do
      // (agar already equipped nahi hai), aur max 5 ka cap yahan bhi.
      const next = current.includes(previewItem.items_id)
        ? current
        : [...current, previewItem.items_id].slice(-MAX_MULTI_SELECT);
      return { ...myEquippedByCategory, [cat]: next };
    }
    return { ...myEquippedByCategory, [cat]: previewItem.items_id };
  }, [previewItem, myEquippedByCategory]);

  const loading = catalogLoading || invLoading;

  // Floating "Limited" button: ON hone par sirf ABHI ACTIVE limited items
  // dikhte hain (is_limited && is_limited_active). OFF = normal shop.
  const [limitedOnly, setLimitedOnly] = useState(false);

  // Har baar shop khulne par naya random order (upar naye-naye items aayein).
  // Random key har item ko ek baar milti hai aur shop band hone tak wahi
  // rehti hai - isliye catalog background mein refresh ho ya tab badlo,
  // items idhar-udhar kood nahi karte.
  const randomKeysRef = useRef<Record<string, number>>({});
  const [shuffleTick, setShuffleTick] = useState(0);
  useEffect(() => {
    if (!show) return;
    randomKeysRef.current = {};
    setShuffleTick((t) => t + 1);
    setLimitedOnly(false);
    setActiveTab(ALL_TAB);
  }, [show]);

  // is_default wali items sabko free milti hain (signup ke time hi) - shop
  // me nahi dikhani. Expire ho chuke limited items (is_limited_active=false)
  // bhi shop se gayab - backend /shop/items ka bhi yahi rule hai.
  const items = useMemo(() => {
    const keys = randomKeysRef.current;
    const keyOf = (id: string | number) => {
      const k = String(id);
      if (keys[k] === undefined) keys[k] = Math.random();
      return keys[k];
    };
    return Object.values(itemsById)
      .filter((item: any) => {
        if (item.is_default) return false;
        if (item.is_limited && !item.is_limited_active) return false;
        if (limitedOnly) return !!item.is_limited;
        return activeTab === ALL_TAB || item.item_category === activeTab;
      })
      .sort((a: any, b: any) => keyOf(a.items_id) - keyOf(b.items_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsById, activeTab, limitedOnly, shuffleTick]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }, []);

  const handleBuy = async (item: any) => {
    if (buyingId) return; // ek waqt me ek hi purchase chalne do

    const qty = getQty(item.items_id);
    const coinPrice = (item.coin_price || 0) * qty;
    const zMoneyPrice = (item.z_money_price || 0) * qty;

    if (balance.coins < coinPrice || balance.z_money < zMoneyPrice) {
      showToast('Not enough money!');
      return;
    }

    setBuyingId(item.items_id);
    try {
      const token = getToken();
      const res = await axios.post(
        `${API_BASE}/shop/buy`,
        { item_id: item.items_id, quantity: qty },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.balance) onBalanceUpdate?.(res.data.balance);
      refreshInventory(); // taaki quantity (x1/x2/x3) turant update ho jaye
      setBuyQuantities((prev) => ({ ...prev, [item.items_id]: 1 }));
      showToast(`${item.item_name} x${qty} khareed liya!`);
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
          <Ionicons name="cart-outline" size={18} color="#ffffff" />
          <Text style={styles.headerTitle}>Shop</Text>
        </View>
        <View style={styles.balanceRow}>
          <CurrencyIcon type="coin" size={14} />
          <Text style={styles.balanceText}>{balance.coins}</Text>
          <Text style={styles.balanceText}>|</Text>
          <CurrencyIcon type="zmoney" size={15} />
          <Text style={styles.balanceText}>{balance.z_money}</Text>
          <Pressable
            onPress={() => requestOpenStore('zmoney')}
            hitSlop={8}
            accessibilityLabel="Buy Z Money"
            style={styles.plusBtn}
          >
            <Ionicons name="add" size={14} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((tab) => {
          const active = !limitedOnly && activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => {
                setLimitedOnly(false);
                setActiveTab(tab);
              }}
              style={[styles.tab, active ? styles.tabActive : styles.tabIdle]}
            >
              <Text style={[styles.tabText, { color: active ? '#ffffff' : '#9a9a9a' }]}>
                {CATEGORY_LABELS[tab] || tab}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Items grid */}
      <ScrollView style={styles.flex} contentContainerStyle={styles.gridContent}>
        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>
            {limitedOnly ? 'No limited items active right now.' : 'No items in this category yet.'}
          </Text>
        ) : (
          <View style={styles.grid}>
            {items.map((item: any) => {
              const asset = getAssetUrl(item.item_category, item.items_id);
              const owned = quantities[item.items_id] || 0;
              const qty = getQty(item.items_id);
              const unitCoinPrice = item.coin_price || 0;
              const unitZMoneyPrice = item.z_money_price || 0;
              const isFree = unitCoinPrice === 0 && unitZMoneyPrice === 0;
              const coinPrice = unitCoinPrice * qty;
              const zMoneyPrice = unitZMoneyPrice * qty;
              const itemPower = item.power || 0;
              const isBuying = buyingId === item.items_id;
              const canAfford = balance.coins >= coinPrice && balance.z_money >= zMoneyPrice;

              return (
                <View
                  key={item.items_id}
                  style={[
                    styles.card,
                    { width: cardWidth },
                    item.is_limited ? styles.cardLimited : styles.cardNormal,
                  ]}
                >
                  {item.is_limited && (
                    <View style={styles.limitedBadge}>
                      <Ionicons name="timer-outline" size={10} color="#ffffff" />
                      <Text style={styles.badgeText}>Limited</Text>
                    </View>
                  )}

                  {owned > 0 && (
                    <View style={styles.ownedBadge}>
                      <Text style={styles.ownedText}>x{owned}</Text>
                    </View>
                  )}

                  <View style={styles.thumbBox}>
                    <AvatarItemThumb asset={asset} alt={item.item_name} />
                    <Pressable
                      onPress={() => setPreviewItem(item)}
                      style={styles.eyeBtn}
                      accessibilityLabel="Try on avatar"
                    >
                      <Ionicons name="eye-outline" size={13} color="#ffffff" />
                    </Pressable>
                  </View>

                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.item_name}
                  </Text>

                  <View style={styles.priceRow}>
                    {coinPrice > 0 && (
                      <View style={styles.priceChip}>
                        <CurrencyIcon type="coin" size={12} />
                        <Text style={styles.priceText}>{coinPrice}</Text>
                      </View>
                    )}
                    {zMoneyPrice > 0 && (
                      <View style={styles.priceChip}>
                        <CurrencyIcon type="zmoney" size={11} />
                        <Text style={styles.priceText}>{zMoneyPrice}</Text>
                      </View>
                    )}
                    {isFree && <Text style={[styles.priceText, { color: '#4ade80' }]}>Free</Text>}
                  </View>

                  {itemPower > 0 && (
                    <View style={styles.powerRow}>
                      <Ionicons name="flash-outline" size={11} color="#fb923c" />
                      <Text style={styles.powerText}>+{itemPower} PWR</Text>
                    </View>
                  )}

                  {item.is_limited && (
                    <View style={styles.powerRow}>
                      <Ionicons name="shield-checkmark-outline" size={10} color="#facc15" />
                      <Text style={styles.verifiedText}>Verified only</Text>
                    </View>
                  )}

                  {/* Bulk-buy quantity stepper - free items ke liye zaroorat
                      nahi (price 0 hi rehta hai). */}
                  {!isFree && (
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={() => bumpQty(item.items_id, -1)}
                        disabled={isBuying}
                        style={[styles.stepBtn, isBuying && styles.dim]}
                      >
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>
                      <QtyInput
                        value={qty}
                        disabled={isBuying}
                        onChange={(n) => setQty(item.items_id, n)}
                      />
                      <Pressable
                        onPress={() => bumpQty(item.items_id, 1)}
                        disabled={isBuying || qty >= MAX_BUY_QTY}
                        style={[styles.stepBtn, (isBuying || qty >= MAX_BUY_QTY) && styles.dim]}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                  )}

                  <Pressable
                    onPress={() => handleBuy(item)}
                    disabled={isBuying || !canAfford}
                    style={({ pressed }) => [
                      styles.buyBtn,
                      !canAfford ? styles.buyBtnOff : styles.buyBtnOn,
                      canAfford && isBuying && styles.dim,
                      pressed && canAfford && { backgroundColor: '#22c55e' },
                    ]}
                  >
                    <Text style={[styles.buyText, !canAfford && { color: '#6e6e6e' }]}>
                      {isBuying ? 'Buying...' : isFree ? (owned > 0 ? 'Buy More' : 'Buy') : `Buy x${qty}`}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating "Limited" button - Home ke "+" FAB jaisa. Tap = sirf active
          limited items, dobara tap = wapas normal shop. */}
      <Pressable
        onPress={() => setLimitedOnly((v) => !v)}
        accessibilityLabel={limitedOnly ? 'Show all shop items' : 'Show limited items'}
        style={({ pressed }) => [
          styles.limitedFab,
          limitedOnly && styles.limitedFabOn,
          pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        ]}
      >
        <Ionicons name={limitedOnly ? 'close' : 'timer-outline'} size={limitedOnly ? 26 : 24} color="#ffffff" />
      </Pressable>

      {/* Toast */}
      {!!toast && (
        <View style={[styles.toastWrap, { top: insets.top + 64 }]} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      )}

      {/* Try On preview card - item avatar par kaisa lagega, bina equip kiye */}
      {!!previewItem && (
        <View style={styles.previewOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewItem(null)} />
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.previewLabelRow}>
                <Ionicons name="eye-outline" size={13} color="#9a9a9a" />
                <Text style={styles.previewLabel}>Preview</Text>
              </View>
              <Pressable onPress={() => setPreviewItem(null)} hitSlop={10}>
                <Ionicons name="close" size={18} color="#9a9a9a" />
              </Pressable>
            </View>

            <LinearGradient
              colors={['#262626', '#161616', '#0a0a0a']}
              style={styles.previewAvatarBox}
            >
              <AvatarLayers equippedByCategory={previewEquippedByCategory} photoUrl={myAvatarUrl} />
            </LinearGradient>

            <Text style={styles.previewName}>{previewItem.item_name}</Text>
            <Text style={styles.previewHint}>Ye sirf preview hai - item abhi equip nahi hua.</Text>

            <Pressable onPress={() => setPreviewItem(null)} style={styles.previewCloseBtn}>
              <Text style={styles.previewCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SlideInRight>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  limitedFab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  limitedFabOn: { backgroundColor: '#a16207' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  plusBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
  },
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  tabsContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  tabActive: { backgroundColor: '#e0883a' }, // star-primary-600
  tabIdle: { backgroundColor: '#161616' },
  tabText: { fontSize: 14, fontWeight: '700' },
  gridContent: { padding: GRID_PADDING, paddingBottom: 92 },
  emptyText: { color: '#6e6e6e', textAlign: 'center', marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  card: {
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 8,
    borderWidth: 2,
  },
  cardNormal: { borderColor: '#262626' },
  cardLimited: { borderColor: 'rgba(161,98,7,0.4)' }, // star-gold-700/40
  limitedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ca8a04', // yellow-600
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
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
    backgroundColor: '#f5f5f5', // star-100
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    zIndex: 10,
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,0.8)',
    borderWidth: 1,
    borderColor: '#262626',
  },
  itemName: {
    width: '100%',
    marginTop: 6,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
  powerRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  powerText: { color: '#fb923c', fontSize: 11, fontWeight: '700' },
  verifiedText: { color: '#facc15', fontSize: 10, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, width: '100%' },
  stepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  qtyInput: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 6,
    paddingVertical: 2,
  },
  buyBtn: { width: '100%', marginTop: 8, paddingVertical: 6, borderRadius: 999, alignItems: 'center' },
  buyBtnOn: { backgroundColor: '#16a34a' },
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
  previewOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  previewCard: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    backgroundColor: '#161616',
    borderWidth: 2,
    borderColor: '#262626',
    borderRadius: 16,
    padding: 16,
  },
  previewHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewLabel: { color: '#9a9a9a', fontSize: 12, fontWeight: '700' },
  previewAvatarBox: {
    width: 224, // w-56
    aspectRatio: AVATAR_ASPECT_RATIO_NUM,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#262626',
    overflow: 'hidden',
  },
  previewName: { marginTop: 12, color: '#ffffff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  previewHint: { color: '#6e6e6e', fontSize: 11, textAlign: 'center' },
  previewCloseBtn: {
    width: '100%',
    marginTop: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#262626',
    alignItems: 'center',
  },
  previewCloseText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
});

export default memo(ShopModal);