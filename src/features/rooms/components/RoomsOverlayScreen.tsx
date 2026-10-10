import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import axios from 'axios';
import { getActiveRooms } from '../services/roomsApi';
import { showAlert } from '../../../shared/utils/alertBus';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { getMyId } from '../../../shared/utils/auth';
import useWebSocket from '../../../shared/hooks/useWebSocket';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import { PersistentSlide } from '../../../shared/components/motion/ScreenTransition';
import useRoomState from '../../dashboard/hooks/useRoomState';
import RoomChatWindow from './RoomChatWindow';
import RoomRadioPlayer from './RoomRadioPlayer';
import LoadingOverlay from '../../../shared/components/LoadingOverlay';
import { subscribeOpenRoom, notifyMyRoomChanged } from '../../../shared/utils/navOverlayBus';

// WEB -> RN: yeh pehle `app/(tabs)/rooms.tsx` tha (ek Tabs.Screen route).
// Ab DM ki tarah hi Community list/detail jaisa PERSISTENT overlay hai -
// `(tabs)/_layout.tsx` se `show` boolean se slide hota hai, route/pathname
// involve nahi. Dekho DMOverlayScreen.tsx ka top comment - same reasoning
// yahan bhi: component hamesha mounted rehta hai, isliye agar user kisi
// active room ke andar hai (RoomChatWindow, WebSocket-driven floor) aur
// DM/Home par slide kar jaaye, room state/connection bilkul waisi hi
// bani rehti hai - koi remount/reconnect nahi hota.
//
// IMPORTANT GAP (same as before, ab bhi is file ke scope se bahar hai):
// poori app mein kahin bhi `networkManager.connect()` call nahi hota -
// room-floor wiring abhi runtime par "not connected" ki wajah se silently
// no-op rahegi jab tak connect() kahin (login success + app boot pe) call
// nahi hota. Yeh agla sabse zaroori chhota kaam hai.

interface Room {
  id: number | string;
  room_name: string;
  room_icon_url?: string | null;
  is_team?: boolean;
  user_count?: number;
  owner_username?: string;
}

const RoomCard = ({ room, onPress, isActive = false }: { room: Room; onPress: () => void; isActive?: boolean }) => (
  <Pressable
    onPress={onPress}
    style={[styles.card, { borderColor: isActive ? '#22c55e' : room.is_team ? '#e8c34a' : '#27272a' }]}
  >
    <View style={styles.cover}>
      {isActive && (
        <View style={styles.hereBadge}>
          <Text style={styles.hereText}>You're here</Text>
        </View>
      )}
      {room.room_icon_url ? (
        <Image source={{ uri: room.room_icon_url }} style={styles.coverImg} />
      ) : (
        <Text style={styles.coverLetter}>{(room.room_name || '?').charAt(0).toUpperCase()}</Text>
      )}
      {(room.user_count || 0) > 0 && (
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{room.user_count} online</Text>
        </View>
      )}
      <View style={styles.nameOverlay}>
        <Text style={styles.roomName} numberOfLines={1}>
          {room.room_name}
        </Text>
      </View>
    </View>
    <View style={styles.footer}>
      <Text style={styles.footerValue}>{room.user_count || 0}/30 members</Text>
      <Text style={styles.footerHost} numberOfLines={1}>
        {room.is_team ? 'ZeyeroStars' : room.owner_username || 'Unknown'}
      </Text>
    </View>
  </Pressable>
);

interface RoomsOverlayScreenProps {
  show: boolean;
  onClose: () => void;
}

const SPACER_ID = '__spacer__';

