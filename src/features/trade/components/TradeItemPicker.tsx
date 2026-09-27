import React, { memo, useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AvatarItemThumb from '../../avatar/components/AvatarItemThumb';
import { getAssetUrl } from '../../avatar/utils/avatarAssets';
import useInventory from '../../../shared/hooks/useInventory';
import useItemsCatalog from '../../../shared/hooks/useItemsCatalog';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';

/**
 * Trade ke liye items choose karne ki full-screen list (apni inventory se).
 *
 * WEB -> RN CHANGES:
 * - `grid grid-cols-2` -> FlatList numColumns={2}.
 * - `fixed inset-0` -> absolute fill + safe-area padding.
 * - Default (free-starter) / equipped items abhi bhi trade nahi hote -
 *   +/- disable ki jagah hide karke chhota note dikhate hain (web jaisa).
 */
interface TradeItemPickerProps {
  show: boolean;
  offeredItems: Record<string, number>;
  onChangeQty: (itemId: number, qty: number) => void;
  onClose: () => void;
}

const TradeItemPicker = ({ show, offeredItems, onChangeQty, onClose }: TradeItemPickerProps) => {
  const zIndex = useTopZIndex(show);
  const insets = useSafeAreaInsets();
  const { itemsById, loading: catalogLoading } = useItemsCatalog();
  const { quantities, equippedIds, loading: invLoading, refresh } = useInventory();

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  useEffect(() => {
    if (show) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const loading = catalogLoading || invLoading;
  const ownedItemIds = Object.keys(quantities).filter((id) => (quantities[id] || 0) > 0);

  const renderItem = ({ item: idStr }: { item: string }) => {
    const itemId = Number(idStr);
    const item = (itemsById as any)[itemId];
    if (!item) return <View style={styles.cardSpacer} />;
    const owned = quantities[idStr] || 0;
    const offered = (offeredItems as any)?.[itemId] || 0;
    const asset = getAssetUrl(item.item_category, itemId);
    const isDefault = !!item.is_default;
    const isEquipped = equippedIds.map(String).includes(String(itemId));
    const isLocked = isDefault || isEquipped;

    return (
      <View style={[styles.card, offered > 0 && styles.cardActive, isLocked && styles.cardLocked]}>
        <View style={styles.ownedBadge}>
          <Text style={styles.ownedBadgeText}>Owned x{owned}</Text>
        </View>

        <View style={styles.thumb}>
          <AvatarItemThumb asset={asset} alt={item.item_name} />
        </View>

        <Text style={styles.itemName} numberOfLines={1}>
          {item.item_name}
        </Text>

        {isEquipped ? (
          <Text style={styles.noteDanger}>Can't trade equipped item</Text>
        ) : isDefault ? (
          <Text style={styles.noteMuted}>Not tradeable</Text>
        ) : (
          <View style={styles.qtyRow}>
            <Pressable
              onPress={() => onChangeQty(itemId, Math.max(0, offered - 1))}
              disabled={offered <= 0}
              style={[styles.qtyBtn, offered <= 0 && styles.qtyBtnDisabled]}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={styles.qtyValue}>{offered}</Text>
            <Pressable
              onPress={() => onChangeQty(itemId, Math.min(owned, offered + 1))}
              disabled={offered >= owned}
              style={[styles.qtyBtn, offered >= owned && styles.qtyBtnDisabled]}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <SlideInRight show={show} style={[styles.screen, { zIndex, elevation: 30, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={16} color="#ffffff" />
          <Text style={styles.headerBtnText}>Done</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add Items</Text>
        <View style={{ width: 56 }} />
      </View>

      {loading ? (
        <Text style={styles.emptyText}>Loading...</Text>
      ) : ownedItemIds.length === 0 ? (
        <Text style={styles.emptyText}>You don't have any items.</Text>
      ) : (
        <FlatList
          data={ownedItemIds}
          keyExtractor={(id) => id}
          numColumns={2}
          renderItem={renderItem}
          columnWrapperStyle={styles.columnWrap}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        />
      )}
    </SlideInRight>
  );
};

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a0a' },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 56 },
  headerBtnText: { color: '#ffffff' },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  emptyText: { color: '#6e6e6e', textAlign: 'center', marginTop: 24 },
  listContent: { padding: 16, gap: 12 },
  columnWrap: { gap: 12 },
  cardSpacer: { flex: 1 },
  card: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 8,
    borderWidth: 2,
    borderColor: '#262626',
  },
  cardActive: { borderColor: '#6366f1' },
  cardLocked: { opacity: 0.6 },
  ownedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: '#262626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  ownedBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  itemName: { fontSize: 12, fontWeight: '700', color: '#ffffff', marginTop: 6, width: '100%', textAlign: 'center' },
  noteDanger: { fontSize: 10, color: '#f87171', marginTop: 8, marginBottom: 4, textAlign: 'center' },
  noteMuted: { fontSize: 10, color: '#6e6e6e', marginTop: 8, marginBottom: 4, textAlign: 'center' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8, width: '100%' },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  qtyValue: { color: '#ffffff', fontWeight: '700', width: 24, textAlign: 'center' },
});

export default memo(TradeItemPicker);