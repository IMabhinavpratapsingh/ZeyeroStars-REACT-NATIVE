import { getRoomItemCatalog } from '../../features/rooms/services/roomsApi';
import { createCachedResource } from '../services/persistentCache';
import { useCachedResource } from './useCachedResource';

export interface RoomCatalogItem {
  room_items_id: number | string;
  [key: string]: any;
}

/**
 * Poori `room_items` catalog (floors/walls/tables/chairs/blocks) -
 * AsyncStorage-backed cache, useItemsCatalog.ts jaisa hi pattern (sab
 * users ke liye same data, userScoped nahi).
 *
 * !! DHYAN DO: yeh `getRoomItemCatalog` roomsApi.ts se import karta hai -
 * lekin abhi tumhari roomsApi.ts mein yeh function NAHI hai (getMyRoomItems
 * aur buyRoomItem bhi nahi). Web ki roomsApi.js (jo zip mein thi) mein bhi
 * nahi hai - matlab woh file purani/adhuri hai. Backend ka `/room-items/*`
 * endpoint set add karke teeno functions roomsApi.ts mein daalne honge.
 */
function fetchRoomItemsCatalog(): Promise<Record<string, RoomCatalogItem>> {
  return getRoomItemCatalog().then((res: any) => {
    const map: Record<string, RoomCatalogItem> = {};
    ((res.data || []) as RoomCatalogItem[]).forEach((item) => {
      map[String(item.room_items_id)] = item;
    });
    return map;
  });
}

const roomItemsResource = createCachedResource<Record<string, RoomCatalogItem>>({
  key: 'room_items_catalog',
  fetchFn: fetchRoomItemsCatalog,
});

const EMPTY: Record<string, RoomCatalogItem> = {};

export default function useRoomItemsCatalog() {
  const { data, loading, refresh } = useCachedResource(roomItemsResource, EMPTY);
  return { roomItemsById: data, loading, refresh };
}