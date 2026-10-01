import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import networkManager, { getToken } from '../../../shared/services/NetworkManager';
import { getMyId } from '../../../shared/utils/auth';
import { showAlert } from '../../../shared/utils/alertBus';
import { confirmAction } from '../../../shared/utils/confirmBus';
import {
  getCachedMessages,
  setCachedMessages,
  appendCachedMessage,
  prependCachedMessages,
  removeCachedMessageEverywhere,
  updateCachedMessageContent,
  clearCachedMessages,
  type CachedDMMessage,
} from '../../dm/services/dmMessagesCache';
import type { InboxRow, UseInboxStateReturn } from './useInboxState';

const DM_PAGE_SIZE = 20; // scroll-up (older) pagination
const DM_INITIAL_SIZE = 10; // chat kholte hi sirf latest 10 messages
// Typing "false" event kho jaaye (network drop etc.) to inbox row par "typing..."
// hamesha atka na rahe - itne time baad apne aap hat jaata hai.
const TYPING_SAFETY_EXPIRE_MS = 30000;

// DB se (chat_messages table se) aane wala raw row snake_case mein hota hai
// (is_tip, tip_amount) - lekin DMChatWindow ka bubble component `msg.isTip`
// (camelCase) check karta hai (live websocket tip event jaisa). History se
// load hui tip dobara "normal" text message ban ke render na ho, isliye
// yeh helper DB row ko wahi live-event shape de deta hai.
const normalizeDMHistoryMessage = (m: any): CachedDMMessage => ({
  ...m,
  seen: !!m.read_at,
  isTip: !!m.is_tip,
  edited: !!m.is_edited,
});

export type DMUser = {
  id?: string | number;
  target_id?: string | number;
  username?: string;
  is_verified?: boolean;
  is_elite?: boolean;
  avatar_url?: string | null;
  avatar_version?: number;
  _isRequest?: boolean;
  [key: string]: any;
};

export interface UseDMStateArgs {
  inbox: UseInboxStateReturn;
  cacheUser: (u: { id: string | number; username?: string; [key: string]: any }) => void;
  getUsername: (id: string | number) => string | undefined;
  clearForUser: (id: string | number) => void;
  /** useRoomState().setRoomScreenVisible - DM khulte waqt room screen minimize karna */
  setRoomScreenVisible: (v: boolean) => void;
  /** useNotification().showNotification - naya DM/request popup ke liye (jab chat/inbox khuli na ho) */
  showNotification: (from: { id: string | number; username?: string; avatar_url?: string | null; avatar_version?: number }, text: string) => void;
  /** Dashboard-level "kya inbox modal abhi khuli hai" - popup dikhana hai ya nahi, isi se decide hota hai */
  isInboxOpen: () => boolean;
}

/**
 * Web ke Dashboard.jsx ka DM-CHAT-WINDOW hissa (selectedDM khulne ke baad
 * ka poora flow: history load, send/edit/delete, typing, message-requests
 * accept/decline). Inbox-LIST (list preview, unread counts) `useInboxState`
 * mein hai - yeh hook usko `inbox` prop se consume karta hai taaki chat
 * ke andar hone wale actions (naya message bhejna, edit, delete, accept
 * request) turant Primary list mein bhi reflect ho jaayein - bilkul
 * web-version jaisa hi real-time behavior, bas do hooks mein split.
 */
