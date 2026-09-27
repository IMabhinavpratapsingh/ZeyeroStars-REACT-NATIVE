import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../config/config';
import { getToken } from '../services/NetworkManager';
import {
  preloadRewardedAd,
  showRewardedAd,
  isRewardedAdReady,
  subscribeRewardedAdReady,
} from '../services/adsService';

/**
 * "Watch Ad, Get Reward" button - kahin bhi drop kar sakte ho (Shop,
 * QuickActionsSheet, wagera). Reward ka asli hisaab (5 Z money/ad, 10/day
 * max, 30s cooldown) hamesha backend (/rewards/ad) se aata hai - yeh
 * component sirf ad dikhata hai aur backend claim call karta hai.
 *
 * `onRewardCredited(newZMoney, zMoneyEarned)` - reward milte hi local
 * balance update karne ke liye. `onError(message)` - koi error message.
 *
 * WEB -> RN CHANGES:
 * - localStorage token -> `getToken()` (NetworkManager).
 * - `isRewardedAdReady()` web mein sirf render par padhi jaati thi; ab
 *   `useSyncExternalStore(subscribeRewardedAdReady, ...)` se ad load hote hi
 *   button khud enable ho jaata hai.
 * - Unmount ke baad setState na ho (mountedRef guard).
 */
interface RewardedAdButtonProps {
  onRewardCredited?: (newZMoney: number, zMoneyEarned: number) => void;
  onError?: (message: string) => void;
}

export default function RewardedAdButton({ onRewardCredited, onError }: RewardedAdButtonProps) {
  const [status, setStatus] = useState<any>(null); // { ads_watched_today, ads_remaining_today, ... }
  const [loading, setLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const adReady = useSyncExternalStore(subscribeRewardedAdReady, isRewardedAdReady);

  const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/rewards/ad/status`, getAuthHeaders());
      if (mountedRef.current && res.data?.success) setStatus(res.data);
    } catch (err: any) {
      console.error('Rewarded ad status fetch error:', err?.response?.data || err?.message);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();
    preloadRewardedAd();
    return () => {
      mountedRef.current = false;
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [fetchStatus]);

  const startCooldownTimer = (seconds: number) => {
    setCooldownLeft(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownLeft((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const limitReached = !!status && status.ads_remaining_today <= 0;

  const handleWatchAd = async () => {
    if (loading || cooldownLeft > 0 || limitReached) return;

    setLoading(true);
    try {
      await showRewardedAd(async () => {
        // Ad poori dekh li gayi - asli reward backend claim/verify karega
        // (daily cap + cooldown wahin enforce hoti hai).
        try {
          const res = await axios.post(`${API_BASE}/rewards/ad/claim`, {}, getAuthHeaders());
          const data = res.data;
          if (data.success) {
            setStatus((prev: any) => ({
              ...prev,
              ads_watched_today: data.ads_watched_today,
              ads_remaining_today: data.ads_remaining_today,
            }));
            startCooldownTimer(30);
            onRewardCredited?.(data.new_z_money, data.z_money_earned);
          } else {
            if (data.reason === 'cooldown' && data.wait_seconds) {
              startCooldownTimer(data.wait_seconds);
            }
            if (data.ads_watched_today != null) {
              setStatus((prev: any) => ({
                ...prev,
                ads_watched_today: data.ads_watched_today,
                ads_remaining_today: data.ads_remaining_today,
              }));
            }
            onError?.(data.message || 'Reward claim failed');
          }
        } catch (err: any) {
          console.error('Rewarded ad claim error:', err?.response?.data || err?.message);
          onError?.('Reward claim failed - check your connection.');
        }
      });
    } catch {
      onError?.('Ad abhi available nahi hai, thodi der baad try karo.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const remaining = status?.ads_remaining_today ?? '...';
  const disabled = loading || cooldownLeft > 0 || limitReached || !adReady;

  return (
    <Pressable
      onPress={handleWatchAd}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        pressed && !disabled && styles.btnPressed,
        disabled && styles.btnDisabled,
      ]}
    >
      <Ionicons name="gift-outline" size={18} color="#ffffff" />
      <Text style={styles.text}>
        {cooldownLeft > 0
          ? `Wait ${cooldownLeft}s`
          : limitReached
          ? 'Daily limit reached'
          : `Watch Ad · +5 Z Money (${remaining} left today)`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4f46e5', // star-primary-600
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPressed: { backgroundColor: '#6366f1' }, // star-primary-500
  btnDisabled: { opacity: 0.5 },
  text: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
});