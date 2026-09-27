import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getActiveRooms } from '../../rooms/services/roomsApi';

export interface StripRoom {
  id: string | number;
  room_name?: string;
  room_icon_url?: string | null;
  user_count?: number;
  is_team?: boolean;
  [key: string]: unknown;
}

export interface MyRoom {
  room_name?: string;
  user_count?: number;
  [key: string]: unknown;
}

/**
 * Backend `players_rooms` row mein "is_team" (true/false) aata hai -
 * ZeyeroStars (official/team) ke banaye rooms. Inhe hamesha list ke
 * sabse upar rakhna hai. Stable sort - is_team wale upar, baaki apna
 * order (backend se jaisa aaya) maintain karte hain.
 */
const sortTeamRoomsFirst = (rooms: StripRoom[]) =>
  [...rooms].sort((a, b) => (b.is_team ? 1 : 0) - (a.is_team ? 1 : 0));

// MODULE-LEVEL CACHE: dashboard.tsx (jiske andar yeh strip hai) Slot-based
// tab-switch par unmount/remount hota hai - isliye pehle Rooms/DM/Profile
// se Home wapas aate hi yeh poori strip refetch ho jaati thi. Ab pehli
// baar hi network call hoga; baad ke mounts cache se turant hydrate honge.
// Sirf explicit refresh (refreshSignal badalna - jo ab Home ke
// pull-to-refresh se aata hai) fresh backend hit karta hai.
let roomsCache: { rooms: StripRoom[]; loadedOnce: boolean } = { rooms: [], loadedOnce: false };

/**
 * Feed ke bilkul upar dikhne wala horizontal strip - "Your Room" card +
 * ek "Create Room" circle (sirf tab jab user ka apna room na ho) + SIRF
 * ACTIVE rooms ke circles (jinme abhi log mojood hain, communities
 * nahi) - "is_team" rooms sabse aage.
 *
 * WEB -> RN CHANGE: web wala left-to-right custom swipe-to-refresh
 * gesture (useSwipeToRefresh, feed ke vertical pull-to-refresh se clash
 * na ho isliye) yahan skip kiya - RN mein ek chhota refresh icon button
 * degi wahi kaam saaf tareeke se, bina do gestures overlap kiye. Baaki
 * (Your Room card, Create Room, active-rooms circles, is_team ordering)
 * poora hai.
 *
 * NOTE: yeh component khud standalone hai (apni getActiveRooms fetch
 * karta hai) - `myRoom`/`onOpenRoom`/`onOpenRooms`/`onOpenRoomDirect`
 * caller (Dashboard/useRoomState wiring) se aane chahiye jab wo ready ho.
 */
interface RoomsStripProps {
  myRoom?: MyRoom | null;
  myRoomLoading?: boolean;
  onOpenRoom?: (room: MyRoom) => void;
  onOpenRooms?: () => void;
  onOpenRoomDirect?: (room: StripRoom) => void;
  refreshSignal?: unknown;
}

