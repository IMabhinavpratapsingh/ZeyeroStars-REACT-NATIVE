import React, { memo, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { FadeIn } from '../../../shared/components/motion/ScreenTransition';
import { getActiveRooms } from '../services/roomsApi';

interface Room {
  id: number | string;
  room_name: string;
  room_icon_url?: string | null;
  is_team?: boolean;
  user_count?: number;
  owner_username?: string;
}

// Ek user-room card - "Public Chatrooms" grid jaisa: bada cover (room
// icon), "Live" badge jab koi member connected ho, naam gradient ke
// upar, footer mein members/30 + owner.
const UserRoomCard = ({ room, onPress }: { room: Room; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={[styles.card, { borderColor: room.is_team ? '#e8c34a' : '#2c2545' }]}
  >
    <View style={styles.cover}>
      {room.room_icon_url ? (
        <Image source={{ uri: room.room_icon_url }} style={styles.coverImg} />
      ) : (
        <Text style={styles.coverLetter}>{(room.room_name || '?').charAt(0).toUpperCase()}</Text>
      )}

      {room.is_team && (
        <View style={styles.teamBadge}>
          <Ionicons name="sparkles" size={10} color="#221b2e" />
          <Text style={styles.teamBadgeText}>ZeyeroStars</Text>
        </View>
      )}

      {(room.user_count || 0) > 0 && (
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{room.user_count} online</Text>
        </View>
      )}

      <View style={styles.nameOverlay}>
        <Text style={styles.roomName} numberOfLines={1}>{room.room_name}</Text>
      </View>
    </View>

    <View style={styles.footer}>
      <View style={styles.footerCell}>
        <View style={styles.footerRow}>
          <Ionicons name="people" size={11} color="#ffffff" />
          <Text style={styles.footerValue}>{room.user_count || 0}/30</Text>
        </View>
        <Text style={styles.footerLabel}>Members</Text>
      </View>
      <View style={[styles.footerCell, styles.footerCellBorder]}>
        <Text style={styles.footerHost} numberOfLines={1}>
          {room.is_team ? 'ZeyeroStars' : room.owner_username || 'Unknown'}
        </Text>
        <Text style={styles.footerLabel}>Host</Text>
      </View>
    </View>
  </Pressable>
);

const GridSkeleton = () => (
  <View style={styles.grid}>
    {[1, 2, 3, 4].map((i) => (
      <View key={i} style={styles.skeletonCard} />
    ))}
  </View>
);

interface RoomsModalProps {
  show: boolean;
  onClose: () => void;
  onSelectRoom: (room: Room) => void;
}

// `onSelectRoom(room)` - personal room join/switch flow (Dashboard ka
// `openRoom`), jaisa pehle tha.
const RoomsModal = ({ show, onClose, onSelectRoom }: RoomsModalProps) => {
  const __z = useTopZIndex(show);
  const insets = useSafeAreaInsets();

  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Pehli baar load ho chuka hai kya - dobara modal khulne par purani
  // list turant dikhao, silently refresh karo.
  const [loaded, setLoaded] = useState(false);

  useBackButtonHandler(show, onClose);

  const loadUserRooms = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      // /rooms/active server-side hi active + is_team merge karke,
      // is_team-first + online-count order mein deta hai.
      const res = await getActiveRooms();
      setUserRooms(res.data.rooms || []);
      setLoaded(true);
    } catch (err) {
      console.error('User rooms load error:', err);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!show) return;
    loadUserRooms({ silent: loaded });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUserRooms({ silent: true });
  };

  if (!show) return null;

  return (
    <FadeIn show={show} style={[styles.backdrop, { zIndex: __z }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Rooms</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.body}>
          <GridSkeleton />
        </View>
      ) : userRooms.length === 0 ? (
        <View style={styles.body}>
          <Text style={styles.emptyText}>No rooms have been created.</Text>
        </View>
      ) : (
        <FlatList
          data={userRooms}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <UserRoomCard room={item} onPress={() => onSelectRoom(item)} />
          )}
        />
      )}
    </FadeIn>
  );
};

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#14101f' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2545',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  closeBtn: { backgroundColor: '#c0334a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  closeBtnText: { color: '#ffffff', fontWeight: '700' },
  body: { padding: 16, flexGrow: 1 },
  emptyText: { color: '#8b7fae', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  row: { gap: 12, marginBottom: 12 },
  skeletonCard: { width: '47%', aspectRatio: 3 / 4, backgroundColor: '#1c1730', borderRadius: 12, borderWidth: 2, borderColor: '#2c2545' },
  card: { flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2 },
  cover: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#1c1730', alignItems: 'center', justifyContent: 'center' },
  coverImg: { width: '100%', height: '100%' },
  coverLetter: { fontSize: 30, fontWeight: '700', color: '#4a4166' },
  teamBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#e8c34a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  teamBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: '#221b2e' },
  onlineBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  onlineText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
  nameOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.6)' },
  roomName: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  footer: { flexDirection: 'row', backgroundColor: '#1c1730' },
  footerCell: { flex: 1, paddingVertical: 6, alignItems: 'center' },
  footerCellBorder: { borderLeftWidth: 1, borderLeftColor: '#2c2545' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerValue: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  footerLabel: { fontSize: 10, color: '#6e6482' },
  footerHost: { fontSize: 12, fontWeight: '700', color: '#a599e0', paddingHorizontal: 4 },
});

export default memo(RoomsModal);