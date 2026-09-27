import { useState, useEffect, useCallback } from 'react';
import type { CachedResource } from '../services/persistentCache';

/**
 * persistentCache.ts ke createCachedResource() se bana resource ko React
 * component me use karne ke liye generic wrapper. Sab catalog/inventory
 * hooks (useItemsCatalog, useSkillsCatalog, useRoomItemsCatalog,
 * useOwnedSkills, useInventory, useMissions, useRewards, useRankRewards)
 * isi ek hook par based hain.
 *
 * - Mount hote hi agar cache (memory ya AsyncStorage se hydrate hua) me
 *   pehle se data hai to WOHI turant dikha diya jaata hai (loading=false) -
 *   saath hi background me silently revalidate bhi ho jaata hai (state
 *   tabhi update hogi jab data actually badla ho).
 * - Agar cache khaali hai (pehli baar) to loading=true rehta hai jab tak
 *   fetch complete na ho.
 *
 * WEB -> RN NOTE: web mein localStorage sync tha, isliye cache module-load
 * par hi bhar jaata tha. RN mein root _layout.tsx mein `await
 * hydrateAllCaches()` (splash ke dauraan) karne se pehla render bhi waisa
 * hi hota hai. Agar hydrate baad mein khatam ho to subscribe() callback
 * automatically state update kar deta hai - koi extra kaam nahi.
 */
// T = resource ka data type, E = "abhi data nahi" wali empty value ka type (jaise null).
// Result: data ka type `T | E` hota hai.
export function useCachedResource<T, E = T>(resource: CachedResource<T>, emptyValue: E) {
  const [data, setData] = useState<T | E>(() => resource.getSnapshot() ?? emptyValue);
  const [loading, setLoading] = useState<boolean>(() => resource.getSnapshot() == null);

  const refresh = useCallback(() => {
    setLoading(true);
    return resource.fetchAndApply().finally(() => setLoading(false));
  }, [resource]);

  useEffect(() => {
    const unsubscribe = resource.subscribe((val) => setData(val ?? emptyValue));

    const existing = resource.getSnapshot();
    if (existing != null) {
      setData(existing);
      setLoading(false);
      resource.fetchAndApply(); // silent background revalidate, UI already dikh chuki
    } else {
      setLoading(true);
      resource.fetchAndApply().finally(() => setLoading(false));
    }

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);

  return { data, loading, refresh };
}

export default useCachedResource;