const RoomsStrip = ({
  myRoom,
  myRoomLoading = false,
  onOpenRoom,
  onOpenRooms,
  onOpenRoomDirect,
  refreshSignal,
}: RoomsStripProps) => {
  const [allRooms, setAllRooms] = useState<StripRoom[]>(roomsCache.rooms);
  const [refreshing, setRefreshing] = useState(false);
  // refreshSignal ki PEHLI value ko baseline maan lo - us par fetch mat
  // karo (yeh sirf mount hai), sirf JAB yeh badle (asli pull-to-refresh)
  // tabhi network hit karo.
  const prevRefreshSignal = useRef(refreshSignal);

  const loadRooms = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await getActiveRooms();
      const rooms = res.data?.rooms || [];
      setAllRooms(rooms);
      roomsCache.rooms = rooms;
      roomsCache.loadedOnce = true;
    } catch (err: any) {
      console.error('Active rooms fetch error:', err.response?.data || err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!roomsCache.loadedOnce) {
      // Pehli baar hi (poori app mein) - fresh fetch.
      loadRooms();
      return;
    }
    if (prevRefreshSignal.current !== refreshSignal) {
      // Asli pull-to-refresh (Home screen se refreshSignal badla).
      prevRefreshSignal.current = refreshSignal;
      loadRooms();
    }
    // Warna (sirf remount hua, refreshSignal wahi hai) - cache se hydrate
    // ho hi chuka hai upar useState mein, kuch nahi karna.
  }, [loadRooms, refreshSignal]);

  const visibleRooms = useMemo(() => sortTeamRoomsFirst(allRooms), [allRooms]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* Your Room - agar bana rakha hai to naam + online count */}
      {!myRoomLoading && myRoom && (
        <Pressable onPress={() => onOpenRoom?.(myRoom)} style={styles.myRoomCard}>
          <View style={styles.myRoomTopRow}>
            <View style={styles.myRoomIconWrap}>
              <Ionicons name="home" size={11} color="#818cf8" />
            </View>
            <Text style={styles.chevron}>{'\u203a'}</Text>
          </View>
          <View style={{ marginTop: 4 }}>
            <Text style={styles.myRoomLabel}>Your Room</Text>
            <Text style={styles.myRoomName} numberOfLines={1}>
              {myRoom.room_name}
            </Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>{myRoom.user_count || 0} online</Text>
            </View>
          </View>
        </Pressable>
      )}

      {/* Create Room - sirf tab jab user ka khud ka koi room nahi bana hua */}
      {!myRoomLoading && !myRoom && (
        <Pressable onPress={() => onOpenRooms?.()} style={styles.createRoomCol}>
          <View style={styles.createRoomCircle}>
            <Ionicons name="add" size={20} color="#d4d4d8" />
          </View>
          <Text style={styles.createRoomLabel}>Create Room</Text>
        </Pressable>
      )}

      {/* Active rooms circles */}
      {visibleRooms.map((room) => (
        <Pressable key={String(room.id)} onPress={() => onOpenRoomDirect?.(room)} style={styles.roomCol}>
          <View style={[styles.roomCircle, room.is_team && styles.roomCircleTeam]}>
            {room.room_icon_url ? (
              <Image source={{ uri: room.room_icon_url }} style={styles.roomIconImg} />
            ) : (
              <Ionicons name="home" size={18} color="#d4d4d8" />
            )}
          </View>
          <Text style={styles.roomName} numberOfLines={1}>
            {room.room_name}
          </Text>
          <Text style={styles.roomOnline}>{room.user_count ?? 0} online</Text>
        </Pressable>
      ))}

      {/* Refresh button - web ka swipe-refresh gesture yahan simple tap se */}
      <Pressable onPress={loadRooms} disabled={refreshing} style={styles.refreshCol}>
        <View style={styles.refreshCircle}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#a1a1aa" />
          ) : (
            <Ionicons name="refresh" size={16} color="#a1a1aa" />
          )}
        </View>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 14, gap: 12, alignItems: 'flex-start' },
  myRoomCard: {
    width: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.5)',
    backgroundColor: 'rgba(79,70,229,0.12)',
    padding: 8,
    justifyContent: 'space-between',
  },
  myRoomTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  myRoomIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(99,102,241,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: { color: '#71717a', fontSize: 13 },
  myRoomLabel: { color: '#a1a1aa', fontSize: 9 },
  myRoomName: { color: '#ffffff', fontWeight: '700', fontSize: 12, marginTop: 1 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  onlineDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#818cf8' },
  onlineText: { color: '#818cf8', fontSize: 9 },
  createRoomCol: { width: 64, alignItems: 'center', gap: 6 },
  createRoomCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRoomLabel: { color: '#a1a1aa', fontSize: 11, textAlign: 'center' },
  roomCol: { width: 64, alignItems: 'center', gap: 2 },
  roomCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCircleTeam: { borderColor: '#fbbf24' },
  roomIconImg: { width: '100%', height: '100%' },
  roomName: { color: '#d4d4d8', fontSize: 11, textAlign: 'center', width: '100%' },
  roomOnline: { color: '#71717a', fontSize: 9, textAlign: 'center' },
  refreshCol: { width: 40, alignItems: 'center', justifyContent: 'center', height: 56 },
  refreshCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default memo(RoomsStrip);