import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { FadeIn, CardPop } from '../../../shared/components/motion/ScreenTransition';
import { getAssetUrl, CATEGORY_LABELS } from '../utils/avatarAssets';
import SvgAssetView from './SvgAssetView';

/**
 * show: modal khula hai kya (bool)
 * username: kiska avatar hai - popup title me dikhta hai
 * items: [{ items_id, item_name, item_category, power? }, ...] - jo bhi
 *        categories equip hain, unke catalog objects (ProfileCard se
 *        already-resolved, so yahan koi lookup nahi karna padta)
 * onClose: popup band karo
 *
 * WEB -> RN CHANGES:
 * - `fixed inset-0` overlay -> in-tree absoluteFill overlay + useTopZIndex
 *   (TipModal jaisa hi pattern; parent full-screen View ho). Backdrop tap =
 *   full-screen Pressable, card uske upar alag sibling hai (isliye
 *   stopPropagation ki zaroorat nahi).
 * - `overflow-y-auto` -> ScrollView; `truncate` -> numberOfLines={1}.
 * - Thumbnail: web AvatarItemThumb `url` (string) leta tha, lekin RN mein
 *   getAssetUrl() ab SVG COMPONENT deta hai (string URL nahi) - isliye yahan
 *   component seedha 44x44 box me render karte hain (svgBBox ka RN version
 *   waise bhi crop nahi karta, to visual result same hai).
 * - Android hardware back = close (useBackButtonHandler).
 */
interface EquippedItem {
  items_id: string | number;
  item_name?: string;
  item_category: string;
  power?: number;
}

interface EquippedItemsModalProps {
  show: boolean;
  username?: string;
  items?: EquippedItem[];
  onClose: () => void;
}

const ItemThumb = memo(({ category, itemsId }: { category: string; itemsId: string | number }) => {
  return (
    <SvgAssetView
      asset={getAssetUrl(category, itemsId)}
      fallback={<Text style={styles.noPreview}>No preview</Text>}
    />
  );
});
ItemThumb.displayName = 'ItemThumb';

const EquippedItemsModal = ({ show, username, items = [], onClose }: EquippedItemsModalProps) => {
  const zIndex = useTopZIndex(show);
  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  return (
    <FadeIn show={show} style={[styles.overlay, { zIndex, elevation: 20 }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

      <View style={styles.center} pointerEvents="box-none">
        <CardPop style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {username ? `${username}'s Items` : 'Equipped Items'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={18} color="#9a9a9a" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {items.length === 0 ? (
              <Text style={styles.empty}>No items equipped.</Text>
            ) : (
              items.map((item) => {
                const itemPower = item.power || 0;
                return (
                  <View key={item.items_id} style={styles.row}>
                    <View style={styles.thumb}>
                      <ItemThumb category={item.item_category} itemsId={item.items_id} />
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.item_name}
                      </Text>
                      <Text style={styles.category}>
                        {CATEGORY_LABELS[item.item_category as keyof typeof CATEGORY_LABELS] || item.item_category}
                      </Text>
                    </View>
                    {itemPower > 0 && (
                      <View style={styles.power}>
                        <Ionicons name="flash-outline" size={12} color="#fb923c" />
                        <Text style={styles.powerText}>{itemPower}</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </CardPop>
      </View>
    </FadeIn>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 384,
    maxHeight: '70%',
    backgroundColor: '#161616', // star-800
    borderWidth: 1,
    borderColor: '#262626', // star-700
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  title: {
    flexShrink: 1,
    marginRight: 12,
    fontWeight: '700',
    fontSize: 16,
    color: '#ffffff',
  },
  body: {
    padding: 16,
    gap: 10,
  },
  empty: {
    color: '#6e6e6e', // star-500
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0a0a0a', // star-900
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    padding: 10,
  },
  thumb: {
    width: 44,
    height: 44,
    flexShrink: 0,
    backgroundColor: '#161616',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPreview: {
    fontSize: 9,
    color: '#6e6e6e',
    textAlign: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: '700',
    fontSize: 14,
    color: '#ffffff',
  },
  category: {
    fontSize: 12,
    color: '#9a9a9a', // star-400
    marginTop: 2,
  },
  power: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  powerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fb923c', // star-warn-400
  },
});

export default memo(EquippedItemsModal);