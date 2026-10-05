import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { getMyId } from '../../../shared/utils/auth';
import { FIELD } from '../../../shared/utils/profileFields';

/**
 * Apna is_verified status (GET /profile/{myId}).
 *  - undefined = abhi check ho raha hai / fetch fail hua
 *  - true / false = server ka jawab
 *
 * `active` jab bhi false -> true hota hai (jaise Inbox khulta hai) status
 * dobara fetch hota hai - taaki naya verified hone ke baad lock turant hat
 * jaaye (Inbox PersistentSlide hai, mount rehta hai, isliye sirf mount par
 * fetch karna kaafi nahi).
 */
export default function useMyVerified(active: boolean = true): boolean | undefined {
  const [verified, setVerified] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!active) return;
    const myId = getMyId();
    if (!myId) return;
    let cancelled = false;
    const token = getToken();
    axios
      .get(`${API_BASE}/profile/${myId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      .then((res) => {
        if (!cancelled) setVerified(!!res.data?.[FIELD.verified]);
      })
      .catch(() => {
        // fail -> purani value rehne do (undefined = abhi pata nahi)
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return verified;
}