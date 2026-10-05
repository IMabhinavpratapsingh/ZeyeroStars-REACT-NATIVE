import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotiView } from 'moti';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import useAvatarImage from '../../avatar/hooks/useAvatarImage';
import OnlineStatusDot from '../../../shared/components/OnlineStatusDot';
import useLongPress from '../../../shared/hooks/useLongPress';
import confirmAction from '../../../shared/utils/confirmBus';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import KebabMenu, { type KebabMenuHandle } from '../../../shared/components/KebabMenu';
import { getActiveRooms } from '../../rooms/services/roomsApi';
import { Image as ExpoImage } from 'expo-image';
import showAlert from '../../../shared/utils/alertBus';
import { getMyId } from '../../../shared/utils/auth';
import { useInboxWallpaper } from '../services/dmWallpaper';
import useMyVerified from '../services/useMyVerified';
import WallpaperCropModal from './WallpaperCropModal';

/**
 * Ek row alag, memoized component me - Instagram jaisa round pfp, naam ke
 * box se pehle. `dm` object mein backend `/ws/dm/inbox/list` se hi
 * avatar_url + avatar_version already aa jaate hain - isliye alag se
 * GET /profile/{id} query ki koi zaroorat nahi. useAvatarImage seedha inhi
 * do fields ko avatarCache.ts (AsyncStorage-backed, avatar_version ke
 * against) se resolve/cache kar deta hai - same pattern jo LeaderboardModal
 * use karta hai.
 *
 * NOTE: `dm.last_message_time` abhi backend se nahi aata - agar future
 * mein woh field aa jaaye (ISO timestamp), yeh row apne aap "12:34 PM" /
 * "Yesterday" jaisa relative time dikhana shuru kar degi. Tab tak wo hissa
 * simply hide rehta hai.
 *
 * WEB -> RN CHANGES:
 * - Custom `usePullToRefresh` (touch-drag hook) -> RN native
 *   `RefreshControl` on FlatList (har tab ka apna RefreshControl).
 * - `overflow-y-auto` + onScroll bottom-check -> FlatList onEndReached.
 * - `AnimatePresence` + `motion.div` -> moti (same API shape).
 * - `no-scrollbar overflow-x-auto` tab-pills -> horizontal FlatList/ScrollView.
 */
// Last message meri bheji hui hai ya samne wale ki? Backend `last_message_mine`
// (bool) ya `last_sender_id` de to wahi use hota hai.
const truthy = (v: any): boolean | null => {
  if (v === true || v === 1 || v === '1') return true;
  if (v === false || v === 0 || v === '0') return false;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === 'true' || t === 't') return true;
    if (t === 'false' || t === 'f') return false;
  }
  return null;
};

const isMine = (dm: any): boolean => {
  // Backend kabhi boolean, kabhi 0/1 ya "true"/"false" bhejta hai - sab handle.
  const flag = truthy(dm?.last_message_mine ?? dm?.is_last_message_mine ?? dm?.last_message_is_mine);
  if (flag !== null) return flag;
  const senderId = dm?.last_sender_id ?? dm?.last_message_sender_id ?? dm?.last_message_sender;
  if (senderId != null && dm?.target_id != null) {
    return String(senderId) !== String(dm.target_id);
  }
  return false;
};

const formatInboxTime = (iso?: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diffDays = Math.floor(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000
  );
  if (diffDays <= 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
};

interface InboxDM {
  target_id: string | number;
  username?: string;
  avatar_url?: string | null;
  avatar_version?: number | string | null;
  unread_count?: number;
  last_message?: string;
  last_message_mine?: boolean;
  last_message_time?: string | null;
  is_verified?: boolean;
  is_elite?: boolean;
}

const SkeletonCard = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonLineWide} />
    <View style={styles.skeletonLineNarrow} />
  </View>
);

