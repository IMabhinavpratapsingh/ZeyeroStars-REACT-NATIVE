import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import { createCachedResource } from '../../../shared/services/persistentCache';
import { getToken } from '../../../shared/services/NetworkManager';

const INBOX_PAGE_SIZE = 10;
const INBOX_CACHE_TTL_MS = 45_000;

export type InboxRow = {
  target_id: string | number;
  username?: string;
  is_verified?: boolean;
  avatar_url?: string | null;
  avatar_version?: number;
  last_message?: string;
  last_message_time?: string;
  last_message_mine?: boolean;
  unread_count?: number;
  _isRequest?: boolean;
  [key: string]: any;
};

type InboxSnapshot = { list: InboxRow[]; hasMore: boolean };

async function fetchInboxFirstPage(): Promise<InboxSnapshot> {
  const token = getToken();
  const res = await axios.get(`${API_BASE}/ws/dm/inbox/list`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { offset: 0, limit: INBOX_PAGE_SIZE },
  });
  return { list: res.data.inbox || [], hasMore: !!res.data.has_more };
}

const inboxResource = createCachedResource<InboxSnapshot>({
  key: 'inbox',
  fetchFn: fetchInboxFirstPage,
  userScoped: true,
  ttlMs: INBOX_CACHE_TTL_MS,
});

export interface UseInboxStateArgs {
  /** useUserCache().cacheUser - inbox/request rows walon ko user-cache mein daal dete hain */
  cacheUser: (u: { id: string | number; username?: string; [key: string]: any }) => void;
  /** Dashboard ka closeOtherNavPanels("dm") - inbox kholte waqt baaki panels band karne ke liye */
  closeOtherNavPanels: (exceptKey: string) => void;
}

/**
 * Web ke Dashboard.jsx (4281 lines) ke inbox-list + message-requests hisse
 * ka RN/TS port. Yeh hook sirf LIST-LEVEL data ka malik hai:
 *   - Primary inbox list (conversations preview)
 *   - Message-requests list (Instagram jaisa "Requests" tab)
 *   - dmUnread summary (total_messages / senders_count)
 *
 * Jaan-boojh kar YEH shamil NAHI hai (woh useDMState ka scope hai, agla
 * hook jo isi file ke functions ko import/call karega):
 *   - selectedDM / chatMessages / dmOtherTyping (khuli hui chat window)
 *   - dmRequestLocks (chat-input lock state - useDMState ke paas rahega,
 *     lekin woh niche wale `upsertInboxRow` / `addRequestRow` ko call
 *     karega jab bhi ek naya "dm"/"dm_request_pending" event aaye)
 *
 * upsertInboxRow yahan se EXPORT hoti hai taaki useDMState ke websocket
 * handlers (onDM, onDMRequestAccepted, sendDMMessage, deleteDMMessage)
 * seedha isi list ko patch kar sakein - bilkul web-version jaisa hi
 * behavior, bas do hooks mein split.
 */
