import axios from 'axios';
import { API_BASE } from '../config/config';
import { getToken } from '../services/NetworkManager';
import { createCachedResource } from '../services/persistentCache';
import { useCachedResource } from './useCachedResource';

/**
 * Logged-in player ke owned skill_ids - AsyncStorage-backed cache.
 * userScoped: true - logout hote hi (clearUserScopedCaches se) yeh clear
 * ho jaata hai, warna dusra account login karne par ek pal ke liye purane
 * user ke owned skills dikh sakte the.
 */
function fetchOwnedSkills(): Promise<(number | string)[]> {
  const token = getToken();
  return axios
    .get(`${API_BASE}/skills/owned`, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => res.data?.owned_skill_ids || []);
}

const ownedSkillsResource = createCachedResource<(number | string)[]>({
  key: 'owned_skills',
  fetchFn: fetchOwnedSkills,
  userScoped: true,
});

const EMPTY: (number | string)[] = [];

export default function useOwnedSkills() {
  const { data, loading, refresh } = useCachedResource(ownedSkillsResource, EMPTY);
  return { ownedSkillIds: data, loading, refresh };
}