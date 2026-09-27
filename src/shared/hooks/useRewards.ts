import { useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/config';
import { getToken } from '../services/NetworkManager';
import { createCachedResource } from '../services/persistentCache';
import { useCachedResource } from './useCachedResource';

/**
 * Daily reward status + claim. Ek hi cheez hai - koi weekly/first-login nahi.
 *
 * AsyncStorage-backed (createCachedResource), 60s TTL - itni der ke andar
 * dobara maanga to network call skip, cached status hi mil jaata hai. Claim
 * ke baad TTL bypass karke turant fresh status.
 */
const authConfig = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const REWARDS_TTL_MS = 60_000;

function fetchDailyReward(): Promise<any> {
  return axios.get(`${API_BASE}/rewards/daily/status`, authConfig()).then((res) => res.data);
}

const dailyRewardResource = createCachedResource<any>({
  key: 'rewards_daily',
  fetchFn: fetchDailyReward,
  userScoped: true,
  ttlMs: REWARDS_TTL_MS,
});

export default function useRewards() {
  const { data: daily, loading, refresh } = useCachedResource(dailyRewardResource, null);

  const fetchDaily = useCallback(() => refresh(), [refresh]);

  const claimDaily = useCallback(() => {
    return axios.post(`${API_BASE}/rewards/daily/claim`, {}, authConfig()).then((res) => {
      dailyRewardResource.invalidateAndRefetch(); // TTL bypass - turant fresh claimed-status
      return res.data;
    });
  }, []);

  return { daily, loading, fetchDaily, claimDaily };
}