export default function useInboxState({ cacheUser, closeOtherNavPanels }: UseInboxStateArgs) {
  const [showInbox, setShowInbox] = useState(false);

  const [inboxList, setInboxListState] = useState<InboxRow[]>(
    () => inboxResource.getSnapshot()?.list || []
  );
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxOffset, setInboxOffset] = useState(
    () => inboxResource.getSnapshot()?.list?.length || 0
  );
  const inboxHasMoreRef = useRef<boolean>(inboxResource.getSnapshot()?.hasMore || false);
  const [inboxHasMore, setInboxHasMoreState] = useState<boolean>(() => inboxHasMoreRef.current);
  const [inboxLoadingMore, setInboxLoadingMore] = useState(false);
  const [inboxLoaded, setInboxLoaded] = useState<boolean>(() => inboxResource.getSnapshot() != null);

  // Dekho web-version comment: har local mutation is counter ko bump karta
  // hai. Ek background REST revalidate shuru hone se PEHLE is value ko yaad
  // rakhta hai - agar resolve hone tak yeh badal chuka ho (beech mein koi
  // live websocket update aaya), to us STALE REST response ko list par
  // apply nahi karte.
  const inboxRealtimeVersionRef = useRef(0);

  const [dmUnread, setDmUnread] = useState({ total_messages: 0, senders_count: 0 });

  const [requestsList, setRequestsList] = useState<InboxRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsLoadingMore, setRequestsLoadingMore] = useState(false);
  const [requestsOffset, setRequestsOffset] = useState(0);
  const [requestsHasMore, setRequestsHasMore] = useState(false);
  const requestsLoadedRef = useRef(false);

  const setInboxHasMore = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    setInboxHasMoreState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      inboxHasMoreRef.current = next;
      return next;
    });
  }, []);

  const setInboxList = useCallback(
    (updater: InboxRow[] | ((prev: InboxRow[]) => InboxRow[])) => {
      setInboxListState((prev) => {
        const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
        inboxResource.setLocal({ list: next, hasMore: inboxHasMoreRef.current });
        inboxRealtimeVersionRef.current += 1;
        return next;
      });
    },
    []
  );

  /**
   * Inbox list ke ek row ko update karke sabse UPAR le aana - naya message
   * aane/bhejne par poori inbox dobara fetch karne ke bajaye bas yeh row
   * move + update hoti hai (Instagram/WhatsApp jaisa real-time behavior).
   */
  const upsertInboxRow = useCallback(
    (
      targetId: string | number,
      updater: Partial<InboxRow> | ((current: InboxRow) => Partial<InboxRow>),
      fallbackRow?: InboxRow
    ) => {
      setInboxList((prev) => {
        const idx = prev.findIndex((d) => String(d.target_id) === String(targetId));
        if (idx === -1) {
          return fallbackRow ? [fallbackRow, ...prev] : prev;
        }
        const current = prev[idx];
        const patch = typeof updater === 'function' ? (updater as any)(current) : updater;
        const updated = { ...current, ...patch };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });
    },
    [setInboxList]
  );

  /** Requests tab mein ek naya pending request row daalna (agar already na ho). */
  const addRequestRow = useCallback((row: InboxRow) => {
    setRequestsList((prev) => {
      if (prev.some((r) => String(r.target_id) === String(row.target_id))) return prev;
      return [{ ...row, _isRequest: true }, ...prev];
    });
  }, []);

  const removeRequestRow = useCallback((targetId: string | number) => {
    setRequestsList((prev) => prev.filter((r) => String(r.target_id) !== String(targetId)));
  }, []);

  const bumpUnread = useCallback((senderIsNew: boolean) => {
    setDmUnread((prev) => ({
      total_messages: prev.total_messages + 1,
      senders_count: senderIsNew ? prev.senders_count + 1 : prev.senders_count,
    }));
  }, []);

  const applyInboxFetchResult = useCallback(
    (result: InboxSnapshot | null, versionAtFetch?: number) => {
      if (!result) return;
      result.list.forEach((row) => cacheUser({ ...row, id: row.target_id }));
      if (versionAtFetch !== undefined && inboxRealtimeVersionRef.current !== versionAtFetch) {
        // Beech mein koi live websocket update aa chuka hai - yeh REST
        // response ab stale hai, list par apply mat karo.
        setInboxLoaded(true);
        return;
      }
      setInboxListState(result.list);
      setInboxOffset(result.list.length);
      setInboxHasMore(!!result.hasMore);
      setInboxLoaded(true);
    },
    [cacheUser, setInboxHasMore]
  );

  const fetchMessageRequests = useCallback(async () => {
    if (requestsLoadedRef.current) return;
    setRequestsLoading(true);
    try {
      const token = getToken();
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BASE}/ws/dm/requests/list`, {
        ...config,
        params: { offset: 0, limit: INBOX_PAGE_SIZE },
      });
      const list: InboxRow[] = (res.data.requests || []).map((r: any) => ({ ...r, _isRequest: true }));
      list.forEach((row) => cacheUser({ ...row, id: row.target_id }));
      setRequestsList(list);
      setRequestsOffset(list.length);
      setRequestsHasMore(!!res.data.has_more);
      requestsLoadedRef.current = true;
    } catch (err: any) {
      console.error('Message requests fetch error:', err?.response?.data || err?.message);
    } finally {
      setRequestsLoading(false);
    }
  }, [cacheUser]);

  const refreshRequests = useCallback(async () => {
    try {
      const token = getToken();
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BASE}/ws/dm/requests/list`, {
        ...config,
        params: { offset: 0, limit: INBOX_PAGE_SIZE },
      });
      const list: InboxRow[] = (res.data.requests || []).map((r: any) => ({ ...r, _isRequest: true }));
      list.forEach((row) => cacheUser({ ...row, id: row.target_id }));
      setRequestsList(list);
      setRequestsOffset(list.length);
      setRequestsHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Message requests refresh error:', err?.response?.data || err?.message);
    }
  }, [cacheUser]);

  const loadMoreRequests = useCallback(async () => {
    if (requestsLoadingMore || !requestsHasMore) return;
    setRequestsLoadingMore(true);
    try {
      const token = getToken();
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BASE}/ws/dm/requests/list`, {
        ...config,
        params: { offset: requestsOffset, limit: INBOX_PAGE_SIZE },
      });
      const newList: InboxRow[] = (res.data.requests || []).map((r: any) => ({ ...r, _isRequest: true }));
      setRequestsList((prev) => {
        const existingIds = new Set(prev.map((d) => d.target_id));
        return [...prev, ...newList.filter((d) => !existingIds.has(d.target_id))];
      });
      setRequestsOffset((prev) => prev + newList.length);
      setRequestsHasMore(!!res.data.has_more);
      newList.forEach((row) => cacheUser({ ...row, id: row.target_id }));
    } catch (err: any) {
      console.error('Requests load more error:', err?.response?.data || err?.message);
    } finally {
      setRequestsLoadingMore(false);
    }
  }, [cacheUser, requestsHasMore, requestsOffset, requestsLoadingMore]);

  /** Nav button toggle jaisa - already khula ho to band kar do, dobara fetch na ho. */
  const fetchInbox = useCallback(async () => {
    if (showInbox) {
      setShowInbox(false);
      return;
    }

    closeOtherNavPanels('dm');
    setShowInbox(true);
    fetchMessageRequests();

    if (inboxLoaded) return;

    const cachedSnapshot = inboxResource.getSnapshot();
    if (cachedSnapshot != null) {
      setInboxLoaded(true);
      const versionAtFetch = inboxRealtimeVersionRef.current;
      inboxResource.fetchAndApply().then((result) => applyInboxFetchResult(result, versionAtFetch));
      return;
    }

    setInboxLoading(true);
    try {
      const versionAtFetch = inboxRealtimeVersionRef.current;
      const result = await inboxResource.fetchAndApply();
      applyInboxFetchResult(result, versionAtFetch);
    } catch (err) {
      console.error('Inbox failed to load', err);
    } finally {
      setInboxLoading(false);
    }
  }, [applyInboxFetchResult, closeOtherNavPanels, fetchMessageRequests, inboxLoaded, showInbox]);

  /** Pull-to-refresh: TTL bypass karke hamesha backend hit karo. */
  const refreshInbox = useCallback(async () => {
    try {
      const versionAtFetch = inboxRealtimeVersionRef.current;
      const result = await inboxResource.invalidateAndRefetch();
      applyInboxFetchResult(result, versionAtFetch);
    } catch (err) {
      console.error('Inbox refresh error:', err);
    }
  }, [applyInboxFetchResult]);

  /** Scroll-to-bottom "load more" - agla batch of 10 conversations. */
  const loadMoreInbox = useCallback(async () => {
    if (inboxLoadingMore || !inboxHasMore) return;
    setInboxLoadingMore(true);
    try {
      const token = getToken();
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BASE}/ws/dm/inbox/list`, {
        ...config,
        params: { offset: inboxOffset, limit: INBOX_PAGE_SIZE },
      });
      const newList: InboxRow[] = res.data.inbox || [];
      setInboxList((prev) => {
        const existingIds = new Set(prev.map((d) => d.target_id));
        return [...prev, ...newList.filter((d) => !existingIds.has(d.target_id))];
      });
      setInboxOffset((prev) => prev + newList.length);
      setInboxHasMore(!!res.data.has_more);
      newList.forEach((row) => cacheUser({ ...row, id: row.target_id }));
    } catch (err: any) {
      console.error('Inbox load more error:', err?.response?.data || err?.message);
    } finally {
      setInboxLoadingMore(false);
    }
  }, [cacheUser, inboxHasMore, inboxLoadingMore, inboxOffset, setInboxHasMore, setInboxList]);

  const fetchDmUnreadSummary = useCallback(async () => {
    try {
      const token = getToken();
      const res = await axios.get(`${API_BASE}/ws/dm/unread/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDmUnread({
        total_messages: res.data?.total_messages || 0,
        senders_count: res.data?.senders_count || 0,
      });
    } catch (err: any) {
      console.error('DM unread summary error:', err?.response?.data || err?.message);
    }
  }, []);

  return {
    // state
    showInbox,
    setShowInbox,
    inboxList,
    inboxLoading,
    inboxLoadingMore,
    inboxHasMore,
    inboxLoaded,
    dmUnread,
    setDmUnread,
    requestsList,
    setRequestsList,
    requestsLoading,
    requestsLoadingMore,
    requestsHasMore,

    // actions
    fetchInbox,
    refreshInbox,
    loadMoreInbox,
    fetchMessageRequests,
    refreshRequests,
    loadMoreRequests,
    fetchDmUnreadSummary,
    bumpUnread,

    // primitives for useDMState (agla hook) to consume
    upsertInboxRow,
    addRequestRow,
    removeRequestRow,
    setInboxList,
  };
}

export type UseInboxStateReturn = ReturnType<typeof useInboxState>;