export default function RoomsOverlayScreen({ show, onClose }: RoomsOverlayScreenProps) {
  useBackButtonHandler(show, onClose);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- isPrivileged: chhota self-profile fetch, ek baar mount par -------
  const privilegedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getToken();
        const myId = getMyId();
        if (!myId) return;
        const res = await axios.get(`${API_BASE}/profile/${myId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          privilegedRef.current = !!(res.data?.is_verified || res.data?.is_elite);
        }
      } catch (err: any) {
        console.error('Self profile (isPrivileged) fetch error:', err?.response?.data || err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const isPrivileged = useCallback(() => privilegedRef.current, []);

  // --- Dashboard-level stubs this overlay doesn't have yet ---------------
  const closeOtherNavPanels = useCallback((_exceptKey: string) => {}, []);
  const [screenLoading, setScreenLoading] = useState<{ show: boolean; text?: string }>({ show: false });
  const beginScreenLoading = useCallback((text?: string) => setScreenLoading({ show: true, text }), []);
  const endScreenLoading = useCallback(() => setScreenLoading({ show: false }), []);

  const roomState = useRoomState({
    isPrivileged,
    closeOtherNavPanels,
    beginScreenLoading,
    endScreenLoading,
  });

  useWebSocket(roomState.wsHandlers);

  // App khulte hi apne room mein auto-join (agar room bana rakha hai).
  const { autoJoinMyRoom } = roomState;
  useEffect(() => {
    autoJoinMyRoom();
  }, [autoJoinMyRoom]);

  // Feed ke RoomsStrip se (Your Room / active room) seedha room join.
  const { openRoom: openRoomFromBus } = roomState;
  useEffect(() => subscribeOpenRoom((room) => openRoomFromBus(room)), [openRoomFromBus]);

  const loadRooms = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await getActiveRooms();
      setRooms(res.data.rooms || []);
    } catch (err: any) {
      console.error('Rooms load error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRooms({ silent: true });
  };

  // Odd count par aakhri card akela row mein poori width le leta tha
  // (card pe `flex: 1`). Invisible spacer se har card same size rehta hai.
  const listData: Room[] =
    rooms.length % 2 === 1 ? [...rooms, { id: SPACER_ID, room_name: '' }] : rooms;

  return (
    <PersistentSlide show={show} style={styles.screen}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rooms</Text>
        </View>

        {/* Room minimize (back) hone ke baad bhi user ko dikhe ki wo kis room mein hai + wapas/exit ka button */}
        {!!roomState.activeRoom && !roomState.roomScreenVisible && (
          <Pressable style={styles.activeBanner} onPress={() => roomState.setRoomScreenVisible(true)}>
            <View style={styles.activeDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeLabel}>You're in a room</Text>
              <Text style={styles.activeName} numberOfLines={1}>
                {roomState.activeRoom.room_name ||
                  rooms.find((r) => String(r.id) === String(roomState.activeRoom?.id))?.room_name ||
                  'Room'}
              </Text>
            </View>
            <View style={styles.returnBtn}>
              <Text style={styles.returnText}>Return</Text>
            </View>
            <Pressable
              style={styles.leaveBtn}
              onPress={() => {
                roomState.exitRoom();
                loadRooms({ silent: true });
              }}
              hitSlop={8}
            >
              <Text style={styles.leaveText}>Exit</Text>
            </Pressable>
          </Pressable>
        )}

        {!loading && rooms.length === 0 ? (
          <View style={styles.centerFill}>
            <Text style={styles.emptyText}>No rooms yet.</Text>
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
            renderItem={({ item }) =>
              String(item.id) === SPACER_ID ? (
                <View style={styles.spacer} />
              ) : (
              <RoomCard
                room={item}
                isActive={String(roomState.activeRoom?.id) === String(item.id)}
                onPress={() => roomState.openRoom(item as any)}
              />
              )
            }
          />
        )}

        <RoomRadioPlayer radioUrl={roomState.activeRoom?.radio_url ?? null} />

        {roomState.activeRoom && (
          <RoomChatWindow
            activeRoom={roomState.activeRoom}
            show={roomState.roomScreenVisible}
            roomMessages={roomState.roomMessages}
            onClose={roomState.minimizeRoom}
            onExit={roomState.exitRoom}
            onSwitchRoom={() => {
              roomState.minimizeRoom();
              loadRooms({ silent: true });
            }}
            getMyId={getMyId}
            onViewProfile={() => showAlert('Viewing profiles from a room is coming soon.', 'info')}
            onTip={() => showAlert('Tipping in a room is coming soon.', 'info')}
            members={roomState.roomMembers}
            onKick={roomState.handleKickUser}
            onSetRadio={roomState.handleSetRoomRadio}
            typingUsers={roomState.roomTypingUsers}
            onBan={roomState.handleBanUser}
            onOpenBannedList={roomState.openBannedList}
            showBannedList={roomState.showBannedList}
            onCloseBannedList={() => roomState.setShowBannedList(false)}
            bannedUsers={roomState.bannedUsers}
            bannedListLoading={roomState.bannedListLoading}
            onUnban={roomState.handleUnbanUser}
            roomPositions={roomState.roomPositions}
            isPrivileged={isPrivileged}
            onRoomSaved={() => {
              loadRooms({ silent: true });
              notifyMyRoomChanged();
            }}
          />
        )}

        <LoadingOverlay show={screenLoading.show} text={screenLoading.text} />
      </View>
    </PersistentSlide>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000', paddingTop: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#052e16', borderWidth: 1, borderColor: '#22c55e', borderRadius: 12,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  activeLabel: { fontSize: 10, color: '#86efac', fontWeight: '600' },
  activeName: { fontSize: 14, color: '#ffffff', fontWeight: '700' },
  returnBtn: { backgroundColor: '#22c55e', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  returnText: { color: '#000000', fontWeight: '700', fontSize: 12 },
  leaveBtn: { borderWidth: 1, borderColor: '#f87171', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  leaveText: { color: '#f87171', fontWeight: '700', fontSize: 12 },
  hereBadge: {
    position: 'absolute', top: 8, left: 8, zIndex: 2,
    backgroundColor: '#22c55e', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  hereText: { fontSize: 10, fontWeight: '700', color: '#000000' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#71717a', fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { gap: 12, marginBottom: 12 },
  spacer: { flex: 1 },
  card: { flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2 },
  cover: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#18181b', alignItems: 'center', justifyContent: 'center' },
  coverImg: { width: '100%', height: '100%' },
  coverLetter: { fontSize: 30, fontWeight: '700', color: '#3f3f46' },
  onlineBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  onlineText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
  nameOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.6)' },
  roomName: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  footer: { backgroundColor: '#18181b', paddingVertical: 8, paddingHorizontal: 8 },
  footerValue: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  footerHost: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
});