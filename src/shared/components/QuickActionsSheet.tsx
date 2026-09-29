import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../config/config';
import { getToken } from '../services/NetworkManager';
import { preloadRewardedAd, showRewardedAd } from '../services/adsService';
import { showAlert } from '../utils/alertBus';

/**
 * Feed ke floating "++" FAB se khulne wali quick-actions sheet (neeche se slide-up):
 * create post, store (Verified badge + Z Money purchase), watch ads, rank
 * rewards, communities, missions, daily, leaderboard, settings.
 * Har tile ka handler parent (`(tabs)/_layout.tsx`) se aata hai - tile tap
 * par sheet band hoti hai aur phir wahi screen/modal khulta hai.
 *
 * `show` = sheet mounted (Modal visible), `open` = slide-in state (animation).
 * Parent pehle show=true + open=true kare; band karte waqt open=false, phir
 * ~280ms baad show=false (web jaisa hi contract).
 *
 * "Watch Ads" logic: reward ka hisaab (5 Z money/ad, 10/day, 30s cooldown)
 * backend (/rewards/ad) se aata hai; yeh tile sirf ad dikhata + claim call karta hai.
 *
 * WEB -> RN CHANGES:
 * - Portal + fixed z-index -> RN `<Modal transparent>` (khud sabse upar,
 *   FAB/overlays ke upar bhi). Android back = close.
 * - CSS transform transition -> Moti timing translateY (280ms ease-out).
 * - localStorage token -> `getToken()` (NetworkManager, in-memory cache).
 * - Bottom safe-area inset (gesture bar) sheet ke padding mein add.
 * - Tile width `useWindowDimensions` se nikalti hai (4 columns, 12px gap).
 */
interface SheetTileProps {
  icon: string;
  label: string;
  onPress?: () => void;
  redDot?: boolean;
  accent?: boolean;
  width: number;
}

const SheetTile = ({ icon, label, onPress, redDot, accent, width }: SheetTileProps) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.tile,
      { width },
      accent ? styles.tileAccent : styles.tilePlain,
      pressed && (accent ? styles.tileAccentPressed : styles.tilePlainPressed),
      pressed && { transform: [{ scale: 0.95 }] },
    ]}
  >
    {redDot && <View style={styles.redDot} />}
    <Ionicons name={icon as any} size={22} color={accent ? '#818cf8' : '#ffffff'} />
    <Text style={[styles.tileLabel, { color: accent ? '#a5b4fc' : '#ffffff' }]} numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

interface QuickActionsSheetProps {
  show: boolean;
  open: boolean;
  onClose?: () => void;
  onComposeClick?: () => void;
  hasUnreadNotifications?: boolean;
  onMissionsClick?: () => void;
  hasClaimableMission?: boolean;
  onRewardsClick?: () => void;
  onLeaderboardClick?: () => void;
  onSettingsClick?: () => void;
  onRankRewardsClick?: () => void;
  onAdRewardCredited?: (newZMoney: number, zMoneyEarned: number) => void;
  onCommunitiesClick?: () => void;
  onStoreClick?: () => void;
}

const SHEET_OFFSCREEN = 800; // sheet ki height se hamesha zyada

