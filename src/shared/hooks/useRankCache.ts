import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/config';
import { getToken } from '../services/NetworkManager';
import { FIELD } from '../utils/profileFields';
import { resolveAvatarUrl } from '../../features/avatar/services/avatarCache';

export interface CachedAvatar {
  equippedItems: any[];
  photoUrl: string | null | undefined;
}

/**
 * Chat bubbles me har sender ka rank/power/verified-status aur avatar
 * (equipped cosmetics) dikhane ke liye. Websocket messages
 * (dm/broadcast) me sirf sender_id + username aata hai - baaki sab yeh
 * hook GET /profile/{id} se ek hi baar fetch karke local cache me rakh
 * leta hai (ek id ek hi baar fetch hoga, dobara nahi).
 *
 * Avatar URL khud avatarCache.ts (`avatar_version` ke against, memory +
 * AsyncStorage-backed) ke through resolve hota hai.
 *
 * RN NOTE: web version mein `ensureRank` `ranks` state par depend karta tha,
 * isliye har profile fetch ke baad function ki identity badal jaati thi -
 * FlatList ke renderItem/keyExtractor mein yeh baar-baar re-render trigger
 * karta. Ab "kaunse ids dekh liye/pending hain" ek ref (requestedRef) mein
 * hai, isliye ensureRank ki identity hamesha STABLE rehti hai. Behaviour
 * same: ek id sirf ek baar fetch hota hai.
 */
export default function useRankCache() {
  const [ranks, setRanks] = useState<Record<string, any>>({});
  const [powers, setPowers] = useState<Record<string, any>>({});
  const [verifieds, setVerifieds] = useState<Record<string, boolean>>({});
  const [elites, setElites] = useState<Record<string, boolean>>({});
  const [avatars, setAvatars] = useState<Record<string, CachedAvatar>>({}); // { [id]: { equippedItems, photoUrl } }
  const requestedRef = useRef(new Set<string>()); // fetch ho chuke YA chal rahe ids

  const ensureRank = useCallback((rawId: string | number | null | undefined) => {
    if (rawId == null || rawId === '') return;
    const id = String(rawId);
    if (requestedRef.current.has(id)) return;
    requestedRef.current.add(id);

    const token = getToken();
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    axios
      .get(`${API_BASE}/profile/${id}`, config)
      .then((res) => {
        setRanks((prev) => ({ ...prev, [id]: res.data?.[FIELD.rank] ?? null }));
        setPowers((prev) => ({ ...prev, [id]: res.data?.[FIELD.power] ?? null }));
        setVerifieds((prev) => ({ ...prev, [id]: !!res.data?.[FIELD.verified] }));
        setElites((prev) => ({ ...prev, [id]: !!res.data?.[FIELD.elite] }));

        const equippedItems = res.data?.[FIELD.equipped] || [];
        const rawAvatarUrl = res.data?.[FIELD.avatar];
        const avatarVersion = res.data?.[FIELD.avatarVersion];
        const photoUrl = resolveAvatarUrl(id, avatarVersion, rawAvatarUrl);

        setAvatars((prev) => ({ ...prev, [id]: { equippedItems, photoUrl } }));
      })
      .catch(() => {
        // Web jaisa hi: fail hone par bhi id "dekh liya" maana jaata hai (baar-baar retry nahi)
        setRanks((prev) => ({ ...prev, [id]: null }));
        setPowers((prev) => ({ ...prev, [id]: null }));
        setVerifieds((prev) => ({ ...prev, [id]: false }));
        setElites((prev) => ({ ...prev, [id]: false }));
        setAvatars((prev) => ({ ...prev, [id]: { equippedItems: [], photoUrl: undefined } }));
      });
  }, []);

  return { ranks, powers, verifieds, elites, avatars, ensureRank };
}