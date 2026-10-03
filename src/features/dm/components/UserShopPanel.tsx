import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CurrencyIcon from '../../../shared/components/CurrencyIcon';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { showAlert } from '../../../shared/utils/alertBus';
import useInventory from '../../../shared/hooks/useInventory';
import AvatarItemThumb from '../../avatar/components/AvatarItemThumb';
import { getAssetUrl } from '../../avatar/utils/avatarAssets';

// Highrise jaisa "For Sale" board - profile ke "Store" tab mein dikhta hai.
// Doosron ke liye: apne items browse karo, tap karo to price dikhe +
// "Send message to user?" option (DM khul jaata hai, message pehle se
// type hota hai par bhejta khud user hi hai).
// Apne liye: "Add Item" (max 6 slots, default 2 free, aage 100 z_money/slot).
//
// WEB -> RN CHANGES:
// - localStorage token -> getToken() (NetworkManager).
// - `fixed inset-0 z-[220]` popups (ItemActionSheet, AddItemModal) ->
//   RN <Modal transparent>. Yeh panel profile modal/ScrollView ke ANDAR
//   render hota hai, isliye in-tree absoluteFill overlay sirf panel ke
//   box tak seemit rehta - <Modal> apni alag native window me aata hai, to
//   zIndex / useTopZIndex / useBackButtonHandler ki zaroorat nahi
//   (Android back = onRequestClose).
// - `sm:items-center` (desktop) hata diya - sirf phone bottom-sheet.
// - Grid: onLayout se panel ki width naap ke 2 equal columns.
// - hover/cursor styles hata di; Tailwind opacity colors rgba se.
// - `<input type=number>` -> numeric TextInput (non-digits filter).

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// itemname ke spaces hata ke #itemname jaisa chhota tag - isse tap karne
// par Posts ke hashtag jaisa hi hashtag search khul jaata hai.
const toHashtag = (name?: string | null) => (name || '').replace(/\s+/g, '');

const GRID_GAP = 12;
const SHEET_MAX_W = 384; // sm:max-w-sm

const HashtagPill = ({
  tag,
  small,
  onPress,
}: {
  tag: string;
  small?: boolean;
  onPress?: () => void;
}) => (
  <Pressable onPress={onPress} style={[styles.hashPill, small && styles.hashPillSmall]}>
    <Ionicons name="pricetag-outline" size={9} color="#f6bc7a" />
    <Text style={styles.hashText}>{tag}</Text>
  </Pressable>
);

// ---- Item tap karne par: price dikhao + "Send message?" confirm ----
interface ItemActionSheetProps {
  item: any | null;
  itemInfo: any | null;
  sellerUsername?: string;
  onClose: () => void;
  onSendMessage: (itemInfo: any) => void;
  onOpenHashtag?: (tag: string) => void;
}