export default function useDMState({
  inbox,
  cacheUser,
  getUsername,
  clearForUser,
  setRoomScreenVisible,
  showNotification,
  isInboxOpen,
}: UseDMStateArgs) {
  const [selectedDM, setSelectedDM] = useState<DMUser | null>(null);
  const [chatMessages, setChatMessages] = useState<CachedDMMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [dmHasMore, setDmHasMore] = useState(false);
  const [dmLoadingMore, setDmLoadingMore] = useState(false);
  const [dmOtherTyping, setDmOtherTyping] = useState(false);
  // Inbox list ke liye: kaun-kaun se users (target_id strings) abhi mujhe type kar rahe hain -
  // chat khuli ho ya nahi, dono case mein.
  const [dmTypingIds, setDmTypingIds] = useState<string[]>([]);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const setTypingFor = useCallback((senderId: string | number, typing: boolean) => {
    const key = String(senderId);
    const timers = typingTimersRef.current;
    const existing = timers.get(key);
    if (existing) {
      clearTimeout(existing);
      timers.delete(key);
    }
    if (typing) {
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          setDmTypingIds((prev) => prev.filter((id) => id !== key));
        }, TYPING_SAFETY_EXPIRE_MS)
      );
      setDmTypingIds((prev) => (prev.includes(key) ? prev : [...prev, key]));
    } else {
      setDmTypingIds((prev) => (prev.includes(key) ? prev.filter((id) => id !== key) : prev));
    }
  }, []);

  useEffect(() => {
    const timers = typingTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);
  const [dmDraftMessage, setDmDraftMessage] = useState('');
  // target_id -> "pending_sent" | "pending_incoming" | "denied" | "declined_by_me" | null
  const [dmRequestLocks, setDmRequestLocks] = useState<Record<string, string | null>>({});

  // "inbox" jab chat Inbox modal ki row tap karke khuli ho - isse yaad
  // rehta hai ki chat band karne par wapas Inbox hi khulni chahiye.
  const dmOpenOriginRef = useRef<string | null>(null);
  // Apna khud ka edit revert karne ke liye (agar backend "dm_edit_error" bole).
  const pendingDMEditsRef = useRef<Map<string, string>>(new Map());

  const getTargetId = (u: DMUser | null) => u && (u.id ?? u.target_id);

  const markDMSeenAndClearUnread = useCallback(
    (targetId: string | number) => {
      networkManager.send({ type: 'dm_seen', target_id: targetId });
      inbox.setInboxList((prev: InboxRow[]) => {
        const row = prev.find((d) => String(d.target_id) === String(targetId));
        const hadUnread = row?.unread_count || 0;
        if (hadUnread > 0) {
          inbox.setDmUnread((u: any) => ({
            total_messages: Math.max(0, u.total_messages - hadUnread),
            senders_count: Math.max(0, u.senders_count - 1),
          }));
        }
        return prev.map((d) =>
          String(d.target_id) === String(targetId) ? { ...d, unread_count: 0 } : d
        );
      });
    },
    [inbox]
  );

  /**
   * origin: "inbox" jab Inbox modal se khola gaya ho (close hone par wapas
   * Inbox khulni chahiye), warna null (profile/search/notif se khuli chat
   * band hone par underlying screen par hi wapas jaana).
   */
  const openChat = useCallback(
    async (user: DMUser, origin: string | null = null, draftMessage = '') => {
      const targetId = getTargetId(user)!;
      dmOpenOriginRef.current = origin;
      setDmDraftMessage(draftMessage || '');

      // Room ke andar se DM khola ja raha ho to room ki screen minimize
      // kar do - membership/radio barkarar rehte hain, sirf screen hategi.
      setRoomScreenVisible(false);

      cacheUser(user as any);
      setSelectedDM(user);
      setDmOtherTyping(false);
      clearForUser(targetId);
      inbox.setShowInbox(false);

      setDmRequestLocks((prev) => ({
        ...prev,
        [String(targetId)]: user._isRequest ? 'pending_incoming' : prev[String(targetId)] ?? null,
      }));

      const cached = getCachedMessages(targetId);

      if (cached) {
        // Cache me zyada ho to bhi screen par sirf latest DM_INITIAL_SIZE (mount halka rahe).
        const initial = cached.messages.slice(-DM_INITIAL_SIZE);
        setChatMessages(initial);
        setDmHasMore(cached.hasMore || cached.messages.length > initial.length);
        setChatLoading(false);
        markDMSeenAndClearUnread(targetId);

        const lastId = cached.messages[cached.messages.length - 1]?.id;
        if (lastId) {
          try {
            const token = getToken();
            const res = await axios.get(`${API_BASE}/ws/dm/history/${targetId}`, {
              headers: { Authorization: `Bearer ${token}` },
              params: { after: lastId },
            });
            const missed = (res.data.messages || []).map(normalizeDMHistoryMessage);
            if (missed.length) {
              setChatMessages((prev) => [...prev, ...missed]);
              setCachedMessages(targetId, [...cached.messages, ...missed], cached.hasMore);
            }
          } catch (err: any) {
            console.error('DM catch-up fetch error:', err?.response?.data || err?.message);
          }
        }
        return;
      }

      setChatMessages([]);
      setChatLoading(true);
      setDmHasMore(false);

      try {
        const token = getToken();
        const res = await axios.get(`${API_BASE}/ws/dm/history/${targetId}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: DM_INITIAL_SIZE },
        });
        const messages = (res.data.messages || []).map(normalizeDMHistoryMessage);
        const hasMore = !!res.data.has_more;
        setChatMessages(messages);
        setDmHasMore(hasMore);
        setCachedMessages(targetId, messages, hasMore);
        markDMSeenAndClearUnread(targetId);
      } catch (err: any) {
        console.error('History load error:', err?.response?.data || err?.message);
      } finally {
        setChatLoading(false);
      }
    },
    [cacheUser, clearForUser, inbox, markDMSeenAndClearUnread, setRoomScreenVisible]
  );

  /** Close chat - agar Inbox se khuli thi to wapas Inbox par jaao. */
  const closeChat = useCallback(() => {
    const backToInbox = dmOpenOriginRef.current === 'inbox';
    dmOpenOriginRef.current = null;
    setSelectedDM(null);
    setChatMessages([]);
    setDmOtherTyping(false);
    if (backToInbox) inbox.setShowInbox(true);
  }, [inbox]);

  /** Instagram jaisa "scroll up to load older messages". */
  const loadMoreDMHistory = useCallback(async () => {
    if (!selectedDM || dmLoadingMore || !dmHasMore) return;
    const targetId = getTargetId(selectedDM)!;
    const oldestId = chatMessages[0]?.id;
    if (!oldestId) return;

    setDmLoadingMore(true);
    try {
      const token = getToken();
      const res = await axios.get(`${API_BASE}/ws/dm/history/${targetId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { before: oldestId, limit: DM_PAGE_SIZE },
      });
      const older = (res.data.messages || []).map(normalizeDMHistoryMessage);
      const newHasMore = !!res.data.has_more;
      setChatMessages((prev) => [...older, ...prev]);
      setDmHasMore(newHasMore);
      prependCachedMessages(targetId, older, newHasMore);
    } catch (err: any) {
      console.error('DM load more error:', err?.response?.data || err?.message);
    } finally {
      setDmLoadingMore(false);
    }
  }, [chatMessages, dmHasMore, dmLoadingMore, selectedDM]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text || !text.trim() || !selectedDM) return;
      const targetId = getTargetId(selectedDM)!;

      // WhatsApp/Instagram jaisa: connection na ho to bhi error nahi -
      // sendOrQueue() message ko queue karke khud reconnect trigger kar
      // deta hai, bubble "Sending..." dikhata rehta hai jab tak ack na aaye.
      networkManager.sendOrQueue({ type: 'dm', target_id: targetId, message: text });

      const sentAt = new Date().toISOString();
      const optimisticMsg: CachedDMMessage = {
        content: text,
        sender_id: getMyId() as any,
        created_at: sentAt,
      } as any;
      setChatMessages((prev) => [...prev, optimisticMsg]);
      appendCachedMessage(targetId, optimisticMsg);

      inbox.upsertInboxRow(
        targetId,
        { last_message: text, last_message_time: sentAt, last_message_mine: true },
        {
          target_id: targetId,
          username: selectedDM.username,
          is_verified: !!selectedDM.is_verified,
          last_message: text,
          last_message_time: sentAt,
          last_message_mine: true,
          unread_count: 0,
        }
      );
    },
    [inbox, selectedDM]
  );

  const deleteDMMessage = useCallback(async (messageId: string | number) => {
    if (!messageId) return;
    const ok = await confirmAction({
      title: 'Delete this message?',
      message: "This can't be undone.",
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      const token = getToken();
      const res = await axios.delete(`${API_BASE}/ws/dm/message/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChatMessages((prev) => prev.filter((m) => m.id !== messageId));
      removeCachedMessageEverywhere(messageId);

      if (selectedDM) {
        const targetId = getTargetId(selectedDM)!;
        const newLastMessage = res.data?.last_message ?? '';
        inbox.setInboxList((prev: InboxRow[]) =>
          prev.map((row) =>
            String(row.target_id) === String(targetId) ? { ...row, last_message: newLastMessage } : row
          )
        );
      }
    } catch (err: any) {
      console.error('Delete message error:', err?.response?.data || err?.message);
      showAlert(err?.response?.data?.detail || 'Could not delete message.');
    }
  }, [inbox, selectedDM]);

  const editDMMessage = useCallback(
    (messageId: string | number, newContent: string) => {
      if (!messageId || !newContent || !newContent.trim()) return;
      const trimmed = newContent.trim();

      setChatMessages((prev) => {
        const existing = prev.find((m) => String(m.id) === String(messageId));
        if (existing && !pendingDMEditsRef.current.has(String(messageId))) {
          pendingDMEditsRef.current.set(String(messageId), existing.content);
        }
        return prev.map((m) =>
          String(m.id) === String(messageId) ? { ...m, content: trimmed, edited: true } : m
        );
      });

      if (selectedDM) {
        const targetId = getTargetId(selectedDM)!;
        updateCachedMessageContent(targetId, messageId, trimmed);
      }

      networkManager.send({ type: 'edit_msg', id: messageId, content: trimmed });
    },
    [selectedDM]
  );

  const acceptMessageRequest = useCallback(
    async (targetId: string | number) => {
      const reqRow = inbox.requestsList.find((r: InboxRow) => String(r.target_id) === String(targetId));
      try {
        const token = getToken();
        await axios.post(`${API_BASE}/ws/dm/requests/${targetId}/accept`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });

        inbox.removeRequestRow(targetId);
        setDmRequestLocks((prev) => ({ ...prev, [String(targetId)]: null }));

        if (reqRow) {
          inbox.upsertInboxRow(
            targetId,
            { last_message: reqRow.last_message, unread_count: reqRow.unread_count || 0, last_message_mine: false },
            {
              target_id: targetId,
              username: reqRow.username,
              is_verified: !!reqRow.is_verified,
              is_elite: !!reqRow.is_elite,
              avatar_url: reqRow.avatar_url,
              avatar_version: reqRow.avatar_version,
              last_message: reqRow.last_message,
              last_message_mine: false,
              unread_count: reqRow.unread_count || 0,
            }
          );
        }
      } catch (err: any) {
        console.error('Accept request error:', err?.response?.data || err?.message);
        showAlert('Could not accept this request, try again.');
      }
    },
    [inbox]
  );

  const declineMessageRequest = useCallback(
    async (targetId: string | number) => {
      try {
        const token = getToken();
        await axios.post(`${API_BASE}/ws/dm/requests/${targetId}/decline`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        inbox.removeRequestRow(targetId);
        // Decline karne wale (hum) ke liye messaging open rehti hai - isliye
        // "denied" nahi, alag "declined_by_me" lagate hain (input normal
        // rehta hai, bas ek chhota note dikhta hai).
        setDmRequestLocks((prev) => ({ ...prev, [String(targetId)]: 'declined_by_me' }));
      } catch (err: any) {
        console.error('Decline request error:', err?.response?.data || err?.message);
        showAlert('Could not decline this request, try again.');
      }
    },
    [inbox]
  );

  /** Instagram jaisa "Delete chat" - sirf apni Primary inbox se hataata hai. */
  const deleteConversation = useCallback(
    async (targetId: string | number) => {
      const row = inbox.inboxList.find((d: InboxRow) => String(d.target_id) === String(targetId));
      try {
        const token = getToken();
        await axios.delete(`${API_BASE}/ws/dm/conversation/${targetId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        inbox.setInboxList((prev: InboxRow[]) => prev.filter((d) => String(d.target_id) !== String(targetId)));
        if (row?.unread_count) {
          inbox.setDmUnread((prev: any) => ({
            total_messages: Math.max(0, prev.total_messages - (row.unread_count || 0)),
            senders_count: Math.max(0, prev.senders_count - 1),
          }));
        }
        clearCachedMessages(targetId);

        if (selectedDM && String(getTargetId(selectedDM)) === String(targetId)) {
          setSelectedDM(null);
          setChatMessages([]);
          inbox.setShowInbox(true);
        }
      } catch (err: any) {
        console.error('Delete conversation error:', err?.response?.data || err?.message);
        showAlert('Could not delete this chat, try again.');
      }
    },
    [inbox, selectedDM]
  );

  // ---------------------------------------------------------------------
  // Websocket handlers - Dashboard inko useWebSocket() ke merged handlers
  // object mein spread karega (dekho useInboxState.ts ka top-level note).
  // ---------------------------------------------------------------------

  const handleDM = useCallback(
    (data: any) => {
      const dmId = selectedDM && getTargetId(selectedDM);
      if (selectedDM && String(data.sender_id) === String(dmId)) {
        const targetId = dmId!;
        const newMsg: CachedDMMessage = {
          id: data.id,
          content: data.content,
          sender_id: data.sender_id,
          created_at: data.created_at,
        } as any;
        setChatMessages((prev) => [...prev, newMsg]);
        appendCachedMessage(targetId, newMsg);
        setDmOtherTyping(false);
        setTypingFor(data.sender_id, false);

        if (data.conversation_status === 'pending') {
          setDmRequestLocks((prev) => ({ ...prev, [String(targetId)]: 'pending_incoming' }));
          inbox.addRequestRow({
            target_id: targetId,
            username: selectedDM.username,
            is_verified: !!selectedDM.is_verified,
            avatar_url: data.sender_avatar_url,
            avatar_version: data.sender_avatar_version,
            last_message: data.content,
          });
        } else if (data.conversation_status === 'accepted') {
          setDmRequestLocks((prev) => (prev[String(targetId)] ? { ...prev, [String(targetId)]: null } : prev));
        }

        networkManager.send({ type: 'dm_seen', target_id: data.sender_id });

        inbox.upsertInboxRow(
          data.sender_id,
          { last_message: data.content, last_message_time: data.created_at, last_message_mine: false },
          {
            target_id: data.sender_id,
            username: selectedDM.username,
            is_verified: !!selectedDM.is_verified,
            avatar_url: data.sender_avatar_url,
            avatar_version: data.sender_avatar_version,
            last_message: data.content,
            last_message_time: data.created_at,
            last_message_mine: false,
            unread_count: 0,
          }
        );
      } else {
        setTypingFor(data.sender_id, false);
        const senderName = getUsername(data.sender_id) || data.sender_username || 'Someone';
        if (data.sender_username) cacheUser({ id: data.sender_id, username: data.sender_username });

        if (data.conversation_status === 'pending') {
          inbox.addRequestRow({
            target_id: data.sender_id,
            username: senderName,
            is_verified: false,
            avatar_url: data.sender_avatar_url,
            avatar_version: data.sender_avatar_version,
            last_message: data.content,
          });
          if (!isInboxOpen()) {
            showNotification(
              { id: data.sender_id, username: senderName, avatar_url: data.sender_avatar_url, avatar_version: data.sender_avatar_version },
              `Message request: ${data.content}`
            );
          }
          return;
        }

        if (!isInboxOpen()) {
          showNotification(
            { id: data.sender_id, username: senderName, avatar_url: data.sender_avatar_url, avatar_version: data.sender_avatar_version },
            data.content
          );
        }

        inbox.bumpUnread(
          !inbox.inboxList.some(
            (d: InboxRow) => String(d.target_id) === String(data.sender_id) && (d.unread_count || 0) > 0
          )
        );

        inbox.upsertInboxRow(
          data.sender_id,
          (row: InboxRow) => ({
            ...row,
            unread_count: (row.unread_count || 0) + 1,
            last_message: data.content,
            last_message_time: data.created_at,
            last_message_mine: false,
          }),
          {
            target_id: data.sender_id,
            username: senderName,
            is_verified: false,
            avatar_url: data.sender_avatar_url,
            avatar_version: data.sender_avatar_version,
            last_message: data.content,
            last_message_time: data.created_at,
            last_message_mine: false,
            unread_count: 1,
          }
        );
      }
    },
    [cacheUser, getUsername, inbox, isInboxOpen, selectedDM, setTypingFor, showNotification]
  );

  const handleDMSeen = useCallback(
    (data: any) => {
      const dmId = selectedDM && getTargetId(selectedDM);
      if (!selectedDM || String(data.by_id) !== String(dmId)) return;
      const seenIds = new Set((data.message_ids || []).map(String));
      setChatMessages((prev) =>
        prev.map((m) => (m.id && seenIds.has(String(m.id)) ? { ...m, seen: true } : m))
      );
    },
    [selectedDM]
  );

  const handleDMTyping = useCallback(
    (data: any) => {
      // Inbox list ke liye - chat khuli ho ya na ho, har sender ka typing track hota hai.
      setTypingFor(data.sender_id, !!data.is_typing);

      const dmId = selectedDM && getTargetId(selectedDM);
      if (dmId && String(data.sender_id) === String(dmId)) {
        setDmOtherTyping(!!data.is_typing);
      }
    },
    [selectedDM, setTypingFor]
  );

  const handleDMBlocked = useCallback((data: any) => {
    setChatMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => !m.id && m.content === data.content);
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.filter((_, i) => i !== realIdx);
    });
    showAlert(data.message || 'Message not sent - blocked');
  }, []);

  const handleDMRequestPending = useCallback(
    (data: any) => {
      setChatMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => !m.id && m.content === data.content);
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        return prev.filter((_, i) => i !== realIdx);
      });

      const myId = getMyId();
      const iAmInitiator = String(data.initiator_id ?? myId) === String(myId);
      let lock: string;
      if (!iAmInitiator) {
        lock = 'pending_incoming';
      } else if (data.conversation_status === 'denied') {
        lock = 'denied';
      } else {
        lock = 'pending_sent';
      }
      setDmRequestLocks((prev) => ({ ...prev, [String(data.target_id)]: lock }));

      if (lock === 'pending_incoming') {
        const known =
          selectedDM && String(getTargetId(selectedDM)) === String(data.target_id) ? selectedDM : null;
        inbox.addRequestRow({
          target_id: data.target_id,
          username: known?.username || getUsername(data.target_id) || 'Someone',
          is_verified: !!known?.is_verified,
          avatar_url: known?.avatar_url,
          avatar_version: known?.avatar_version,
          last_message: data.content,
        });
      } else {
        showAlert(data.message || "You can't send another message until they accept your request.");
      }
    },
    [getUsername, inbox, selectedDM]
  );

  const handleDMRequestAccepted = useCallback(
    (data: any) => {
      const otherId = data.other_id;
      setDmRequestLocks((prev) => ({ ...prev, [String(otherId)]: null }));
      const otherName = getUsername(otherId) || 'Someone';
      showAlert(`${otherName} accepted your message request!`, 'success');
      inbox.refreshInbox();
    },
    [getUsername, inbox]
  );

  const handleDMDelete = useCallback(
    (data: any) => {
      setChatMessages((prev) => prev.filter((m) => String(m.id) !== String(data.message_id)));
      removeCachedMessageEverywhere(data.message_id);

      if (data.last_message !== undefined && data.other_id) {
        const existingRow = inbox.inboxList.find(
          (row: InboxRow) => String(row.target_id) === String(data.other_id)
        );
        const hadUnread = !!(data.was_unread && existingRow && (existingRow.unread_count || 0) > 0);

        inbox.setInboxList((prev: InboxRow[]) =>
          prev.map((row) => {
            if (String(row.target_id) !== String(data.other_id)) return row;
            const newUnread = hadUnread ? Math.max(0, (row.unread_count || 0) - 1) : row.unread_count;
            return { ...row, last_message: data.last_message, unread_count: newUnread };
          })
        );

        if (hadUnread) {
          const willBeZero = (existingRow!.unread_count || 0) - 1 <= 0;
          inbox.setDmUnread((prev: any) => ({
            total_messages: Math.max(0, prev.total_messages - 1),
            senders_count: willBeZero ? Math.max(0, prev.senders_count - 1) : prev.senders_count,
          }));
        }
      }
    },
    [inbox]
  );

  const handleDMEdit = useCallback(
    (data: any) => {
      setChatMessages((prev) =>
        prev.map((m) =>
          String(m.id) === String(data.message_id) ? { ...m, content: data.content, edited: true } : m
        )
      );
      if (data.other_id) {
        updateCachedMessageContent(data.other_id, data.message_id, data.content);
      }

      // NOTE: backend `updated_last_message` sirf tab bhejta hai jab edited
      // message hi conversation ka SABSE LATEST message tha, warna `null`.
      // `!= null` check zaroori hai - `null !== undefined` bhi true hota
      // hai JS mein, isliye plain `!== undefined` galat overwrite karta.
      if (data.updated_last_message != null && data.other_id) {
        inbox.setInboxList((prev: InboxRow[]) =>
          prev.map((row) =>
            String(row.target_id) === String(data.other_id)
              ? { ...row, last_message: data.updated_last_message }
              : row
          )
        );
      }
    },
    [inbox]
  );

  const handleDMEditAck = useCallback(
    (data: any) => {
      pendingDMEditsRef.current.delete(String(data.message_id));
      if (data.updated_last_message != null && data.other_id) {
        inbox.setInboxList((prev: InboxRow[]) =>
          prev.map((row) =>
            String(row.target_id) === String(data.other_id)
              ? { ...row, last_message: data.updated_last_message }
              : row
          )
        );
      }
    },
    [inbox]
  );

  const handleDMEditError = useCallback(
    (data: any) => {
      const original = pendingDMEditsRef.current.get(String(data.message_id));
      pendingDMEditsRef.current.delete(String(data.message_id));

      if (original !== undefined) {
        setChatMessages((prev) =>
          prev.map((m) => (String(m.id) === String(data.message_id) ? { ...m, content: original, edited: false } : m))
        );
        if (selectedDM) {
          const targetId = getTargetId(selectedDM)!;
          updateCachedMessageContent(targetId, data.message_id, original);
        }
      }
      showAlert(data.error || 'Could not edit message.');
    },
    [selectedDM]
  );

  const handleDMAck = useCallback(
    (data: any) => {
      setChatMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => !m.id && m.content === data.content);
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const updated = [...prev];
        updated[realIdx] = { ...updated[realIdx], id: data.id, created_at: data.created_at };

        if (selectedDM) {
          const targetId = getTargetId(selectedDM)!;
          setCachedMessages(targetId, updated, dmHasMore);
        }
        return updated;
      });

      if (data.conversation_status && selectedDM) {
        const targetId = getTargetId(selectedDM)!;
        setDmRequestLocks((prev) => ({
          ...prev,
          [String(targetId)]: data.conversation_status === 'pending' ? 'pending_sent' : null,
        }));
      }
    },
    [dmHasMore, selectedDM]
  );

  return {
    // state
    selectedDM,
    setSelectedDM,
    chatMessages,
    setChatMessages,
    chatLoading,
    dmHasMore,
    dmLoadingMore,
    dmOtherTyping,
    dmTypingIds,
    dmDraftMessage,
    dmRequestLocks,
    setDmRequestLocks,

    // actions
    openChat,
    closeChat,
    loadMoreDMHistory,
    sendMessage,
    deleteDMMessage,
    editDMMessage,
    acceptMessageRequest,
    declineMessageRequest,
    deleteConversation,

    // ws handlers - Dashboard spreads these into the single useWebSocket() call
    wsHandlers: {
      onDM: handleDM,
      onDMSeen: handleDMSeen,
      onDMTyping: handleDMTyping,
      onDMBlocked: handleDMBlocked,
      onDMRequestPending: handleDMRequestPending,
      onDMRequestAccepted: handleDMRequestAccepted,
      onDMDelete: handleDMDelete,
      onDMEdit: handleDMEdit,
      onDMEditAck: handleDMEditAck,
      onDMEditError: handleDMEditError,
      onDMAck: handleDMAck,
    },
  };
}

export type UseDMStateReturn = ReturnType<typeof useDMState>;