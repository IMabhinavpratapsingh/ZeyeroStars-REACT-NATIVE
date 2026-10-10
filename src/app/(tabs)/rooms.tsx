import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { getActiveRooms, createRoom } from '../../features/rooms/services/roomsApi';
import { showAlert } from '../../shared/utils/alertBus';
import { API_BASE } from '../../shared/config/config';
import { getToken } from '../../shared/services/NetworkManager';
import { getMyId } from '../../shared/utils/auth';
import useWebSocket from '../../shared/hooks/useWebSocket';
import useBackButtonHandler from '../../shared/hooks/useBackButtonHandler';
import useRoomState from '../../features/dashboard/hooks/useRoomState';
import RoomRadioPlayer from '../../features/rooms/components/RoomRadioPlayer';
import RoomChatWindow from '../../features/rooms/components/RoomChatWindow';
import LoadingOverlay from '../../shared/components/LoadingOverlay';

// WEB -> RN: Dashboard.jsx (web) ka "Rooms" slice - BROWSE + CREATE (jo
// pehle se tha) + ab actual room FLOOR bhi (RoomChatWindow -> RoomFloorView,
// chat, chess panel, radio, ban/kick, edit-room). useRoomState (already
// likha hua tha, bas kahin instantiate nahi hua tha) yahan wire kiya hai -
// same pattern jo dm.tsx mein useInboxState/useDMState ke liye use hua tha.
//
// SCOPE NOTE (dm.tsx jaisa hi): `closeOtherNavPanels` is standalone tab mein
// no-op hai (koi "dusra panel" hai hi nahi is route ke andar). `isPrivileged`
// yahan khud ek chhota self-profile fetch (is_verified || is_elite) se aata
// hai (profile.tsx tab ka wahi /profile/{id} pattern) - koi shared
// "my profile" hook abhi nahi hai. onViewProfile/onTip abhi "coming soon"
// hain (ProfileViewModal/TipModal wiring alag pass) - dm.tsx mein tip bhi
// isi tarah stub hai. onOpenSettings/onOpenCommunity optional hain, is pass
// mein pass nahi kiye.
//
// IMPORTANT GAP (ye is file ke scope se bahar hai): poori app mein kahin
// bhi `networkManager.connect()` call nahi hota (login.tsx ke baad na hi
// _layout.tsx mein) - matlab socket hi open nahi hota, isliye yeh saari
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

export default function RoomsScreen() {
  const router = useRouter();
  // expo-router Tabs is tab ko UNMOUNT nahi karta (sirf hide) - isliye
  // "abhi focused hai" janne ke liye pathname check (koi extra nav-lib
  // dependency nahi chahiye). Focused hote hi native back -> Dashboard.
  const pathname = usePathname();
  const isFocused = pathname.includes('/rooms');
  useBackButtonHandler(isFocused, useCallback(() => router.push('/(tabs)/dashboard'), [router]));

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);

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

  // --- Dashboard-level stubs this standalone tab doesn't have yet -------
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

  const handleCreateRoom = async () => {
    const trimmed = newRoomName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await createRoom(trimmed);
      setNewRoomName('');
      setShowCreate(false);
      loadRooms({ silent: true });
    } catch (err: any) {
      showAlert(err?.response?.data?.detail || 'Could not create room.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rooms</Text>
        <Pressable style={styles.createBtn} onPress={() => setShowCreate((v) => !v)}>
          <Ionicons name={showCreate ? 'close' : 'add'} size={18} color="#000000" />
        </Pressable>
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

      {showCreate && (
        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            value={newRoomName}
            onChangeText={setNewRoomName}
            placeholder="Room name"
            placeholderTextColor="#71717a"
            maxLength={30}
            onSubmitEditing={handleCreateRoom}
          />
          <Pressable
            style={[styles.createSubmit, (!newRoomName.trim() || creating) && styles.createSubmitDisabled]}
            onPress={handleCreateRoom}
            disabled={!newRoomName.trim() || creating}
          >
            <Text style={styles.createSubmitText}>{creating ? '...' : 'Create'}</Text>
          </Pressable>
        </View>
      )}

      {!loading && rooms.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>No rooms yet - create one!</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
          renderItem={({ item }) => (
            <RoomCard
              room={item}
              isActive={String(roomState.activeRoom?.id) === String(item.id)}
              onPress={() => roomState.openRoom(item as any)}
            />
          )}
        />
      )}

      {/* Room minimize hone par bhi mounted - radio sirf activeRoom null hone par rukta hai */}
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
            setShowCreate(false);
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
          onRoomSaved={() => loadRooms({ silent: true })}
        />
      )}

      <LoadingOverlay show={screenLoading.show} text={screenLoading.text} />
    </View>
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
  createBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  createInput: {
    flex: 1,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 999,
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createSubmit: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  createSubmitDisabled: { opacity: 0.4 },
  createSubmitText: { color: '#000000', fontWeight: '700', fontSize: 13 },
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