const ItemActionSheet = ({
  item,
  itemInfo,
  sellerUsername,
  onClose,
  onSendMessage,
  onOpenHashtag,
}: ItemActionSheetProps) => {
  const insets = useSafeAreaInsets();
  const asset = itemInfo ? getAssetUrl(itemInfo.item_category, itemInfo.items_id) : null;

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        {!!item && (
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {itemInfo?.item_name || 'Item'}
              </Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={20} color="#9a9a9a" />
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.actionThumb}>
                <AvatarItemThumb asset={asset} alt={itemInfo?.item_name} />
              </View>
              <View style={styles.flex}>
                <HashtagPill
                  tag={toHashtag(itemInfo?.item_name)}
                  onPress={() => onOpenHashtag?.(toHashtag(itemInfo?.item_name))}
                />
                <View style={styles.priceRowLg}>
                  <CurrencyIcon type="zmoney" size={16} />
                  <Text style={styles.priceLg}>{Number(item.price).toLocaleString()}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.askText}>Send message to {sellerUsername} about this item?</Text>

            <View style={styles.btnRow}>
              <Pressable onPress={onClose} style={[styles.pillBtn, styles.pillBtnGhost]}>
                <Text style={styles.pillBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => onSendMessage(itemInfo)}
                style={({ pressed }) => [
                  styles.pillBtn,
                  styles.pillBtnPrimary,
                  pressed && { backgroundColor: '#f2a65a' },
                ]}
              >
                <Text style={styles.pillBtnText}>OK</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ---- Apni shop mein item add karne ka picker (sirf owner ke liye) ----
interface AddItemModalProps {
  show: boolean;
  itemsById: Record<string, any>;
  ownedIds: (string | number)[];
  alreadyListedIds: Set<string | number>;
  onClose: () => void;
  onAdded: () => void;
}

const AddItemModal = ({ show, itemsById, ownedIds, alreadyListedIds, onClose, onAdded }: AddItemModalProps) => {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const [step, setStep] = useState<'pick' | 'price'>('pick');
  const [pickedId, setPickedId] = useState<string | number | null>(null);
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setStep('pick');
      setPickedId(null);
      setPrice('');
      setError('');
    }
  }, [show]);

  // Default items trade/list nahi ho sakte, aur jo already list hain wo dobara nahi.
  const pickable = ownedIds.filter((id) => {
    const info = itemsById[id];
    return info && !info.is_default && !alreadyListedIds.has(id);
  });

  const submit = async () => {
    const priceNum = parseInt(price, 10);
    if (!pickedId || !priceNum || priceNum <= 0) {
      setError('Ek item chuno aur sahi price daalo.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await axios.post(
        `${API_BASE}/user-shop/add`,
        { item_id: pickedId, price: priceNum },
        { headers: authHeaders() }
      );
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Item add nahi ho paya.');
    } finally {
      setSubmitting(false);
    }
  };

  const pickedInfo = pickedId != null ? itemsById[pickedId] : null;
  // sheet ki inner width = min(screen, 384) - 2*20 padding; 3 columns, gap 8
  const innerW = Math.min(screenW, SHEET_MAX_W) - 40;
  const pickCardW = (innerW - 16) / 3;

  return (
    <Modal visible={show} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
          <View style={[styles.sheet, styles.addSheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{step === 'pick' ? 'Choose an item' : 'Set price'}</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={20} color="#9a9a9a" />
              </Pressable>
            </View>

            {step === 'pick' ? (
              <ScrollView contentContainerStyle={styles.pickGrid}>
                {pickable.length === 0 && (
                  <Text style={[styles.emptyText, { width: '100%' }]}>
                    Koi aur item nahi hai jo list kiya ja sake.
                  </Text>
                )}
                {pickable.map((id) => {
                  const info = itemsById[id];
                  const asset = getAssetUrl(info.item_category, info.items_id);
                  return (
                    <Pressable
                      key={id}
                      onPress={() => {
                        setPickedId(id);
                        setStep('price');
                      }}
                      style={[styles.pickCard, { width: pickCardW }]}
                    >
                      <View style={styles.pickThumb}>
                        <AvatarItemThumb asset={asset} alt={info.item_name} />
                      </View>
                      <Text style={styles.pickName} numberOfLines={1}>
                        {info.item_name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.priceStep}>
                <View style={styles.pickedRow}>
                  <View style={styles.pickedThumb}>
                    <AvatarItemThumb
                      asset={pickedInfo ? getAssetUrl(pickedInfo.item_category, pickedId) : null}
                      alt={pickedInfo?.item_name}
                    />
                  </View>
                  <Text style={styles.pickedName} numberOfLines={1}>
                    {pickedInfo?.item_name}
                  </Text>
                </View>

                <View style={styles.priceInputRow}>
                  <CurrencyIcon type="zmoney" size={16} />
                  <TextInput
                    value={price}
                    onChangeText={(t) => {
                      setError('');
                      setPrice(t.replace(/[^0-9]/g, ''));
                    }}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    autoFocus
                    placeholder="Price in z_money"
                    placeholderTextColor="#6e6e6e"
                    style={styles.priceInput}
                  />
                </View>

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <View style={styles.btnRow}>
                  <Pressable onPress={() => setStep('pick')} style={[styles.pillBtn, styles.pillBtnGhost]}>
                    <Text style={styles.pillBtnText}>Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={submit}
                    disabled={submitting}
                    style={({ pressed }) => [
                      styles.pillBtn,
                      styles.pillBtnPrimary,
                      submitting && styles.dim,
                      pressed && { backgroundColor: '#f2a65a' },
                    ]}
                  >
                    <Text style={styles.pillBtnText}>{submitting ? 'Adding...' : 'List Item'}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface Slots {
  unlocked_slots: number;
  used_slots: number;
  max_slots?: number;
  expand_cost?: number;
  can_expand?: boolean;
}

interface UserShopPanelProps {
  userId?: string | number | null;
  username?: string;
  isMe?: boolean;
  itemsById: Record<string, any>;
  onSendMessage?: (itemInfo: any) => void;
  onOpenHashtag?: (tag: string) => void;
}

const UserShopPanel = ({
  userId,
  username,
  isMe,
  itemsById,
  onSendMessage,
  onOpenHashtag,
}: UserShopPanelProps) => {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slots | null>(null); // { unlocked_slots, used_slots, max_slots, expand_cost, can_expand }
  const [actionItem, setActionItem] = useState<any | null>(null); // listing jiska action-sheet khula hai
  const [showAddModal, setShowAddModal] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [gridW, setGridW] = useState(0);
  const { ownedIds, refresh: refreshInventory } = useInventory();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/user-shop/${userId}`);
      setListings(res.data?.items || []);
    } catch (err: any) {
      console.error('User shop load error:', err.response?.data || err.message);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadSlots = useCallback(async () => {
    if (!isMe) return;
    try {
      const res = await axios.get(`${API_BASE}/user-shop/slots/me`, { headers: authHeaders() });
      setSlots(res.data);
    } catch (err: any) {
      console.error('Shop slots load error:', err.response?.data || err.message);
    }
  }, [isMe]);

  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  useEffect(() => {
    loadSlots();
  }, [isMe, userId, loadSlots]);

  const removeItem = async (listingId: string | number) => {
    try {
      await axios.delete(`${API_BASE}/user-shop/item/${listingId}`, { headers: authHeaders() });
      setListings((prev) => prev.filter((l) => l.id !== listingId));
      loadSlots();
    } catch (err: any) {
      console.error('Remove shop item error:', err.response?.data || err.message);
    }
  };

  const expandSlot = async () => {
    setExpanding(true);
    try {
      const res = await axios.post(`${API_BASE}/user-shop/expand-slot`, null, { headers: authHeaders() });
      setSlots((prev) =>
        prev
          ? {
              ...prev,
              unlocked_slots: res.data.unlocked_slots,
              can_expand: res.data.unlocked_slots < (prev.max_slots || 6),
            }
          : prev
      );
    } catch (err: any) {
      showAlert(err.response?.data?.detail || 'Slot unlock nahi ho paya.');
    } finally {
      setExpanding(false);
    }
  };

  const onGridLayout = (e: LayoutChangeEvent) => setGridW(e.nativeEvent.layout.width);

  const alreadyListedIds = new Set<string | number>(listings.map((l) => l.item_id));
  const cardW = gridW > 0 ? (gridW - GRID_GAP) / 2 : undefined;
  const hasFreeSlot = !!slots && slots.used_slots < slots.unlocked_slots;

  if (loading) {
    return <Text style={styles.emptyText}>Loading store...</Text>;
  }

  return (
    <View>
      {isMe && slots && (
        <View style={styles.slotsBar}>
          <Text style={styles.slotsLabel}>
            <Text style={styles.slotsCount}>
              {slots.used_slots}/{slots.unlocked_slots}
            </Text>{' '}
            slots used
          </Text>
          {slots.can_expand && (
            <Pressable onPress={expandSlot} disabled={expanding} style={[styles.unlockBtn, expanding && styles.dim]}>
              <Ionicons name="lock-closed-outline" size={12} color="#f6bc7a" />
              <Text style={styles.unlockText}>
                {expanding ? 'Unlocking...' : `Unlock +1 slot (${slots.expand_cost} z_money)`}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.grid} onLayout={onGridLayout}>
        {gridW > 0 &&
          listings.map((listing) => {
            const info = itemsById[listing.item_id];
            const asset = info ? getAssetUrl(info.item_category, info.items_id) : null;
            return (
              <Pressable
                key={listing.id}
                onPress={() => setActionItem(listing)}
                disabled={!!isMe}
                style={[styles.card, { width: cardW }]}
              >
                {isMe && (
                  <Pressable
                    onPress={() => removeItem(listing.id)}
                    style={styles.removeX}
                    accessibilityLabel="Remove from shop"
                    hitSlop={6}
                  >
                    <Ionicons name="close" size={14} color="#9a9a9a" />
                  </Pressable>
                )}
                <View style={styles.cardThumb}>
                  <AvatarItemThumb asset={asset} alt={info?.item_name} />
                </View>
                <Text style={styles.cardName} numberOfLines={1}>
                  {info?.item_name || 'Item'}
                </Text>
                <View style={styles.pillWrap}>
                  <HashtagPill
                    small
                    tag={toHashtag(info?.item_name)}
                    onPress={() => onOpenHashtag?.(toHashtag(info?.item_name))}
                  />
                </View>
                <View style={styles.priceRowSm}>
                  <CurrencyIcon type="zmoney" size={12} />
                  <Text style={styles.priceSm}>{Number(listing.price).toLocaleString()}</Text>
                </View>
                {isMe && (
                  <Pressable onPress={() => removeItem(listing.id)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}

        {gridW > 0 && isMe && hasFreeSlot && (
          <Pressable onPress={() => setShowAddModal(true)} style={[styles.addCard, { width: cardW }]}>
            <Ionicons name="add" size={22} color="#9a9a9a" />
            <Text style={styles.addText}>Add Item</Text>
          </Pressable>
        )}
      </View>

      {listings.length === 0 && !(isMe && hasFreeSlot) && (
        <Text style={styles.emptyText}>
          {isMe ? 'Store empty hai - kuch add karo!' : 'User ne abhi kuch bhi list nahi kiya.'}
        </Text>
      )}

      <ItemActionSheet
        item={actionItem}
        itemInfo={actionItem ? itemsById[actionItem.item_id] : null}
        sellerUsername={username}
        onClose={() => setActionItem(null)}
        onSendMessage={(itemInfo) => {
          setActionItem(null);
          onSendMessage?.(itemInfo);
        }}
        onOpenHashtag={(tag) => {
          setActionItem(null);
          onOpenHashtag?.(tag);
        }}
      />

      <AddItemModal
        show={showAddModal}
        itemsById={itemsById}
        ownedIds={ownedIds}
        alreadyListedIds={alreadyListedIds}
        onClose={() => setShowAddModal(false)}
        onAdded={() => {
          load();
          loadSlots();
          refreshInventory();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.5 },
  emptyText: { color: '#6e6e6e', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  errorText: { color: '#f87171', fontSize: 14 },

  // panel
  slotsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  slotsLabel: { color: '#9a9a9a', fontSize: 14 },
  slotsCount: { color: '#ffffff', fontWeight: '700' },
  unlockBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unlockText: { color: '#f6bc7a', fontSize: 14, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  card: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    padding: 12,
  },
  removeX: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,0.9)',
    borderWidth: 1,
    borderColor: '#262626',
  },
  cardThumb: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cardName: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  pillWrap: { flexDirection: 'row', marginTop: 2 },
  priceRowSm: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  priceSm: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  removeBtn: {
    marginTop: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(220,38,38,0.15)', // star-danger-600/15
  },
  removeBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
  addCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#262626',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 32,
  },
  addText: { color: '#9a9a9a', fontSize: 14, fontWeight: '700' },

  // hashtag pill
  hashPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(224,136,58,0.2)', // star-primary-600/20
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  hashPillSmall: { paddingHorizontal: 6 },
  hashText: { color: '#f6bc7a', fontSize: 10, fontWeight: '700' }, // star-primary-400

  // popups (Modal)
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_W,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  addSheet: { maxHeight: '85%' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: { flexShrink: 1, marginRight: 12, color: '#ffffff', fontWeight: '700', fontSize: 18 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  actionThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  priceRowLg: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  priceLg: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  askText: { color: '#9a9a9a', fontSize: 14, marginBottom: 16 },
  btnRow: { flexDirection: 'row', gap: 8 },
  pillBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  pillBtnGhost: { backgroundColor: '#0a0a0a' },
  pillBtnPrimary: { backgroundColor: '#e0883a' }, // star-primary-600
  pillBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  // add-item picker
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickCard: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  pickThumb: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  pickName: { width: '100%', marginTop: 4, textAlign: 'center', color: '#ffffff', fontSize: 11, fontWeight: '700' },
  priceStep: { gap: 12 },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    padding: 12,
  },
  pickedThumb: { width: 56, height: 56 },
  pickedName: { flex: 1, color: '#ffffff', fontWeight: '700', fontSize: 16 },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  priceInput: { flex: 1, color: '#ffffff', fontSize: 16, paddingVertical: 12 },
});

export default memo(UserShopPanel);