const QuickActionsSheet = ({
  show,
  open,
  onClose,
  onComposeClick,
  onMissionsClick,
  hasClaimableMission,
  onRewardsClick,
  onLeaderboardClick,
  onSettingsClick,
  onRankRewardsClick,
  onAdRewardCredited,
  onCommunitiesClick,
  onStoreClick,
}: QuickActionsSheetProps) => {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const tileW = Math.floor((Math.min(screenW, 560) - 40 - 36) / 4); // 20px padding x2, 12px gap x3

  const [adStatus, setAdStatus] = useState<any>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adCooldownLeft, setAdCooldownLeft] = useState(0);
  const adCooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sheet persistent shell mein boot par hi mount ho jaati hai (tab token
  // ho na ho) - isliye ad-status har baar sheet KHULNE par fresh fetch hota
  // hai, sirf mount par nahi (warna login ke baad status kabhi load nahi
  // hota tha aur daily-limit ka check galat rehta tha).
  useEffect(() => {
    if (!show) return;
    const token = getToken();
    if (!token) return;
    axios
      .get(`${API_BASE}/rewards/ad/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.data?.success) setAdStatus(res.data);
      })
      .catch((err) => console.error('Rewarded ad status fetch error:', err?.response?.data || err?.message));
    preloadRewardedAd();
  }, [show]);

  useEffect(
    () => () => {
      if (adCooldownTimerRef.current) clearInterval(adCooldownTimerRef.current);
    },
    []
  );

  const startAdCooldownTimer = useCallback((seconds: number) => {
    setAdCooldownLeft(seconds);
    if (adCooldownTimerRef.current) clearInterval(adCooldownTimerRef.current);
    adCooldownTimerRef.current = setInterval(() => {
      setAdCooldownLeft((prev) => {
        if (prev <= 1) {
          if (adCooldownTimerRef.current) clearInterval(adCooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleWatchAdsClick = async () => {
    if (adStatus && adStatus.ads_remaining_today <= 0) {
      showAlert("You've watched all your ads for today. Come back tomorrow!", 'info');
      return;
    }
    if (adLoading || adCooldownLeft > 0) return;

    setAdLoading(true);
    const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };
    try {
      await showRewardedAd(async () => {
        try {
          const res = await axios.post(`${API_BASE}/rewards/ad/claim`, {}, authHeaders);
          const data = res.data;
          if (data.success) {
            setAdStatus((prev: any) => ({
              ...prev,
              ads_watched_today: data.ads_watched_today,
              ads_remaining_today: data.ads_remaining_today,
            }));
            startAdCooldownTimer(30);
            onAdRewardCredited?.(data.new_z_money, data.z_money_earned);
          } else {
            if (data.reason === 'cooldown' && data.wait_seconds) {
              startAdCooldownTimer(data.wait_seconds);
            }
            if (data.ads_watched_today != null) {
              setAdStatus((prev: any) => ({
                ...prev,
                ads_watched_today: data.ads_watched_today,
                ads_remaining_today: data.ads_remaining_today,
              }));
            }
            const hitDailyLimit =
              data.ads_remaining_today <= 0 || String(data.reason || '').includes('limit');
            if (hitDailyLimit) {
              showAlert("You've watched all your ads for today. Come back tomorrow!", 'info');
            } else {
              showAlert(data.message || 'Reward claim failed', 'error');
            }
          }
        } catch (err: any) {
          console.error('Rewarded ad claim error:', err?.response?.data || err?.message);
          showAlert('Reward claim failed - check your connection.', 'error');
        }
      });
    } catch {
      showAlert('Ad not available right now, try again in a bit.', 'error');
    } finally {
      setAdLoading(false);
    }
  };

  const adTileLabel =
    adCooldownLeft > 0 ? `Wait ${adCooldownLeft}s` : adLoading ? 'Loading…' : 'Watch Ads';

  const close = () => onClose?.();
  const runAndClose = (fn?: () => void) => () => {
    close();
    fn?.();
  };

  return (
    <Modal
      visible={show}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      {/* Backdrop */}
      <MotiView
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ type: 'timing', duration: 280 }}
        style={StyleSheet.absoluteFill}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <Pressable style={styles.backdrop} onPress={close} />
      </MotiView>

      {/* Slide-up sheet */}
      <View style={styles.sheetHost} pointerEvents="box-none">
        <MotiView
          from={{ translateY: SHEET_OFFSCREEN }}
          animate={{ translateY: open ? 0 : SHEET_OFFSCREEN }}
          transition={{ type: 'timing', duration: 280 }}
          style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}
        >
          <View style={styles.handle} />
          <View style={styles.grid}>
            <SheetTile width={tileW} icon="create-outline" label="Create Post" onPress={runAndClose(onComposeClick)} accent />
            <SheetTile width={tileW} icon="bag-handle-outline" label="Store" onPress={runAndClose(onStoreClick)} accent />
            <SheetTile width={tileW} icon="play" label={adTileLabel} onPress={handleWatchAdsClick} />
            <SheetTile width={tileW} icon="ribbon-outline" label="Rank Rewards" onPress={runAndClose(onRankRewardsClick)} />
            <SheetTile width={tileW} icon="people-outline" label="Communities" onPress={runAndClose(onCommunitiesClick)} />
            <SheetTile width={tileW} icon="locate-outline" label="Missions" onPress={runAndClose(onMissionsClick)} redDot={hasClaimableMission} />
            <SheetTile width={tileW} icon="gift-outline" label="Daily" onPress={runAndClose(onRewardsClick)} />
            <SheetTile width={tileW} icon="trophy-outline" label="Leaderboard" onPress={runAndClose(onLeaderboardClick)} />
            <SheetTile width={tileW} icon="settings-outline" label="Settings" onPress={runAndClose(onSettingsClick)} />
          </View>
        </MotiView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetHost: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#1e1e2a', // star-800
    borderTopWidth: 1,
    borderColor: '#2a2a38', // star-700
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
  },
  handle: {
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3a3a4a', // star-600
    alignSelf: 'center',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  tilePlain: { backgroundColor: 'rgba(20,20,32,0.7)' }, // star-900/70
  tilePlainPressed: { backgroundColor: '#2a2a38' }, // star-700
  tileAccent: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  tileAccentPressed: { backgroundColor: 'rgba(99,102,241,0.25)' },
  tileLabel: { fontSize: 12, fontWeight: '700' },
  redDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444', // star-danger-500
    borderWidth: 2,
    borderColor: '#141420', // star-900
    zIndex: 1,
  },
});

export default memo(QuickActionsSheet);