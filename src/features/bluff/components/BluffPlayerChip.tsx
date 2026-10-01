import React, { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Player card (table ke upar wali row) - sirf PFP dikhata hai (full avatar
// canvas nahi). Turn wale player par gold glow + countdown timer bar.
export const SEAT_ACCENTS = ['#facc15', '#60a5fa', '#34d399', '#a78bfa'];

export interface SeatPlayer {
  seat: number; // display seat (0 = self)
  name?: string;
  photoUrl?: string | null;
  cardsRemaining: number;
  risk: number;
  riskMax?: number;
  lastPlayedCount?: number;
  isEliminated?: boolean;
}

export const BluffPfp = memo(({ uri, size, name }: { uri?: string | null; size: number; name?: string }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const show = !!uri && !failed;
  return (
    <View style={[styles.pfpBase, { width: size, height: size, borderRadius: size / 2 }]}>
      {show ? (
        <Image source={{ uri: uri! }} style={{ width: size, height: size }} onError={() => setFailed(true)} />
      ) : name ? (
        <Text style={[styles.pfpLetter, { fontSize: size * 0.42 }]}>{name.charAt(0).toUpperCase()}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.5} color="#a78bfa" />
      )}
    </View>
  );
});
BluffPfp.displayName = 'BluffPfp';

const TurnTimerBar = ({ endsAt, totalMs, color }: { endsAt: number; totalMs: number; color: string }) => {
  const p = useSharedValue(1);
  useEffect(() => {
    const remaining = Math.max(0, endsAt - Date.now());
    p.value = Math.min(1, remaining / totalMs);
    p.value = withTiming(0, { duration: remaining, easing: Easing.linear });
  }, [endsAt, totalMs, p]);
  const style = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={styles.timerTrack}>
      <Animated.View style={[styles.timerFill, { backgroundColor: color }, style]} />
    </View>
  );
};

interface Props {
  player: SeatPlayer | null;
  displaySeat: number;
  isSelf: boolean;
  isTurn: boolean;
  secondsLeft: number | null;
  endsAt: number | null;
  totalMs: number;
  chipRef?: (node: View | null) => void;
}

const BluffPlayerChip = ({ player, displaySeat, isSelf, isTurn, secondsLeft, endsAt, totalMs, chipRef }: Props) => {
  const accent = SEAT_ACCENTS[displaySeat % SEAT_ACCENTS.length];

  if (!player) {
    return (
      <View ref={chipRef} collapsable={false} style={[styles.box, styles.emptyBox]}>
        <Ionicons name="person-outline" size={22} color="rgba(255,255,255,0.18)" />
        <Text style={styles.emptyText}>Empty</Text>
      </View>
    );
  }

  const urgent = isTurn && secondsLeft != null && secondsLeft <= 5;
  const timerColor = urgent ? '#ef4444' : isSelf ? '#facc15' : accent;
  const max = player.riskMax ?? 6;

  let status = `${player.cardsRemaining} cards`;
  if (player.isEliminated) status = 'Out';
  else if (isTurn) status = isSelf ? `${secondsLeft ?? ''}s` : `Thinking… ${secondsLeft ?? ''}s`;

  return (
    <View
      ref={chipRef}
      collapsable={false}
      style={[
        styles.box,
        isTurn
          ? { borderColor: '#facc15', borderStyle: 'solid', backgroundColor: 'rgba(250,204,21,0.08)', ...styles.turnGlow }
          : { borderColor: `${accent}99`, borderStyle: 'dashed' },
        player.isEliminated && { opacity: 0.45 },
      ]}
    >
      {isTurn && (
        <View style={styles.turnPill}>
          {isSelf && <MaterialCommunityIcons name="crown" size={10} color="#5b4600" />}
          <Text style={styles.turnPillText}>{isSelf ? 'Your Turn' : 'Turn'}</Text>
        </View>
      )}

      <View style={[styles.numBadge, { borderColor: `${accent}aa` }]}>
        <Text style={styles.numText}>{displaySeat + 1}</Text>
      </View>

      <View style={[styles.pfpRing, { borderColor: accent }]}>
        <BluffPfp uri={player.photoUrl} size={54} name={player.name} />
      </View>

      <Text style={styles.name} numberOfLines={1}>{player.name || 'Player'}</Text>

      <View style={styles.pips}>
        {Array.from({ length: max }).map((_, i) => (
          <View key={i} style={[styles.pip, i < player.risk ? { backgroundColor: '#ef4444' } : { backgroundColor: 'rgba(255,255,255,0.16)' }]} />
        ))}
      </View>

      <Text style={[styles.status, urgent && { color: '#ef4444' }]} numberOfLines={1}>{status}</Text>

      {isTurn && endsAt != null && <TurnTimerBar endsAt={endsAt} totalMs={totalMs} color={timerColor} />}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    flex: 1,
    minHeight: 132,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(14,8,28,0.6)',
    overflow: 'visible',
  },
  emptyBox: { justifyContent: 'center', gap: 4, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.14)' },
  emptyText: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  turnGlow: { shadowColor: '#facc15', shadowOpacity: 0.7, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  turnPill: {
    position: 'absolute',
    top: -10,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#facc15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    zIndex: 2,
  },
  turnPillText: { fontSize: 10, fontWeight: '800', color: '#5b4600' },
  numBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(8,4,16,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  pfpRing: { padding: 2, borderRadius: 40, borderWidth: 2, marginTop: 4 },
  pfpBase: { overflow: 'hidden', backgroundColor: '#1a1030', alignItems: 'center', justifyContent: 'center' },
  pfpLetter: { color: '#c4b5fd', fontWeight: '800' },
  name: { marginTop: 6, maxWidth: '92%', fontSize: 12, fontWeight: '800', color: '#fff' },
  pips: { flexDirection: 'row', gap: 3, marginTop: 5 },
  pip: { width: 5, height: 5, borderRadius: 3 },
  status: { marginTop: 4, fontSize: 10, fontWeight: '600', color: '#a78bfa' },
  timerTrack: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 4,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  timerFill: { height: 3, borderRadius: 2 },
});

export default memo(BluffPlayerChip);