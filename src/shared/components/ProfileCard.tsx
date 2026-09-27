import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import ZoomableAvatarView from '../../features/avatar/components/ZoomableAvatarView';
import EquippedItemsModal from '../../features/avatar/components/EquippedItemsModal';
import { getEquippedByCategory } from '../utils/profileHelpers';

/**
 * equippedItems: [1,7,12,...] (player.equipped_items backend se)
 * itemsById: { 1: { items_id, item_name, item_category, ... }, ... } (items catalog)
 * In dono se equippedByCategory bana lete hain taaki avatar layers ko
 * seedha { eyes: 7, hairs: 12 } jaisa clean object mile.
 *
 * WEB -> RN CHANGES:
 * - Tailwind `w-full max-w-lg aspect-[4/5]` / `w-32 h-40` -> StyleSheet.
 * - `role="button"`/`title` -> Pressable + accessibilityLabel.
 * - NOTE: ZoomableAvatarView / EquippedItemsModal ke props web jaise hi
 *   maane hain (equippedByCategory, photoUrl, style / show, username,
 *   items, onClose). Jab woh dono files banao to yehi props rakhna.
 */
interface ProfileCardProps {
  username?: string;
  size?: 'lg' | 'sm';
  equippedItems?: (string | number)[];
  itemsById?: Record<string | number, any>;
  photoUrl?: string | null;
}

const ProfileCard = ({
  username,
  size = 'lg',
  equippedItems = [],
  itemsById = {},
  photoUrl,
}: ProfileCardProps) => {
  const [showItems, setShowItems] = useState(false);

  const equippedByCategory = useMemo(
    () => getEquippedByCategory(equippedItems, itemsById),
    [equippedItems, itemsById]
  );
  const equippedItemObjects = useMemo(
    () => equippedItems.map((id) => itemsById[id]).filter((item) => item?.item_category),
    [equippedItems, itemsById]
  );

  return (
    <>
      <Pressable
        onPress={() => setShowItems(true)}
        accessibilityRole="button"
        accessibilityLabel="Tap to see equipped items"
        style={size === 'lg' ? styles.lg : styles.sm}
      >
        <ZoomableAvatarView
          style={styles.fill}
          equippedByCategory={equippedByCategory}
          photoUrl={photoUrl}
        />
      </Pressable>

      <EquippedItemsModal
        show={showItems}
        username={username}
        items={equippedItemObjects}
        onClose={() => setShowItems(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  lg: {
    width: '100%',
    maxWidth: 512,
    aspectRatio: 4 / 5,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sm: {
    width: 128,
    height: 160,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});

export default memo(ProfileCard);