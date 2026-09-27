import { useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/config';
import { getToken } from '../services/NetworkManager';
import { createCachedResource } from '../services/persistentCache';
import { useCachedResource } from './useCachedResource';

export interface RankRewardsData {
  user_rank: number;
  claimed_reward_ids: (number | string)[];
  // har reward: id, rank, item_id, category, quantity
  rank_rewards: any[];
}

/**
 * Rank reward list + player ka current rank + already-claimed reward ids -
 * sab ek hi call se (GET /rank-rewards). useRewards.ts jaisa hi pattern:
 * AsyncStorage-backed cache (userScoped, kyunki har player ka rank/claimed-
 * list alag hota hai), 60s TTL. Claim ke baad TTL bypass karke turant fresh
 * list (taaki wahi reward dobara "claim" na dikhe).
 */
const authConfig = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const RANK_REWARDS_TTL_MS = 60_000;

function fetchRankRewards(): Promise<RankRewardsData> {
  return axios.get(`${API_BASE}/rank-rewards`, authConfig()).then((res) => res.data);
}

const rankRewardsResource = createCachedResource<RankRewardsData>({
  key: 'rank_rewards',
  fetchFn: fetchRankRewards,
  userScoped: true,
  ttlMs: RANK_REWARDS_TTL_MS,
});

export default function useRankRewards() {
  const { data, loading, refresh } = useCachedResource(rankRewardsResource, null);

  const fetchRankRewardsList = useCallback(() => refresh(), [refresh]);

  const claimRankReward = useCallback((rewardId: number | string) => {
    return axios
      .post(`${API_BASE}/rank-rewards/claim`, { reward_id: rewardId }, authConfig())
      .then((res) => {
        rankRewardsResource.invalidateAndRefetch(); // TTL bypass - turant fresh claimed-status
        return res.data;
      });
  }, []);

  return {
    userRank: data?.user_rank ?? 0,
    claimedRewardIds: data?.claimed_reward_ids || [],
    rankRewards: data?.rank_rewards || [],
    loading,
    fetchRankRewardsList,
    claimRankReward,
  };
}