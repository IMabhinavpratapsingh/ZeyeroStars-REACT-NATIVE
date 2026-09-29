import React, { memo, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AvatarItemThumb from '../../avatar/components/AvatarItemThumb';
import { getAssetUrl } from '../../avatar/utils/avatarAssets';
import useItemsCatalog from '../../../shared/hooks/useItemsCatalog';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { calculateZMoneyCost, isValidZMoneyAmount } from '../../../shared/utils/zmoney';
import TradeItemPicker from './TradeItemPicker';
import { Easing } from 'react-native-reanimated';

/**
 * trade: {
 *   trade_id, myId, otherId, otherUsername,
 *   offers: { [userId]: { items: { item_id: qty }, z_money } },
 *   confirmed: { [userId]: bool },
 * } | null
 *
 * Flow web jaisa hi: dono taraf "Confirm" dabana padta hai, koi bhi offer
 * change kare to confirm reset (backend handle karta hai). Sirf items +
 * Z Money, coins nahi. "You will charge" box type karte hi LIVE update.
 *
 * embedded: true -> DMChatWindow ke andar inline card. false -> full-screen.
 *
 * WEB -> RN CHANGES:
 * - `<input type=number>` -> TextInput keyboardType="number-pad";
 *   Enter -> onSubmitEditing, onBlur -> applyZMoney (same).
 * - `grid-cols-3` -> flexWrap row (31% width).
 * - `max-h-[60vh] overflow-y-auto` -> ScrollView maxHeight = 60% of window.
 * - `motion.div` height:'auto' animate RN mein reliable nahi - sirf
 *   opacity + translateY animate kiya.
 */
interface Offer {
  items: Record<string, number>;
  z_money: number;
}
interface TradeState {
  trade_id: string | number;
  myId: string | number;
  otherId: string | number;
  otherUsername?: string;
  offers: Record<string, Offer>;
  confirmed: Record<string, boolean>;
}
interface TradeModalProps {
  trade: TradeState | null;
  myBalance?: { z_money?: number } | null;
  onUpdateOffer: (items: Record<string, number>, zMoney: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  embedded?: boolean;
}

const EMPTY_OFFER: Offer = { items: {}, z_money: 0 };

const TradeModal = ({ trade, myBalance, onUpdateOffer, onConfirm, onCancel, embedded = false }: TradeModalProps) => {
  const zIndex = useTopZIndex(!embedded && !!trade);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { itemsById } = useItemsCatalog();
  const [showPicker, setShowPicker] = useState(false);
  const [zMoneyInput, setZMoneyInput] = useState('');

  const handleCancel = useStableCallback(() => onCancel?.());
  useBackButtonHandler(!embedded && !!trade, handleCancel);

  const myOffer: Offer = trade ? trade.offers[trade.myId] || EMPTY_OFFER : EMPTY_OFFER;
  const otherOffer: Offer = trade ? trade.offers[trade.otherId] || EMPTY_OFFER : EMPTY_OFFER;

  // Server se naya offer aaye to input ko us value se sync rakho.
  useEffect(() => {
    setZMoneyInput(myOffer.z_money > 0 ? String(myOffer.z_money) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade?.trade_id, myOffer.z_money]);

  if (!trade) return null;

  const myConfirmed = !!trade.confirmed[trade.myId];
  const otherConfirmed = !!trade.confirmed[trade.otherId];

  const zMoneyValid = zMoneyInput.trim() === '' || isValidZMoneyAmount(zMoneyInput);
  const previewAmount = zMoneyInput.trim() === '' ? 0 : Number(zMoneyInput);
  const previewCost = zMoneyValid && previewAmount > 0 ? calculateZMoneyCost(previewAmount) : 0;
  const previewCantAfford = previewCost > 0 && !!myBalance && previewCost > (myBalance.z_money || 0);

  const myCost = calculateZMoneyCost(myOffer.z_money);
  const cantAfford = !!myBalance && myCost > (myBalance.z_money || 0);

  const applyZMoney = () => {
    const trimmed = zMoneyInput.trim();
    const next = trimmed === '' ? 0 : Number(trimmed);
    if (trimmed !== '' && !isValidZMoneyAmount(trimmed)) return;
    if (next === myOffer.z_money) return;
    onUpdateOffer(myOffer.items, next);
  };

  const changeItemQty = (itemId: number, newQty: number) => {
    const nextItems = { ...myOffer.items };
    if (newQty <= 0) delete nextItems[itemId];
    else nextItems[itemId] = newQty;
    onUpdateOffer(nextItems, myOffer.z_money);
  };

  const renderItemGrid = (offer: Offer) => {
    const ids = Object.keys(offer.items || {});
    if (ids.length === 0) return <Text style={styles.noItems}>No items offered</Text>;
    return (
      <View style={styles.grid}>
        {ids.map((idStr) => {
          const itemId = Number(idStr);
          const item = (itemsById as any)[itemId];
          const qty = offer.items[idStr];
          const asset = item ? getAssetUrl(item.item_category, itemId) : null;
          return (
            <View key={itemId} style={styles.gridItem}>
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyBadgeText}>x{qty}</Text>
              </View>
              <View style={styles.gridThumb}>{asset ? <AvatarItemThumb asset={asset} alt={item?.item_name} /> : null}</View>
              <Text style={styles.gridName} numberOfLines={1}>
                {item?.item_name || `#${itemId}`}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const content = (
    <>
      <View style={embedded ? styles.bodyEmbedded : styles.bodyFull}>
        {/* My side */}
        <View style={styles.myCard}>
          <View style={styles.cardHead}>
            <Text style={styles.myTitle}>Your Offer</Text>
            {myConfirmed && (
              <View style={styles.confirmedRow}>
                <Ionicons name="checkmark" size={12} color="#4ade80" />
                <Text style={styles.confirmedText}>Confirmed</Text>
              </View>
            )}
          </View>
          {renderItemGrid(myOffer)}
          <Pressable
            onPress={() => setShowPicker(true)}
            disabled={myConfirmed}
            style={[styles.pillBtn, myConfirmed && styles.disabled]}
          >
            <Text style={styles.pillBtnText}>+ Add / Edit Items</Text>
          </Pressable>

          <View style={{ marginTop: 12 }}>
            <View style={styles.zLabelRow}>
              <Text style={styles.zLabel}>ⓩ</Text>
              <Ionicons name="cash-outline" size={12} color="#a3a3a3" />
              <Text style={styles.zLabel}>Send Z Money:</Text>
            </View>

            {zMoneyInput.trim() !== '' && (
              <View style={[styles.chargeBox, !zMoneyValid || previewCantAfford ? styles.chargeBoxBad : styles.chargeBoxOk]}>
                <Text style={styles.chargeLabel}>YOU WILL CHARGE</Text>
                <Text style={[styles.chargeValue, previewCantAfford && { color: '#f87171' }]}>
                  {zMoneyValid ? previewCost : '—'}
                </Text>
                {zMoneyValid && previewAmount > 0 && (
                  <Text style={styles.chargeSub}>
                    ({previewAmount} offer + {previewCost - previewAmount} fee)
                  </Text>
                )}
                {previewCantAfford && <Text style={styles.chargeErr}>Not enough balance!</Text>}
              </View>
            )}

            <View style={styles.zInputRow}>
              <TextInput
                style={[styles.zInput, myConfirmed && styles.disabled]}
                editable={!myConfirmed}
                keyboardType="number-pad"
                value={zMoneyInput}
                onChangeText={setZMoneyInput}
                onBlur={applyZMoney}
                onSubmitEditing={applyZMoney}
                placeholder="0"
                placeholderTextColor="#6e6e6e"
              />
              <Pressable
                onPress={applyZMoney}
                disabled={myConfirmed || !zMoneyValid}
                style={[styles.setBtn, (myConfirmed || !zMoneyValid) && styles.disabled]}
              >
                <Text style={styles.setBtnText}>Set</Text>
              </Pressable>
            </View>

            {!zMoneyValid && <Text style={styles.errText}>Enter a whole number (0 or more)</Text>}

            {myOffer.z_money > 0 && (
              <Text style={[styles.committed, cantAfford && { color: '#f87171' }]}>
                Committed offer: <Text style={styles.bold}>{myOffer.z_money}</Text> (
                <Text style={styles.bold}>{myCost}</Text> will be charged){cantAfford ? ' - not enough balance' : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Other side */}
        <View style={styles.otherCard}>
          <View style={styles.cardHead}>
            <Text style={styles.otherTitle}>{trade.otherUsername || 'Unka'} Offer</Text>
            {otherConfirmed && (
              <View style={styles.confirmedRow}>
                <Ionicons name="checkmark" size={12} color="#4ade80" />
                <Text style={styles.confirmedText}>Confirmed</Text>
              </View>
            )}
          </View>
          {renderItemGrid(otherOffer)}
          {otherOffer.z_money > 0 && (
            <View style={styles.otherZ}>
              <Text style={styles.zLabel}>ⓩ</Text>
              <Ionicons name="cash-outline" size={12} color="#a3a3a3" />
              <Text style={styles.zLabel}>Z Money: </Text>
              <Text style={styles.otherZValue}>{otherOffer.z_money}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={embedded ? styles.footerEmbedded : styles.footerFull}>
        <Pressable
          onPress={onConfirm}
          disabled={myConfirmed || cantAfford}
          style={[styles.confirmBtn, myConfirmed || cantAfford ? styles.confirmBtnOff : styles.confirmBtnOn]}
        >
          {myConfirmed ? (
            <Text style={styles.confirmOffText}>Waiting for other player...</Text>
          ) : (
            <View style={styles.confirmInner}>
              <Ionicons name="checkmark" size={16} color={cantAfford ? '#a3a3a3' : '#ffffff'} />
              <Text style={[styles.confirmText, cantAfford && { color: '#a3a3a3' }]}>Confirm Trade</Text>
            </View>
          )}
        </Pressable>
      </View>

      <TradeItemPicker
        show={showPicker}
        offeredItems={myOffer.items}
        onChangeQty={changeItemQty}
        onClose={() => setShowPicker(false)}
      />
    </>
  );

  if (embedded) {
    return (
      <MotiView
        from={{ opacity: 0, translateY: -8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 240, easing: Easing.out(Easing.cubic) }}
        style={styles.embeddedCard}
      >
        <View style={styles.embeddedHead}>
          <View style={styles.embeddedTitleRow}>
            <Ionicons name="refresh-outline" size={14} color="#ffffff" />
            <Text style={styles.embeddedTitle}>Trade in progress</Text>
          </View>
          <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelRow}>
            <Ionicons name="close" size={12} color="#f87171" />
            <Text style={styles.cancelText}>Cancel Trade</Text>
          </Pressable>
        </View>
        <ScrollView
          style={{ maxHeight: winH * 0.6 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      </MotiView>
    );
  }

  return (
    <View style={[styles.fullScreen, { zIndex, elevation: 25, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.fullHeader}>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelRow}>
          <Ionicons name="close" size={14} color="#f87171" />
          <Text style={[styles.cancelText, { fontSize: 14 }]}>Cancel Trade</Text>
        </Pressable>
        <Text style={styles.fullTitle}>Trade</Text>
        <View style={{ width: 96 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        {content}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a0a' },
  fullHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  fullTitle: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  embeddedCard: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#161616',
    borderRadius: 16,
    padding: 12,
  },
  embeddedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  embeddedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  embeddedTitle: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  cancelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cancelText: { color: '#f87171', fontWeight: '700', fontSize: 12 },
  bodyEmbedded: { gap: 12 },
  bodyFull: { padding: 16, gap: 16, flexGrow: 1 },
  footerEmbedded: { paddingTop: 12 },
  footerFull: { padding: 16, borderTopWidth: 1, borderTopColor: '#161616' },
  myCard: { backgroundColor: '#161616', borderRadius: 12, padding: 12, borderWidth: 2, borderColor: 'rgba(79,70,229,0.5)' },
  otherCard: { backgroundColor: '#161616', borderRadius: 12, padding: 12, borderWidth: 2, borderColor: '#262626' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  myTitle: { fontWeight: '700', fontSize: 14, color: '#a5b4fc' },
  otherTitle: { fontWeight: '700', fontSize: 14, color: '#d4d4d4' },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  confirmedText: { fontSize: 12, fontWeight: '700', color: '#4ade80' },
  noItems: { color: '#6e6e6e', fontSize: 12, textAlign: 'center', paddingVertical: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { width: '31%', backgroundColor: '#0a0a0a', borderRadius: 8, padding: 4, borderWidth: 1, borderColor: '#262626' },
  qtyBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 10,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  qtyBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '700' },
  gridThumb: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  gridName: { fontSize: 9, color: '#ffffff', textAlign: 'center', marginTop: 2 },
  pillBtn: { marginTop: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#262626', alignItems: 'center' },
  pillBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  zLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  zLabel: { fontSize: 12, color: '#a3a3a3' },
  chargeBox: { borderRadius: 16, borderWidth: 2, paddingHorizontal: 16, paddingVertical: 12, marginVertical: 8, alignItems: 'center' },
  chargeBoxOk: { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)' },
  chargeBoxBad: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  chargeLabel: { fontSize: 10, letterSpacing: 0.8, color: '#a3a3a3', marginBottom: 2 },
  chargeValue: { fontSize: 30, fontWeight: '800', color: '#ffffff' },
  chargeSub: { fontSize: 10, color: '#a3a3a3', marginTop: 2 },
  chargeErr: { fontSize: 11, color: '#f87171', fontWeight: '700', marginTop: 4 },
  zInputRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  zInput: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  setBtn: { paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8, backgroundColor: '#262626' },
  setBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  errText: { fontSize: 11, color: '#f87171', marginTop: 6 },
  committed: { fontSize: 11, color: '#a3a3a3', marginTop: 8 },
  bold: { fontWeight: '700' },
  otherZ: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  otherZValue: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  confirmBtn: { paddingVertical: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  confirmBtnOn: { backgroundColor: '#16a34a' },
  confirmBtnOff: { backgroundColor: '#262626' },
  confirmInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  confirmOffText: { color: '#a3a3a3', fontWeight: '700', fontSize: 14 },
});

export default memo(TradeModal);