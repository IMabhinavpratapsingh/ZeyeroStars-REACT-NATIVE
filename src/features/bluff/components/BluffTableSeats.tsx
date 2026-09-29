import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarLayers, { type EquippedByCategory } from '../../avatar/components/AvatarLayers';
import { sigilById, DOOM_LABEL, type SigilId } from '../theme/bluffTheme';

// BluffTableSeats - "Player card" layout: teen rangeen "Player" boxes
// upar-upar (opponents), neeche ek "Table" strip (current Call + pile),
// khud ka hand alag se BluffHandTray mein fan hoke aata hai.

const SEAT_COLORS = [
  { bg: '#c8dba0', border: '#8fae5c' },
  { bg: '#e3bd9a', border: '#c98f5f' },
  { bg: '#dc9a68', border: '#b96b34' },
];

interface SeatPlayer {
  seat: number;
  name?: string;
  equippedByCategory?: EquippedByCategory;
  photoUrl?: string | null;
  cardsRemaining: number;
  risk: number;
  riskMax?: number;
  lastPlayedCount?: number;
  isEliminated?: boolean;
}

const RiskPips = ({ risk = 0, max = 6 }: { risk?: number; max?: number }) => (
  <View style={styles.pipsRow}>
    {Array.from({ length: max }).map((_, i) => (
      <View key={i} style={[styles.pip, i < risk ? styles.pipFilled : styles.pipEmpty]} />
    ))}
  </View>
);

const PlayerBox = ({ player, color, isCurrentTurn }: { player: SeatPlayer | null; color: { bg: string; border: string }; isCurrentTurn: boolean }) => {
  if (!player) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>Empty</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.playerBox,
        { backgroundColor: color.bg, borderColor: isCurrentTurn ? '#facc15' : color.border },
        player.isEliminated && styles.grayscale,
      ]}
    >
      <View style={StyleSheet.absoluteFill}>
        <AvatarLayers equippedByCategory={player.equippedByCategory} photoUrl={player.photoUrl} exactFit />
      </View>

      {player.isEliminated && (
        <View style={styles.eliminatedOverlay}>
          <Ionicons name="skull-outline" size={26} color="rgba(255,255,255,0.9)" />
        </View>
      )}

      <View style={styles.cardsBadge}>
        <Text style={styles.cardsBadgeText}>{player.cardsRemaining}</Text>
      </View>

      {!!player.lastPlayedCount && !player.isEliminated && (
        <View style={styles.playedBadge}>
          <Text style={styles.playedBadgeText}>played {player.lastPlayedCount}</Text>
        </View>
      )}

      <View style={styles.nameStrip}>
        {!!player.name && (
          <Text style={styles.nameText} numberOfLines={1}>
            {player.name}
          </Text>
        )}
        <RiskPips risk={player.risk} max={player.riskMax ?? 6} />
      </View>

      {isCurrentTurn && (
        <View style={styles.turnBadge}>
          <Text style={styles.turnBadgeText}>TURN</Text>
        </View>
      )}
    </View>
  );
};

interface BluffTableSeatsProps {
  players?: SeatPlayer[];
  currentTurnSeat?: number | null;
  selfSeat?: number;
  callSigilId?: SigilId | null;
  pileCount?: number;
}

const BluffTableSeats = ({ players = [], currentTurnSeat = null, selfSeat = 0, callSigilId = null, pileCount = 0 }: BluffTableSeatsProps) => {
  const bySeat = new Map(players.map((p) => [p.seat, p]));
  const self = bySeat.get(selfSeat) || null;
  const opponents = players.filter((p) => p.seat !== selfSeat).sort((a, b) => a.seat - b.seat);
  const slots = Array.from({ length: 3 }, (_, i) => opponents[i] || null);

  const call = callSigilId ? sigilById(callSigilId) : null;

  return (
    <View style={styles.container}>
      <View style={styles.slotsRow}>
        {slots.map((p, i) => (
          <View key={p ? p.seat : `empty-${i}`} style={styles.slot}>
            <PlayerBox player={p} color={SEAT_COLORS[i % SEAT_COLORS.length]} isCurrentTurn={p ? currentTurnSeat === p.seat : false} />
          </View>
        ))}
      </View>

      <View style={styles.tableStrip}>
        <View>
          <Text style={styles.tableLabel}>Table · Call</Text>
          {call ? (
            <View style={styles.callRow}>
              <Ionicons name={call.icon as any} size={22} color={call.color} />
              <Text style={[styles.callName, { color: '#2b0a0f' }]}>{call.name}</Text>
            </View>
          ) : (
            <Text style={styles.callDash}>—</Text>
          )}
        </View>
        <View style={styles.pileChip}>
          <Text style={styles.pileChipText}>{pileCount} in pile</Text>
        </View>
      </View>

      {self && (
        <View style={styles.selfRow}>
          <Text style={styles.selfText}>
            You {currentTurnSeat === selfSeat && <Text style={styles.selfTurnText}>· your turn</Text>}
          </Text>
          <RiskPips risk={self.risk} max={self.riskMax ?? 6} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 380, alignSelf: 'center' },
  slotsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  slot: { flex: 1 },
  emptyBox: {
    height: 112,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  playerBox: { height: 112, borderRadius: 12, borderWidth: 2, overflow: 'hidden' },
  grayscale: { opacity: 0.5 },
  eliminatedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(5,5,5,0.9)',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  playedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  playedBadgeText: { fontSize: 9, fontWeight: '600', color: '#fff' },
  nameStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
    paddingBottom: 6,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  nameText: { maxWidth: '90%', fontSize: 10, fontWeight: '700', color: '#fff' },
  pipsRow: { flexDirection: 'row', gap: 3 },
  pip: { width: 6, height: 6, borderRadius: 3 },
  pipFilled: { backgroundColor: '#c0392b' },
  pipEmpty: { backgroundColor: 'rgba(255,255,255,0.14)' },
  turnBadge: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
    backgroundColor: '#facc15',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  turnBadgeText: { fontSize: 9, fontWeight: '700', color: '#5b4600' },
  tableStrip: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 28,
    minHeight: 110,
    backgroundColor: '#c76b7a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tableLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: '#3d0f16', textTransform: 'uppercase' },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  callName: { fontSize: 20, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  callDash: { fontSize: 18, fontWeight: '700', color: '#2b0a0f', marginTop: 4 },
  pileChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.25)' },
  pileChipText: { fontSize: 12, fontWeight: '600', color: '#fceef0' },
  selfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  selfText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  selfTurnText: { color: '#facc15' },
});

export default memo(BluffTableSeats);
