import axios from 'axios';
import { API_BASE } from '../config/config';
import { getToken } from '../services/NetworkManager';
import { createCachedResource } from '../services/persistentCache';
import { useCachedResource } from './useCachedResource';

export interface CatalogItem {
  items_id: number | string;
  [key: string]: any;
}

/**
 * Poori items table (avatar cosmetics) - AsyncStorage-backed cache (sab
 * users ke liye same data hai, isliye userScoped nahi). App band-khol karne
 * par bhi cache bana rehta hai, background me silently revalidate hoti hai.
 */
function fetchItemsCatalog(): Promise<Record<string, CatalogItem>> {
  const token = getToken();
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  return axios.get(`${API_BASE}/items/all`, config).then((res) => {
    const map: Record<string, CatalogItem> = {};
    ((res.data || []) as CatalogItem[]).forEach((item) => {
      map[String(item.items_id)] = item;
    });
    return map;
  });
}

const itemsResource = createCachedResource<Record<string, CatalogItem>>({
  key: 'items_catalog',
  fetchFn: fetchItemsCatalog,
});

const EMPTY: Record<string, CatalogItem> = {};

export default function useItemsCatalog() {
  const { data, loading, refresh } = useCachedResource(itemsResource, EMPTY);
  return { itemsById: data, loading, refresh };
}