const WorldChatRow = memo(({ onOpen }: { onOpen?: () => void }) => (
  <Pressable onPress={onOpen} style={({ pressed }) => [styles.worldChatRow, pressed && styles.rowPressed]}>
    <View style={styles.worldChatIconWrap}>
      <Ionicons name="globe-outline" size={22} color="#818cf8" />
    </View>
    <View style={styles.rowTextWrap}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        World Chat
      </Text>
      <Text style={styles.rowSubtitle} numberOfLines={1}>
        Everyone playing right now
      </Text>
    </View>
    <Ionicons name="chevron-forward-outline" size={16} color="#525252" />
  </Pressable>
));
WorldChatRow.displayName = 'WorldChatRow';

const InboxRow = memo(
  ({
    dm,
    onSelectDM,
    onDelete,
    isTyping = false,
  }: {
    dm: InboxDM;
    onSelectDM: (dm: InboxDM) => void;
    onDelete: (id: string | number) => void;
    isTyping?: boolean;
  }) => {
    const avatarSrc = useAvatarImage(dm.target_id, dm.avatar_url, dm.avatar_version);
    const unreadCount = Number(dm.unread_count) || 0;
    const hasUnread = unreadCount > 0;
    const time = formatInboxTime(dm.last_message_time);
    const kebabRef = useRef<KebabMenuHandle>(null);

    // Instagram jaisa "Delete chat" - sirf apni taraf se hata deta hai,
    // doosre user ko yeh conversation waisi hi dikhti rehti hai. Naya
    // message aate hi apne aap wapas dikhne lagti hai.
    const handleDelete = async () => {
      const confirmed = await confirmAction({
        title: 'Delete this chat?',
        message: `It'll be removed from your inbox. ${dm.username} will still see it, and it'll come back if they message you again.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (confirmed) onDelete(dm.target_id);
    };

    // 3-dot button ke alawa, row ko long-press karke bhi wahi menu khul
    // jaata hai (mobile par WhatsApp/Instagram jaisa). Long-press fire ho
    // chuka ho to uske baad wala tap (row open karne wala) swallow kar
    // dete hain, warna menu ke saath-saath DM bhi khul jaata.
    const { pressableProps, wasLongPress } = useLongPress(() => kebabRef.current?.open());

    return (
      <Pressable
        {...pressableProps}
        onPress={() => {
          if (wasLongPress()) return;
          onSelectDM(dm);
        }}
        style={({ pressed }) => [
          styles.inboxRow,
          hasUnread ? styles.inboxRowUnread : styles.inboxRowRead,
          pressed && styles.rowPressed,
        ]}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {avatarSrc ? (
              <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarFallback}>{(dm.username || '?').charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <OnlineStatusDot userId={dm.target_id} size={14} />
        </View>

        <View style={styles.rowTextWrap}>
          <View style={styles.nameRow}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {dm.username}
            </Text>
            {dm.is_verified && <VerifiedBadge size="md" />}
            {dm.is_elite && <EliteBadge size="md" />}
          </View>
          {isTyping ? (
            <Text style={styles.typingText} numberOfLines={1}>
              typing...
            </Text>
          ) : (
            <Text style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]} numberOfLines={1}>
              {isMine(dm) && <Text style={styles.youPrefix}>Me: </Text>}
              {dm.last_message}
            </Text>
          )}
        </View>

        <View style={styles.rowTrailing}>
          {!!time && <Text style={styles.timeText}>{time}</Text>}
          <View style={styles.trailingIconRow}>
            <Ionicons name="chevron-forward-outline" size={16} color="#525252" />
            {hasUnread && (
              <View style={styles.rowUnreadBadge}>
                <Text style={styles.rowUnreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        <KebabMenu
          ref={kebabRef}
          title={dm.username}
          hideButton
          items={[{ label: 'Delete chat', icon: <Ionicons name="trash-outline" size={14} color="#f87171" />, danger: true, onClick: handleDelete }]}
        />
      </Pressable>
    );
  }
);
InboxRow.displayName = 'InboxRow';

const RequestRow = memo(
  ({
    dm,
    onSelectDM,
    onAccept,
    onDecline,
  }: {
    dm: InboxDM;
    onSelectDM: (dm: InboxDM) => void;
    onAccept: (id: string | number) => Promise<void> | void;
    onDecline: (id: string | number) => Promise<void> | void;
  }) => {
    const avatarSrc = useAvatarImage(dm.target_id, dm.avatar_url, dm.avatar_version);
    const [busy, setBusy] = useState(false);

    const runAction = async (fn: (id: string | number) => Promise<void> | void) => {
      if (busy) return;
      setBusy(true);
      try {
        await fn(dm.target_id);
      } finally {
        setBusy(false);
      }
    };

    return (
      <View style={styles.requestCard}>
        <Pressable onPress={() => onSelectDM(dm)} style={styles.requestTop}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {avatarSrc ? (
                <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarFallback}>{(dm.username || '?').charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <OnlineStatusDot userId={dm.target_id} size={14} />
          </View>
          <View style={styles.rowTextWrap}>
            <View style={styles.nameRow}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {dm.username}
              </Text>
              {dm.is_verified && <VerifiedBadge size="md" />}
              {dm.is_elite && <EliteBadge size="md" />}
            </View>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {dm.last_message}
            </Text>
          </View>
        </Pressable>

        <View style={styles.requestActions}>
          <Pressable disabled={busy} onPress={() => runAction(onDecline)} style={[styles.declineBtn, busy && styles.btnDisabled]}>
            <Text style={styles.declineBtnText}>Decline</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => runAction(onAccept)} style={[styles.acceptBtn, busy && styles.btnDisabled]}>
            <Text style={styles.acceptBtnText}>Accept</Text>
          </Pressable>
        </View>
      </View>
    );
  }
);
RequestRow.displayName = 'RequestRow';

// "Rooms" tab row - active rooms + is_team (ZeyeroStars) rooms, Inbox ke
// baaki rows jaisa hi list-style.
const RoomInboxRow = memo(({ room, onSelect }: { room: any; onSelect?: (room: any) => void }) => (
  <Pressable
    onPress={() => onSelect?.(room)}
    style={({ pressed }) => [styles.inboxRow, room.is_team ? styles.inboxRowGold : styles.inboxRowRead, pressed && styles.rowPressed]}
  >
    <View style={styles.avatarWrap}>
      <View style={styles.roomAvatar}>
        {room.room_icon_url ? (
          <Image source={{ uri: room.room_icon_url }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarFallback}>{(room.room_name || '?').charAt(0).toUpperCase()}</Text>
        )}
      </View>
      {room.is_team && (
        <View style={styles.teamBadge}>
          <Ionicons name="sparkles-outline" size={10} color="#0a0a0a" />
        </View>
      )}
    </View>

    <View style={styles.rowTextWrap}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {room.room_name}
      </Text>
      <View style={styles.metaRow}>
        <Ionicons name="people-outline" size={12} color="#9a9a9a" />
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {' '}
          {room.user_count || 0}/30 &middot; {room.is_team ? 'ZeyeroStars' : room.owner_username || 'Unknown'}
        </Text>
      </View>
    </View>

    <View style={styles.rowTrailing}>
      {(room.user_count || 0) > 0 && (
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      )}
      <Ionicons name="chevron-forward-outline" size={16} color="#525252" />
    </View>
  </Pressable>
));
RoomInboxRow.displayName = 'RoomInboxRow';

type InboxTab = 'primary' | 'requests' | 'rooms';

interface InboxModalProps {
  show: boolean;
  inboxList: InboxDM[];
  loading?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => Promise<void> | void;
  onClose: () => void;
  onSelectDM: (dm: InboxDM) => void;
  onCompose?: () => void;
  /** Kitni conversations mein unread messages hain (message count nahi). */
  unreadTotal?: number;
  /** Un users ke target_id jo abhi type kar rahe hain (inbox row par "typing..."). */
  typingIds?: string[];
  requestsList?: InboxDM[];
  requestsLoading?: boolean;
  requestsLoadingMore?: boolean;
  onLoadMoreRequests?: () => void;
  onRefreshRequests?: () => Promise<void> | void;
  onAcceptRequest: (id: string | number) => Promise<void> | void;
  onDeclineRequest: (id: string | number) => Promise<void> | void;
  onDeleteConversation: (id: string | number) => void;
  onOpenWorldChat?: () => void;
  onSelectRoom?: (room: any) => void;
}

const TAB_DEFS: { id: InboxTab; label: string }[] = [
  { id: 'primary', label: 'Primary' },
  { id: 'requests', label: 'Requests' },
  { id: 'rooms', label: 'Rooms' },
];

const InboxModal = ({
  show,
  inboxList,
  loading,
  loadingMore,
  onLoadMore,
  onRefresh,
  onClose,
  onSelectDM,
  onCompose,
  unreadTotal = 0,
  typingIds = [],
  requestsList = [],
  requestsLoading = false,
  requestsLoadingMore = false,
  onLoadMoreRequests,
  onRefreshRequests,
  onAcceptRequest,
  onDeclineRequest,
  onDeleteConversation,
  onOpenWorldChat,
  onSelectRoom,
}: InboxModalProps) => {
  const zIndex = useTopZIndex(show);
  const insets = useSafeAreaInsets();

  // Custom Inbox wallpaper - sirf is phone me (AsyncStorage), sirf verified users.
  const iAmVerified = useMyVerified(show);
  const {
    wallpaper,
    pending: wpPending,
    saving: wpSaving,
    startPick: wpStartPick,
    confirmCrop: wpConfirmCrop,
    cancelCrop: wpCancelCrop,
    clear: wpClear,
  } = useInboxWallpaper(getMyId());
  const wpMenuRef = useRef<KebabMenuHandle>(null);
  // Inbox screen ka asli size - crop frame isi shape ka banta hai.
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null);

  const handleWallpaperBtn = async () => {
    if (iAmVerified === undefined) {
      showAlert('Checking your account, try again in a moment.', 'info');
      return;
    }
    if (!iAmVerified) {
      showAlert('Custom wallpaper is only for verified users.', 'info');
      return;
    }
    if (wallpaper) {
      wpMenuRef.current?.open(); // Change / Remove
    } else {
      const r = await wpStartPick();
      if (r === 'error') showAlert('Could not open the image.');
    }
  };

  const handleWallpaperChange = async () => {
    const r = await wpStartPick();
    if (r === 'error') showAlert('Could not open the image.');
  };

  const handleWallpaperRemove = async () => {
    await wpClear();
    showAlert('Wallpaper removed.', 'success');
  };

  const handleWallpaperCropConfirm = async (region: { originX: number; originY: number; width: number; height: number }) => {
    const res = await wpConfirmCrop(region);
    if (res.ok) showAlert('Wallpaper updated (saved on this device only).', 'success');
    else if (res.reason === 'too_large') showAlert('Image is too large, try a different one.');
    else showAlert('Could not set wallpaper.');
  };

  // "primary" = normal accepted chats, "requests" = pending message
  // requests, "rooms" = active rooms (+ ZeyeroStars/is_team rooms),
  const [activeTab, setActiveTab] = useState<InboxTab>('primary');
  // searchTerm: input box me jo abhi type ho raha hai (draft).
  // activeQuery: search button (ya submit) dabane par isme "commit" hota
  // hai - sirf isi se list filter hoti hai.
  const [searchTerm, setSearchTerm] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  // Rooms tab ka apna local data - RoomsModal jaisa hi (waqt-e-zaroorat khud fetch karta hai).
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  // Har tab pehli baar load ho chuka hai kya - dobara us tab par jaane
  // par purani list turant dikhao, silently refresh karo.
  const [loadedExtraTabs, setLoadedExtraTabs] = useState<Record<string, boolean>>({});
  const [refreshingTab, setRefreshingTab] = useState(false);

  const loadRooms = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setRoomsLoading(true);
    try {
      // /rooms/active already active + is_team dono server-side merge
      // karke deta hai - yahan alag se dubara client-side merge nahi karna.
      const res = await getActiveRooms();
      setRoomsList(res.data.rooms || []);
      setLoadedExtraTabs((prev) => ({ ...prev, rooms: true }));
    } catch (err) {
      console.error('Inbox rooms load error:', err);
    } finally {
      if (!silent) setRoomsLoading(false);
    }
  };

  useEffect(() => {
    if (!show) return;
    if (activeTab === 'rooms') loadRooms({ silent: !!loadedExtraTabs.rooms });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, activeTab]);

  const runSearch = () => setActiveQuery(searchTerm.trim());

  const handlePullRefresh = async () => {
    setRefreshingTab(true);
    try {
      if (activeTab === 'requests') {
        await onRefreshRequests?.();
      } else if (activeTab === 'rooms') {
        await loadRooms({ silent: true });
      } else {
        await onRefresh?.();
      }
    } finally {
      setRefreshingTab(false);
    }
  };

  // Sirf client-side filter - poori list already load ho chuki hoti hai.
  const filteredList = useMemo(() => {
    const q = activeQuery.toLowerCase();
    if (!q) return inboxList;
    return inboxList.filter((dm) => (dm.username || '').toLowerCase().includes(q));
  }, [inboxList, activeQuery]);

  const filteredRequests = useMemo(() => {
    const q = activeQuery.toLowerCase();
    if (!q) return requestsList;
    return requestsList.filter((dm) => (dm.username || '').toLowerCase().includes(q));
  }, [requestsList, activeQuery]);

  const filteredRooms = useMemo(() => {
    const q = activeQuery.toLowerCase();
    if (!q) return roomsList;
    return roomsList.filter((r) => (r.room_name || '').toLowerCase().includes(q));
  }, [roomsList, activeQuery]);

  return (
    <AnimatePresence>
      {show && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 180 }}
          style={[
            styles.screen,
            // NOTE: parent (DMOverlayScreen -> PersistentSlide) already
            // absolute-positions itself with `bottom: BOTTOM_NAV_PX`, isliye
            // yahan wapas BOTTOM_NAV_PX+insets.bottom ghatana DOUBLE-COUNT
            // tha - is (already correctly bounded) parent ke andar bas
            // `bottom: 0` (poora parent fill) sahi hai, warna BottomNav se
            // upar ek extra khaali gap/"border" dikhta tha.
            { zIndex, elevation: 20, paddingTop: insets.top + 16, bottom: 0 },
          ]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setBoxSize((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
          }}
        >
          {/* Wallpaper: sirf tab jab abhi bhi verified ho (verification lapse -> default bg) */}
          {!!wallpaper && iAmVerified !== false && (
            <>
              <ExpoImage source={{ uri: wallpaper }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.wallpaperDim} pointerEvents="none" />
            </>
          )}
          <WallpaperCropModal
            source={wpPending}
            aspect={boxSize ? boxSize.w / boxSize.h : undefined}
            saving={wpSaving}
            onCancel={wpCancelCrop}
            onConfirm={handleWallpaperCropConfirm}
          />
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="mail-outline" size={22} color="#818cf8" />
                {unreadTotal > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text>
                  </View>
                )}
              </View>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle}>Messages</Text>
                <Text style={styles.headerSubtitle}>Chat with your friends & communities</Text>
              </View>
              <Pressable onPress={handleWallpaperBtn} style={styles.headerActionBtn} hitSlop={4}>
                <Ionicons
                  name={iAmVerified === false ? 'lock-closed-outline' : 'image-outline'}
                  size={18}
                  color="#d4d4d4"
                />
              </Pressable>
              <KebabMenu
                ref={wpMenuRef}
                hideButton
                items={[
                  {
                    label: 'Change wallpaper',
                    icon: <Ionicons name="image-outline" size={16} color="#ffffff" />,
                    onClick: handleWallpaperChange,
                  },
                  {
                    label: 'Remove wallpaper',
                    icon: <Ionicons name="trash-outline" size={16} color="#ffffff" />,
                    onClick: handleWallpaperRemove,
                  },
                ]}
              />
              <Pressable onPress={onCompose} style={styles.headerActionBtn}>
                <Ionicons name="create-outline" size={18} color="#d4d4d4" />
              </Pressable>
              <Pressable onPress={onClose} style={styles.headerActionBtn}>
                <Ionicons name="chevron-forward-outline" size={18} color="#d4d4d4" style={styles.rotate90} />
              </Pressable>
            </View>

            <FlatList
              horizontal
              data={TAB_DEFS}
              keyExtractor={(t) => t.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsRow}
              renderItem={({ item: t }) => {
                const active = activeTab === t.id;
                return (
                  <Pressable onPress={() => setActiveTab(t.id)} style={[styles.tabPill, active ? styles.tabPillActive : styles.tabPillInactive]}>
                    {t.id === 'primary' && active && unreadTotal > 0 && <View style={styles.tabUnreadDot} />}
                    {t.id === 'rooms' && <Ionicons name="exit-outline" size={14} color={active ? '#0a0a0a' : '#9a9a9a'} />}
                    <Text style={[styles.tabPillText, active ? styles.tabPillTextActive : styles.tabPillTextInactive]}>{t.label}</Text>
                    {t.id === 'primary' && unreadTotal > 0 && (
                      <Text style={active ? styles.tabCountActive : styles.tabCountInactive}>
                        {unreadTotal > 99 ? '99+' : unreadTotal}
                      </Text>
                    )}
                    {t.id === 'requests' && requestsList.length > 0 && (
                      <Text style={active ? styles.tabCountActive : styles.tabCountInactive}>
                        {requestsList.length > 99 ? '99+' : requestsList.length}
                      </Text>
                    )}
                  </Pressable>
                );
              }}
            />

            <View style={styles.searchBar}>
              <Pressable onPress={runSearch} hitSlop={8}>
                <Ionicons name="search-outline" size={16} color="#6e6e6e" />
              </Pressable>
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                onSubmitEditing={runSearch}
                placeholder="Search by username..."
                placeholderTextColor="#6e6e6e"
                style={styles.searchInput}
              />
            </View>
          </View>

          {activeTab === 'primary' && (
            <FlatList
              data={filteredList}
              extraData={typingIds}
              keyExtractor={(item) => String(item.target_id)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshingTab} onRefresh={handlePullRefresh} tintColor="#818cf8" />}
              onEndReachedThreshold={0.4}
              onEndReached={onLoadMore}
              ListHeaderComponent={!activeQuery ? <WorldChatRow onOpen={onOpenWorldChat} /> : null}
              ListEmptyComponent={
                loading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </>
                ) : (
                  <Text style={styles.emptyText}>{activeQuery ? `No conversation with "${activeQuery}"` : 'No messages found.'}</Text>
                )
              }
              ListFooterComponent={loadingMore ? <SkeletonCard /> : null}
              renderItem={({ item }) => (
                <InboxRow
                  dm={item}
                  onSelectDM={onSelectDM}
                  onDelete={onDeleteConversation}
                  isTyping={typingIds.includes(String(item.target_id))}
                />
              )}
            />
          )}

          {activeTab === 'requests' && (
            <FlatList
              data={filteredRequests}
              keyExtractor={(item) => String(item.target_id)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshingTab} onRefresh={handlePullRefresh} tintColor="#818cf8" />}
              onEndReachedThreshold={0.4}
              onEndReached={onLoadMoreRequests}
              ListEmptyComponent={
                requestsLoading ? (
                  <>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </>
                ) : (
                  <Text style={styles.emptyText}>{activeQuery ? `No request from "${activeQuery}"` : 'No message requests.'}</Text>
                )
              }
              ListFooterComponent={requestsLoadingMore ? <SkeletonCard /> : null}
              renderItem={({ item }) => (
                <RequestRow dm={item} onSelectDM={onSelectDM} onAccept={onAcceptRequest} onDecline={onDeclineRequest} />
              )}
            />
          )}

          {activeTab === 'rooms' && (
            <FlatList
              data={filteredRooms}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshingTab} onRefresh={handlePullRefresh} tintColor="#818cf8" />}
              ListEmptyComponent={
                roomsLoading ? (
                  <>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </>
                ) : (
                  <Text style={styles.emptyText}>{activeQuery ? `No room called "${activeQuery}"` : 'No active rooms right now.'}</Text>
                )
              }
              renderItem={({ item }) => <RoomInboxRow room={item} onSelect={onSelectRoom} />}
            />
          )}
        </MotiView>
      )}
    </AnimatePresence>
  );
};

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    // FIX: yahan pehle hardcoded `bottom: 76` tha (purani web value, jo
    // BottomNav ki asli height (BOTTOM_NAV_PX=80) + phone ka bottom
    // safe-area inset (gesture bar) - dono se match nahi karta tha,
    // isliye content BottomNav se pehle hi khatam ho jaata tha aur beech
    // mein khaali black gap dikhta tha. Ab yeh dynamically inline style
    // se set hota hai (upar `bottom: BOTTOM_NAV_PX + insets.bottom`).
    backgroundColor: '#0a0a0a', // star-900
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#161616', // star-800
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(129,140,248,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#dc2626',
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  headerTitleWrap: { flex: 1, minWidth: 0, paddingTop: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff' },
  headerSubtitle: { fontSize: 13, color: '#9a9a9a' },
  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotate90: { transform: [{ rotate: '90deg' }] },
  tabsRow: { gap: 8, marginTop: 16 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  tabPillActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  tabPillInactive: { backgroundColor: '#161616', borderColor: '#262626' },
  tabPillText: { fontSize: 13, fontWeight: '700' },
  tabPillTextActive: { color: '#020617' },
  tabPillTextInactive: { color: '#d4d4d4' },
  tabUnreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626' },
  tabCountActive: { color: 'rgba(2,6,23,0.6)', fontSize: 13, fontWeight: '700' },
  tabCountInactive: { color: '#6e6e6e', fontSize: 13, fontWeight: '700' },
  searchBar: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 14, padding: 0 },
  listContent: { padding: 16, gap: 10 },
  wallpaperDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  emptyText: { color: '#6e6e6e', textAlign: 'center', marginTop: 40 },
  skeletonCard: { backgroundColor: '#0a0a0a', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#161616', marginBottom: 10 },
  skeletonLineWide: { height: 16, borderRadius: 8, backgroundColor: '#161616', width: '33%', marginBottom: 8 },
  skeletonLineNarrow: { height: 12, borderRadius: 6, backgroundColor: '#161616', width: '66%' },
  worldChatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.6)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  worldChatIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(79,70,229,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPressed: { opacity: 0.85 },
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0a0a0a', // star-900
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  inboxRowRead: { borderColor: '#262626' },
  inboxRowUnread: { borderColor: 'rgba(129,140,248,0.7)' },
  inboxRowGold: { borderColor: 'rgba(250,204,21,0.7)' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  roomAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  teamBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: '#facc15',
    borderRadius: 999,
    padding: 4,
  },
  rowTextWrap: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontWeight: '700', color: '#ffffff', flexShrink: 1 },
  rowSubtitle: { fontSize: 13, color: '#9a9a9a' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  lastMessage: { fontSize: 14, color: '#9a9a9a' },
  lastMessageUnread: { color: '#f5f5f5', fontWeight: '600' },
  typingText: { fontSize: 14, color: '#4ade80', fontStyle: 'italic' },
  youPrefix: { color: '#a3a3a3', fontWeight: '600' },
  rowTrailing: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  timeText: { fontSize: 11, color: '#6e6e6e' },
  trailingIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#818cf8' },
  rowUnreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowUnreadBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  liveText: { fontSize: 10, fontWeight: '700', color: '#4ade80' },
  requestCard: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#262626', borderRadius: 16, padding: 14, marginBottom: 10 },
  requestTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  declineBtn: { flex: 1, backgroundColor: '#161616', borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  declineBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  acceptBtn: { flex: 1, backgroundColor: '#4f46e5', borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  acceptBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});

export default memo(InboxModal);