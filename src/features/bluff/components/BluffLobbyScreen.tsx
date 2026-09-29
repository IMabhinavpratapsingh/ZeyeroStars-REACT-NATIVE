import React, { memo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { BOTTOM_NAV_PX } from '../../../shared/constants/layout';

// BluffLobbyScreen - "Host"/"Join by code" ke baad ka waiting room.
// Sirf HOST "Start" dabaa sakta hai (min_players poore hone par). Minimize
// screen band karta hai lekin lobby membership zinda rehti hai (server ko
// koi message nahi jaata) - BluffLobbyMinimizedBar se wapas khulta hai.
// Hardware back bhi minimize hi karta hai - leave ke liye explicit button.

interface LobbyMember {
  user_id: string | number;
  username: string;
}

interface Lobby {
  code: string;
  host_id: string | number;
  is_public: boolean;
  min_players?: number;
  max_players?: number;
  members?: LobbyMember[];
}

interface BluffLobbyScreenProps {
  show: boolean;
  lobby: Lobby | null;
  myId: string | number | null;
  onMinimize: () => void;
  onLeave: () => void;
  onStart: () => void;
}

const BluffLobbyScreen = ({ show, lobby, myId, onMinimize, onLeave, onStart }: BluffLobbyScreenProps) => {
  const [copied, setCopied] = useState(false);
  const __z = useTopZIndex(show);

  useBackButtonHandler(show, onMinimize);

  if (!show) return null;

  if (!lobby) {
    return (
      <View style={[styles.container, { zIndex: __z }, styles.centered]}>
        <ActivityIndicator size="large" color="#f6bc7a" />
        <Text style={styles.loadingText}>Setting up the table…</Text>
      </View>
    );
  }

  const isHost = lobby.host_id === myId;
  const members = lobby.members || [];
  const minPlayers = lobby.min_players || 2;
  const maxPlayers = lobby.max_players || 4;
  const canStart = isHost && members.length >= minPlayers;
  const seats = Array.from({ length: maxPlayers }, (_, i) => members[i] || null);

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(lobby.code);
    } catch {
      // ignore - code is on-screen anyway
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={[styles.container, { zIndex: __z }]}>
      <View style={styles.topBar}>
        <Pressable onPress={onMinimize} style={styles.pillButton}>
          <Ionicons name="chevron-down" size={14} color="#c2c2c2" />
          <Text style={styles.pillButtonText}>Minimize</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>Bluff Court Lobby</Text>
        <Pressable onPress={onLeave} style={[styles.pillButton, styles.leaveButton]}>
          <Ionicons name="log-out-outline" size={14} color="#f87171" />
          <Text style={[styles.pillButtonText, styles.leaveButtonText]}>Leave</Text>
        </Pressable>
      </View>

      <Text style={styles.subNote}>
        Minimize to visit DMs or Rooms and send this code to a friend - the table stays open.
      </Text>

      <View style={styles.body}>
        <View style={styles.codeCard}>
          <View style={styles.codeCardTag}>
            <Ionicons name={lobby.is_public ? 'globe-outline' : 'lock-closed-outline'} size={12} color="#9a9a9a" />
            <Text style={styles.codeCardTagText}>{lobby.is_public ? 'Public table' : 'Private table'}</Text>
          </View>
          <Text style={styles.codeText}>{lobby.code}</Text>
          <Pressable onPress={copyCode} style={styles.copyButton}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? '#4ade80' : '#fff'} />
            <Text style={styles.copyButtonText}>{copied ? 'Copied!' : 'Copy code'}</Text>
          </Pressable>
        </View>

        <View style={styles.seatsWrap}>
          <Text style={styles.seatsLabel}>
            Players ({members.length}/{maxPlayers}, need {minPlayers}+ to start)
          </Text>
          <View style={styles.seatsGrid}>
            {seats.map((member, i) => (
              <View key={i} style={[styles.seatBox, member ? styles.seatBoxFilled : styles.seatBoxEmpty]}>
                <View style={styles.seatAvatar}>
                  <Ionicons name="person" size={14} color={member ? '#e0e0e0' : '#3f3f3f'} />
                </View>
                <View style={styles.seatNameRow}>
                  {member ? (
                    <>
                      <Text style={styles.seatName} numberOfLines={1}>{member.username}</Text>
                      {member.user_id === lobby.host_id && <Ionicons name="star" size={12} color="#facc15" />}
                    </>
                  ) : (
                    <Text style={styles.seatWaiting}>Waiting...</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.bottomBar}>
        {isHost ? (
          <Pressable onPress={onStart} disabled={!canStart} style={[styles.startButton, !canStart && styles.startButtonDisabled]}>
            <Text style={styles.startButtonText}>
              {canStart ? 'Start Game' : `Need ${minPlayers - members.length} more player${minPlayers - members.length === 1 ? '' : 's'}`}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.waitingHostText}>Waiting for the host to start the game…</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: BOTTOM_NAV_PX, backgroundColor: '#0a0a0a' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#9a9a9a' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(38,38,38,0.8)', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pillButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#161616',
  },
  pillButtonText: { fontSize: 11, fontWeight: '700', color: '#c2c2c2' },
  leaveButton: { backgroundColor: 'rgba(220,38,38,0.2)' },
  leaveButtonText: { color: '#f87171' },
  topBarTitle: { fontSize: 11, fontWeight: '700', color: '#9a9a9a', textTransform: 'uppercase', letterSpacing: 1 },
  subNote: { textAlign: 'center', fontSize: 11, color: '#6e6e6e', paddingHorizontal: 16, paddingTop: 8 },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20, gap: 24 },
  codeCard: {
    width: '100%', maxWidth: 320, alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(22,22,22,0.6)', borderWidth: 1, borderColor: '#262626', borderRadius: 16, padding: 20,
  },
  codeCardTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  codeCardTagText: { fontSize: 11, fontWeight: '700', color: '#9a9a9a', textTransform: 'uppercase', letterSpacing: 1 },
  codeText: { fontSize: 36, fontWeight: '900', letterSpacing: 8, color: '#fff' },
  copyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#262626',
  },
  copyButtonText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  seatsWrap: { width: '100%', maxWidth: 320 },
  seatsLabel: { fontSize: 11, fontWeight: '700', color: '#9a9a9a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  seatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seatBox: {
    width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12,
  },
  seatBoxFilled: { backgroundColor: '#161616', borderColor: '#262626' },
  seatBoxEmpty: { backgroundColor: 'rgba(22,22,22,0.4)', borderColor: '#1c1c1c', borderStyle: 'dashed' },
  seatAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(63,63,63,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  seatNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  seatName: { fontSize: 12, fontWeight: '700', color: '#fff', flexShrink: 1 },
  seatWaiting: { fontSize: 12, fontWeight: '700', color: '#3f3f3f' },
  bottomBar: {
    paddingHorizontal: 16, paddingBottom: 20, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(38,38,38,0.8)', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  startButton: { backgroundColor: '#e0883a', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  startButtonDisabled: { opacity: 0.4 },
  startButtonText: { color: '#fff', fontWeight: '700' },
  waitingHostText: { textAlign: 'center', fontSize: 12, color: '#9a9a9a', paddingVertical: 8 },
});

export default memo(BluffLobbyScreen);
