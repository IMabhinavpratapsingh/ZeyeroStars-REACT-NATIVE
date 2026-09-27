import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { getEquippedByCategory } from '../../../shared/utils/profileHelpers';
import useItemsCatalog from '../../../shared/hooks/useItemsCatalog';
import useInventory from '../../../shared/hooks/useInventory';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import ZoomableAvatarView from '../../avatar/components/ZoomableAvatarView';
import AvatarItemThumb from '../../avatar/components/AvatarItemThumb';
import type { EquippedByCategory } from '../../avatar/components/AvatarLayers';
import {
  getAssetUrl,
  CATEGORY_FOLDERS,
  CATEGORY_LABELS,
  MULTI_SELECT_CATEGORIES,
  MAX_MULTI_SELECT,
} from '../../avatar/utils/avatarAssets';

// Skin-color customization hata di gayi hai - avatar ab hamesha
// AvatarBase ke fixed default color me render hota hai.
const TABS: string[] = [...CATEGORY_FOLDERS];
const EMPTY_IDS: (string | number)[] = [];

const GRID_PADDING = 16;
const GRID_GAP = 12;

const isMulti = (cat: string) => (MULTI_SELECT_CATEGORIES as string[]).includes(cat);

/**
 * currentEquippedIds: player.equipped_items (array of item ids) - jo save hai
 * photoUrl: user ki avatar photo (live URL - cache ke through nahi)
 * onClose: modal band karo
 * onSaved: ({ equippedIds }) => ... - save hone ke baad Dashboard/Profile
 *   ko naya data dedo
 *
 * WEB -> RN CHANGES:
 * - `fixed inset-0` -> in-tree absoluteFill overlay + useTopZIndex(true)
 *   (parent full-screen View ho); top par status-bar ke liye insets.top.
 * - localStorage token -> getToken().
 * - Preview box w-64 h-80 -> 256x320 + expo-linear-gradient background;
 *   ZoomableAvatarView ko `style` (web ka className) milta hai.
 * - AvatarItemThumb ab `asset` prop leta hai (url nahi).
 * - Hover/transition styles hata di (touch par kaam ke nahi).
 */
interface AvatarCustomizeModalProps {
  currentEquippedIds?: (string | number)[];
  photoUrl?: string | null;
  onClose: () => void;
  onSaved?: (data: { equippedIds: (string | number)[] }) => void;
}

