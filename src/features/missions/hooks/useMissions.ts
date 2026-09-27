import { useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { createCachedResource } from '../../../shared/services/persistentCache';
import { useCachedResource } from '../../../shared/hooks/useCachedResource';

/**
 * Daily + Weekly missions status + claim.
 *
 * AsyncStorage-backed cache (createCachedResource) - app dobara khulte hi
 * purana cached status TURANT dikhta hai (koi spinner nahi), background me
 * silently revalidate hota hai. 60s TTL - itni der ke andar dobara fetch
 * maanga gaya to network call bhi skip, seedha cached data hi mil jaata
 * hai (backend load/bandwidth dono bachte hain). Claim karne ke baad TTL
 * bypass karke turant fresh fetch hota hai, taaki claimed status turant
 * sahi dikhe.
 */
const authConfig = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const MISSIONS_TTL_MS = 60_000;

function fetchDailyMissions(): Promise<any> {
  return axios.get(`${API_BASE}/missions/daily`, authConfig()).then((res) => res.data);
}

function fetchWeeklyMissions(): Promise<any> {
  return axios.get(`${API_BASE}/missions/weekly`, authConfig()).then((res) => res.data);
}

const dailyMissionsResource = createCachedResource<any>({
  key: 'missions_daily',
  fetchFn: fetchDailyMissions,
  userScoped: true,
  ttlMs: MISSIONS_TTL_MS,
});

const weeklyMissionsResource = createCachedResource<any>({
  key: 'missions_weekly',
  fetchFn: fetchWeeklyMissions,
  userScoped: true,
  ttlMs: MISSIONS_TTL_MS,
});

export default function useMissions() {
  const { data: daily, loading: dailyLoading, refresh: refreshDaily } =
    useCachedResource(dailyMissionsResource, null);
  const { data: weekly, loading: weeklyLoading, refresh: refreshWeekly } =
    useCachedResource(weeklyMissionsResource, null);

  // Yeh sirf ek explicit "abhi turant fetch karo" trigger hai - MissionsModal
  // khulte hi call kiya jaa sakta hai (TTL ke andar ho to yeh call khud hi
  // network-call skip kar dega).
  const fetchDaily = useCallback(() => refreshDaily(), [refreshDaily]);
  const fetchWeekly = useCallback(() => refreshWeekly(), [refreshWeekly]);

  const claimDailyMission = useCallback((missionId: number | string) => {
    return axios
      .post(`${API_BASE}/missions/daily/claim/${missionId}`, {}, authConfig())
      .then((res) => {
        dailyMissionsResource.invalidateAndRefetch(); // TTL bypass - turant fresh claimed-status
        return res.data;
      });
  }, []);

  const claimWeeklyMission = useCallback((missionId: number | string) => {
    return axios
      .post(`${API_BASE}/missions/weekly/claim/${missionId}`, {}, authConfig())
      .then((res) => {
        weeklyMissionsResource.invalidateAndRefetch();
        return res.data;
      });
  }, []);

  return {
    daily,
    weekly,
    loading: dailyLoading || weeklyLoading,
    fetchDaily,
    fetchWeekly,
    claimDailyMission,
    claimWeeklyMission,
  };
}