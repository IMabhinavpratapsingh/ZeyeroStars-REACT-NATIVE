import { useCallback, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import useNotification, { type InAppNotification } from '../../../shared/hooks/useNotification';

export type MentionKind = 'room_mention' | 'comment_mention' | 'post_mention';

export interface MentionEvent {
  mention_type: MentionKind;
  sender_user_id: string | number;
  sender_username?: string;
  content?: string;
  reference_id: string | number;
}

export interface NotifClickPayload extends InAppNotification {
  kind?: MentionKind;
  referenceId?: string | number;
}

export interface UseNotificationStateArgs {
  /** useRoomState().openRoom - "room_mention" tap par seedha us room mein le jaane ke liye. */
  openRoom: (room: { id: string | number; [key: string]: any }) => void;
  /** useDMState().openChat - plain DM notification (tip/message) tap par. */
  openChat: (user: any) => void;
  /**
   * Post/comment mention tap par poora post object load karke dikhana hai
   * (PostDetailModal ka RN port abhi nahi bana - jab bane, yeh callback
   * wire kar dena; tab tak hook fetch karke bhi silently no-op rahega taaki
   * crash na ho).
   */
  onOpenPost?: (post: any) => void;
}

/**
 * Web ke Dashboard.jsx (4281 lines) ke notification-bell + in-app-toast
 * hisse ka RN/TS port:
 *   - showNotifications (NotificationsModal open/close) + hasUnreadNotifications (bell red-dot)
 *   - useNotification() ka toast (notif/showNotification/clearForUser) - already shared/hooks mein migrated, yahan sirf re-export/orchestrate
 *   - handleMention: websocket "mention" event -> bell red-dot + toast
 *   - handleNotificationPing: like/comment (bina mention ke) ka halka "ping" -> sirf red-dot
 *   - handleNotifClick: toast ya NotificationsModal row tap karne par sahi jagah navigate
 *
 * Web version mein comment/post-mention click backend se poora post fetch
 * karke PostDetailModal kholta tha (openPost/setLikeCounts/setLikedPosts) -
 * woh feed-detail slice abhi RN mein nahi bana (useFeedState.ts filhaal MVP
 * hai), isliye yahan wahi fetch dobara karte hain aur result onOpenPost ko
 * de dete hain - jab PostDetailModal ban jaaye, bas onOpenPost wire kar dena.
 */
export default function useNotificationState({ openRoom, openChat, onOpenPost }: UseNotificationStateArgs) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const { notif, showNotification, clearForUser } = useNotification();

  /** App mount / login ke baad ek baar - bell par red-dot chahiye ya nahi. */
  const fetchUnreadCount = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/notifications/unread_count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHasUnreadNotifications((res.data?.count || 0) > 0);
    } catch (err: any) {
      console.error('Unread notifications count error:', err?.response?.data || err?.message);
    }
  }, []);

  /**
   * websocket "mention" event - room mein mention, comment mein mention, ya
   * post mein mention, teeno isi se aate hain. Pehle yahan "agar wahi room
   * khula hai to suppress karo" wala logic tha - hata diya gaya (DM jaisa hi
   * hamesha turant notify karega).
   */
  const handleMention = useCallback(
    (data: MentionEvent) => {
      const { mention_type, sender_user_id, sender_username, content, reference_id } = data;

      setHasUnreadNotifications(true);

      const label =
        mention_type === 'room_mention'
          ? 'mentioned you in a room'
          : mention_type === 'comment_mention'
          ? 'mentioned you in a comment'
          : 'mentioned you in a post';

      showNotification(
        { id: sender_user_id, username: sender_username },
        content,
        { label, kind: mention_type, referenceId: reference_id }
      );
    },
    [showNotification]
  );

  /** Like/comment (mention ke bina) - sirf bell par red-dot, koi toast nahi. */
  const handleNotificationPing = useCallback(() => {
    setHasUnreadNotifications(true);
  }, []);

  /** Toast ya NotificationsModal ki kisi row par tap - sahi screen par le jao. */
  const handleNotifClick = useCallback(
    async (n: NotifClickPayload | null | undefined) => {
      if (!n) return;

      if (n.kind === 'room_mention' && n.referenceId != null) {
        openRoom({ id: n.referenceId });
        return;
      }

      if ((n.kind === 'comment_mention' || n.kind === 'post_mention') && n.referenceId != null) {
        try {
          const token = getToken();
          const res = await axios.get(`${API_BASE}/feed/post/${n.referenceId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const post = res.data?.post;
          if (post) onOpenPost?.(post);
        } catch (err: any) {
          console.error('Mentioned post load error:', err?.response?.data || err?.message);
        }
        return;
      }

      openChat(n.user);
    },
    [openRoom, openChat, onOpenPost]
  );

  /** NotificationsModal row tap (item.post_id se) - post_id se hi direct open, koi "kind" wrapper nahi. */
  const openPostFromNotification = useCallback(
    async (postId: string | number) => {
      try {
        const token = getToken();
        const res = await axios.get(`${API_BASE}/feed/post/${postId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.data?.post) onOpenPost?.(res.data.post);
      } catch (err: any) {
        console.error('Open post from notification error:', err?.response?.data || err?.message);
      }
    },
    [onOpenPost]
  );

  /** Bell icon tap - modal kholo + red-dot turant clear (BottomNav/Header ka stableNotificationsClick). */
  const openNotifications = useCallback(() => {
    setShowNotifications(true);
    setHasUnreadNotifications(false);
  }, []);

  const closeNotifications = useCallback(() => {
    setShowNotifications(false);
  }, []);

  return {
    // state
    showNotifications,
    setShowNotifications,
    hasUnreadNotifications,
    setHasUnreadNotifications,
    notif,

    // actions
    fetchUnreadCount,
    showNotification,
    clearForUser,
    handleMention,
    handleNotificationPing,
    handleNotifClick,
    openPostFromNotification,
    openNotifications,
    closeNotifications,
  };
}

export type UseNotificationStateReturn = ReturnType<typeof useNotificationState>;