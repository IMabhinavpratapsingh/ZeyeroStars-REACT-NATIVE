import axios from 'axios';
import { API_BASE } from '../config/config';
import { getToken } from '../services/NetworkManager';
import { createCachedResource } from '../services/persistentCache';
import { useCachedResource } from './useCachedResource';

export interface InventoryData {
  ownedIds: (number | string)[];
  quantities: Record<string, number>;
  equippedIds: (number | string)[];
}

/**
 * Logged-in player ke owned item_ids + quantities + equipped items -
 * AsyncStorage-backed cache. userScoped: true - logout par clear ho
 * jaata hai (dusra account login karne par purana inventory na dikhe).
 */
const EMPTY_INVENTORY: InventoryData = { ownedIds: [], quantities: {}, equippedIds: [] };

function fetchInventory(): Promise<InventoryData> {
  const token = getToken();
  return axios
    .get(`${API_BASE}/inventory/me`, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => ({
      ownedIds: res.data?.owned_item_ids || [],
      quantities: res.data?.quantities || {},
      equippedIds: res.data?.equipped_item_ids || [],
    }));
}

const inventoryResource = createCachedResource<InventoryData>({
  key: 'inventory',
  fetchFn: fetchInventory,
  userScoped: true,
});

// Component ke bahar se (jaise Dashboard ke trade_completed handler se) bhi
// cache invalidate karke fresh inventory laane ke liye - trade/purchase ke
// baad turant sab jagah (Trade picker, Avatar customize, Shop) naya data
// dikhna chahiye.
export function invalidateInventory() {
  return inventoryResource.fetchAndApply();
}

export default function useInventory() {
  const { data, loading, refresh } = useCachedResource(inventoryResource, EMPTY_INVENTORY);
  return {
    ownedIds: data.ownedIds,
    quantities: data.quantities,
    equippedIds: data.equippedIds || [],
    loading,
    refresh,
  };
}