const AvatarCustomizeModal = ({
  currentEquippedIds = EMPTY_IDS,
  photoUrl = null,
  onClose,
  onSaved,
}: AvatarCustomizeModalProps) => {
  const zIndex = useTopZIndex(true);
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { itemsById, loading: catalogLoading } = useItemsCatalog();
  const { ownedIds, quantities, loading: invLoading } = useInventory();

  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [equippedByCategory, setEquippedByCategory] = useState<EquippedByCategory>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(true, handleClose);

  // Jab catalog load ho jaye, currentEquippedIds ko category-wise map bana lo
  useEffect(() => {
    if (catalogLoading) return;
    setEquippedByCategory(getEquippedByCategory(currentEquippedIds, itemsById));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogLoading]);

  const ownedItemsInCategory = useMemo(
    () =>
      Object.values(itemsById).filter(
        (item: any) => item.item_category === activeTab && ownedIds.includes(item.items_id)
      ),
    [itemsById, ownedIds, activeTab]
  );

  const handleTap = (item: any) => {
    const cat: string = item.item_category;
    setEquippedByCategory((prev) => {
      if (isMulti(cat)) {
        const current = (prev[cat] as (string | number)[] | undefined) || [];
        if (current.includes(item.items_id)) {
          // Dobara tap - unequip (list se hata do)
          return { ...prev, [cat]: current.filter((id) => id !== item.items_id) };
        }
        // Naya select - end me add karo. MAX_MULTI_SELECT (5) se zyada ho
        // gaye to sabse PURANA (sabse pehle select kiya hua) hata do - FIFO.
        let next = [...current, item.items_id];
        if (next.length > MAX_MULTI_SELECT) {
          next = next.slice(next.length - MAX_MULTI_SELECT);
        }
        return { ...prev, [cat]: next };
      }
      // Single-select category (background/frame): sirf ek hi ho sakta hai
      if (prev[cat] === item.items_id) {
        // Dobara tap - unequip
        const next = { ...prev };
        delete next[cat];
        return next;
      }
      // Naya select - is category ka pehle wala replace ho jayega
      return { ...prev, [cat]: item.items_id };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const item_ids = Object.values(equippedByCategory)
        .filter((v) => v != null)
        .flatMap((v) => (Array.isArray(v) ? v : [v as string | number]));

      const equipRes = await axios.post(`${API_BASE}/inventory/equip`, { item_ids }, { headers });

      onSaved?.({
        equippedIds: equipRes.data?.equipped_items || item_ids,
      });
      onClose();
    } catch (err: any) {
      console.error('Avatar save error:', err.response?.data || err.message);
      setErrorMsg(err.response?.data?.detail || "Couldn't save, try again.");
    } finally {
      setSaving(false);
    }
  };

  const loading = catalogLoading || invLoading;
  const cardWidth = (screenW - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

  return (
    <View style={[styles.screen, { zIndex, elevation: 20, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={16} color="#ffffff" />
          <Text style={styles.headerBtnText}>Close</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Customize Avatar</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving || loading}
          style={[styles.saveBtn, (saving || loading) && styles.dim]}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>

      {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

      {/* Live preview */}
      <View style={styles.previewRow}>
        <LinearGradient colors={['#262626', '#161616', '#0a0a0a']} style={styles.previewBox}>
          <ZoomableAvatarView
            style={styles.fill}
            equippedByCategory={equippedByCategory}
            photoUrl={photoUrl}
          />
        </LinearGradient>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((tab) => {
          const multi = isMulti(tab);
          const count = multi ? ((equippedByCategory[tab] as (string | number)[] | undefined) || []).length : 0;
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, active ? styles.tabActive : styles.tabIdle]}
            >
              <Text style={[styles.tabText, { color: active ? '#ffffff' : '#9a9a9a' }]}>
                {(CATEGORY_LABELS as Record<string, string>)[tab] || tab}
                {multi ? ` (${count}/${MAX_MULTI_SELECT})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Item grid */}
      <ScrollView style={styles.flex} contentContainerStyle={styles.gridContent}>
        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : ownedItemsInCategory.length === 0 ? (
          <Text style={styles.emptyText}>You don't have any items in this category. Buy from the shop!</Text>
        ) : (
          <View style={styles.grid}>
            {ownedItemsInCategory.map((item: any) => {
              const asset = getAssetUrl(item.item_category, item.items_id);
              const isEquipped = isMulti(item.item_category)
                ? ((equippedByCategory[item.item_category] as (string | number)[] | undefined) || []).includes(
                    item.items_id
                  )
                : equippedByCategory[item.item_category] === item.items_id;
              const qty = quantities[item.items_id] || 1;
              return (
                <Pressable
                  key={item.items_id}
                  onPress={() => handleTap(item)}
                  style={[
                    styles.card,
                    { width: cardWidth },
                    isEquipped ? styles.cardEquipped : styles.cardIdle,
                  ]}
                >
                  {/* Highrise jaisa duplicate count badge - agar 1 se zyada copies hain */}
                  {qty > 1 && (
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyText}>x{qty}</Text>
                    </View>
                  )}
                  <View style={styles.thumbBox}>
                    <AvatarItemThumb asset={asset} alt={item.item_name} />
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.item_name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  dim: { opacity: 0.5 },
  screen: {
    ...StyleSheet.absoluteFill,
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
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  saveBtn: {
    backgroundColor: '#16a34a', // star-success-600
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  saveText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  errorText: {
    color: '#f87171', // star-danger-400
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  previewRow: { alignItems: 'center', paddingVertical: 16 },
  previewBox: {
    width: 256, // w-64
    height: 320, // h-80
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#262626', // star-700
    overflow: 'hidden',
  },
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  tabsContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  tabActive: { backgroundColor: '#e0883a' }, // star-primary-600
  tabIdle: { backgroundColor: '#161616' },
  tabText: { fontSize: 14, fontWeight: '700' },
  gridContent: { padding: GRID_PADDING, paddingBottom: 32 },
  emptyText: { color: '#6e6e6e', textAlign: 'center', marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  card: {
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 8,
    borderWidth: 2,
  },
  cardIdle: { borderColor: '#262626' },
  cardEquipped: {
    borderColor: '#22c55e', // star-success-500
    shadowColor: '#22c55e',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  qtyBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
    backgroundColor: '#eab308', // star-gold-500
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  qtyText: { color: '#0a0a0a', fontSize: 10, fontWeight: '700' },
  thumbBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f5f5f5', // star-100
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
});

export default memo(AvatarCustomizeModal);