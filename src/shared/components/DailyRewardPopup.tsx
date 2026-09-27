import React, { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import useRewards from '../hooks/useRewards';
import useTopZIndex from '../hooks/useTopZIndex';
import useBackButtonHandler from '../hooks/useBackButtonHandler';
import useStableCallback from '../hooks/useStableCallback';
import { FadeIn, CardPop } from './motion/ScreenTransition';

/**
 * Game khulte hi sabse pehle dikhne wala daily reward popup - center card,
 * upar right corner me X se band hota hai.
 *
 * balance: { coins, z_money } - Dashboard se aata hai
 * onBalanceUpdate: (newBalance) => void - claim ke baad coins turant update
 *
 * WEB -> RN CHANGES:
 * - `fixed inset-0` -> in-tree absoluteFill overlay + useTopZIndex (parent
 *   full-screen View hona chahiye, jaise Dashboard root).
 * - Android hardware back = popup close (useBackButtonHandler).
 * - `animate-pulse` (today ka tile) -> Moti opacity loop.
 */
interface DailyRewardPopupProps {
  show: boolean;
  onClose: () => void;
  balance?: { coins: number; z_money: number };
  onBalanceUpdate?: (newBalance: { coins: number; z_money: number }) => void;
}

const PulseTile = ({ children, style }: { children: React.ReactNode; style: any }) => (
  <MotiView
    from={{ opacity: 1 }}
    animate={{ opacity: 0.6 }}
    transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
    style={style}
  >
    {children}
  </MotiView>
);

const DailyRewardPopup = ({
  show,
  onClose,
  balance = { coins: 0, z_money: 0 },
  onBalanceUpdate,
}: DailyRewardPopupProps) => {
  const zIndex = useTopZIndex(show);
  const { daily, loading, fetchDaily, claimDaily } = useRewards();
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState('');

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  useEffect(() => {
    if (show) fetchDaily();
  }, [show, fetchDaily]);

  const currentDay: number = daily?.current_day || 1;
  const canClaim = !!daily?.can_claim_today;

  const handleClaim = useCallback(async () => {
    if (claiming || !canClaim) return;
    setClaiming(true);
    try {
      const res = await claimDaily();
      if (res.success) {
        setToast(`+${res.coins_earned} coins earned!`);
        if (onBalanceUpdate && typeof res.new_coin_balance === 'number') {
          onBalanceUpdate({ ...balance, coins: res.new_coin_balance });
        }
        // Naye status (can_claim_today: false) aane tak wait - warna button
        // stale state mein "Claim" par flash karta hai.
        await fetchDaily();
      } else {
        setToast(res.message || "Can't claim right now");
      }
    } catch (err: any) {
      setToast(err?.response?.data?.detail || 'Claim failed');
    } finally {
      setClaiming(false);
    }
  }, [claiming, canClaim, claimDaily, fetchDaily, onBalanceUpdate, balance]);

  return (
    <FadeIn show={show} style={[styles.overlay, { zIndex, elevation: 20 }]}>
      <View style={styles.center}>
        <CardPop style={styles.card}>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            hitSlop={8}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={16} color="#d4d4d8" />
          </Pressable>

          <View style={styles.titleRow}>
            <Ionicons name="gift-outline" size={18} color="#fcd34d" />
            <Text style={styles.title}>Daily reward</Text>
          </View>
          <Text style={styles.subtitle}>Log in daily, earn coins</Text>

          {loading ? (
            <Text style={styles.muted}>Loading...</Text>
          ) : !daily ? (
            <Text style={styles.muted}>Couldn't load, try again.</Text>
          ) : (
            <>
              <View style={styles.grid}>
                {(daily.calendar || []).map((entry: any) => {
                  const isPast = entry.day_number < currentDay;
                  const isToday = entry.day_number === currentDay;
                  const pulsing = isToday && canClaim;
                  const tone = isPast ? styles.tilePast : pulsing ? styles.tileToday : styles.tileFuture;
                  const textColor = isPast ? '#86efac' : pulsing ? '#fcd34d' : '#71717a';
                  const Tile: any = pulsing ? PulseTile : View;
                  return (
                    <Tile key={entry.day_number} style={[styles.tile, tone]}>
                      <Text style={[styles.dayText, { color: textColor }]}>Day {entry.day_number}</Text>
                      <View style={styles.coinRow}>
                        <Ionicons name="cash-outline" size={12} color={textColor} />
                        <Text style={[styles.coinText, { color: textColor }]}>{entry.coin_reward}</Text>
                      </View>
                      {isPast && <Ionicons name="checkmark" size={12} color={textColor} style={{ marginTop: 2 }} />}
                    </Tile>
                  );
                })}
              </View>

              {!!toast && (
                <View style={styles.toastRow}>
                  <Ionicons name="sparkles-outline" size={16} color="#fcd34d" />
                  <Text style={styles.toastText}>{toast}</Text>
                </View>
              )}

              <Pressable
                onPress={handleClaim}
                disabled={claiming || !canClaim}
                style={({ pressed }) => [
                  styles.claimBtn,
                  !canClaim ? styles.claimBtnDisabled : styles.claimBtnActive,
                  pressed && canClaim && styles.claimBtnPressed,
                ]}
              >
                <Text style={[styles.claimText, !canClaim && { color: '#71717a' }]}>
                  {claiming ? 'Claiming...' : canClaim ? 'Claim' : 'Come back tomorrow'}
                </Text>
              </Pressable>
            </>
          )}
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
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 384,
    backgroundColor: '#1e1e2a', // star-800
    borderWidth: 1,
    borderColor: '#2a2a38', // star-700
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,32,0.7)', // star-900/70
    zIndex: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  subtitle: { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginBottom: 16 },
  muted: { textAlign: 'center', color: '#71717a', paddingVertical: 24 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginBottom: 20,
  },
  tile: {
    width: '23.5%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 10,
  },
  tilePast: { backgroundColor: 'rgba(21,128,61,0.4)', borderColor: '#16a34a' },
  tileToday: { backgroundColor: 'rgba(245,158,11,0.2)', borderColor: '#fbbf24' },
  tileFuture: { backgroundColor: '#141420', borderColor: '#2a2a38' },
  dayText: { fontSize: 11, fontWeight: '700' },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  coinText: { fontSize: 12, fontWeight: '700' },
  toastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  toastText: { fontSize: 14, fontWeight: '700', color: '#fcd34d' },
  claimBtn: { width: '100%', paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  claimBtnActive: { backgroundColor: '#16a34a' },
  claimBtnPressed: { backgroundColor: '#22c55e' },
  claimBtnDisabled: { backgroundColor: '#2a2a38' },
  claimText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});

export default memo(DailyRewardPopup);