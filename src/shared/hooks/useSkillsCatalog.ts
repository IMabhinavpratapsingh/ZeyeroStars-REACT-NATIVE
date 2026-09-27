import axios from 'axios';
import { API_BASE } from '../config/config';
import { getToken } from '../services/NetworkManager';
import { createCachedResource } from '../services/persistentCache';
import { useCachedResource } from './useCachedResource';

export interface CatalogSkill {
  skill_id: number | string;
  [key: string]: any;
}

/**
 * Poori skills table - AsyncStorage-backed cache, useItemsCatalog.ts jaisa
 * hi pattern (sab users ke liye same data, userScoped nahi).
 */
function fetchSkillsCatalog(): Promise<Record<string, CatalogSkill>> {
  const token = getToken();
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  return axios.get(`${API_BASE}/skills/all`, config).then((res) => {
    const map: Record<string, CatalogSkill> = {};
    ((res.data || []) as CatalogSkill[]).forEach((skill) => {
      map[String(skill.skill_id)] = skill;
    });
    return map;
  });
}

const skillsResource = createCachedResource<Record<string, CatalogSkill>>({
  key: 'skills_catalog',
  fetchFn: fetchSkillsCatalog,
});

const EMPTY: Record<string, CatalogSkill> = {};

export default function useSkillsCatalog() {
  const { data, loading, refresh } = useCachedResource(skillsResource, EMPTY);
  return { skillsById: data, loading, refresh };
}