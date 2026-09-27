import { useCallback, useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { getActiveRooms, createRoom } from '../../features/rooms/services/roomsApi';
import { showAlert } from '../../shared/utils/alertBus';

// WEB -> RN SCOPE NOTE: Dashboard.jsx (web) ka "Rooms" slice yahan aa gaya,
// lekin sirf BROWSE + CREATE hissa - actual room floor (avatar grid, chat,
// chess panel, radio, item shop) RoomFloorView.tsx abhi khud stub hai
// (useRoomState.ts already 500+ lines ban chuka hai, isko poori tarah
// wire karne ke liye Dashboard-level shared state - isPrivileged,
// closeOtherNavPanels, screenLoading overlay - bhi chahiye, jo agle
// pass mein banega). Abhi room card tap karne par floor open nahi hota,
// sirf "coming soon" dikhata hai.

interface Room {
  id: number | string;
  room_name: string;
  room_icon_url?: string | null;
  is_team?: boolean;
  user_count?: number;
  owner_username?: string;
}

const RoomCard = ({ room, onPress }: { room: Room; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={[styles.card, { borderColor: room.is_team ? '#e8c34a' : '#27272a' }]}
  >
    <View style={styles.cover}>
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);

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
            <RoomCard room={item} onPress={() => showAlert('Room floor coming soon.', 'info')} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000', paddingTop: 60 },
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