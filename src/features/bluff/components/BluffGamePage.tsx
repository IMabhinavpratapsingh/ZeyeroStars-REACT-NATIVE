import React, { memo, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BluffTableSeats from './BluffTableSeats';
import BluffHandTray from './BluffHandTray';
import BluffActionBar from './BluffActionBar';
import BluffRevealPanel, { type BluffRevealResult } from './BluffRevealPanel';
import { DEFAULT_SETTINGS } from '../theme/bluffTheme';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';

// BluffGamePage - "Bluff Court" (ONLINE, server-authoritative). Poora
// game-state `match` prop se aata hai (Dashboard/useGameOverlays ke
// bluff_match_found / bluff_play_update / bluff_reveal / bluff_new_round /
// bluff_player_left / bluff_game_over payloads se banta hai). Yeh
// component khud koi game-decision nahi leta - sirf render karta hai.
//
// SEAT REMAPPING: server seats 0-3 absolute hote hain, BluffTableSeats
// hamesha display seat 0 ko "bottom / self" maanta hai.

const remap = (serverSeat: number, mySeat: number) => (serverSeat - mySeat + 4) % 4;

interface BluffGamePageProps {
  show: boolean;
  match: any;
  selfProfile: any;
  opponentAvatars?: Record<string, any>;
  onClose: () => void;
  onPlayCards: (idxs: number[]) => void;
  onAccuse: () => void;
}

const BluffGamePage = ({ show, match, selfProfile, opponentAvatars = {}, onClose, onPlayCards, onAccuse }: BluffGamePageProps) => {
  useBackButtonHandler(show, onClose);

  const view = useMemo(() => {
    if (!match) return null;
    const mySeat = match.yourSeat;
    const settings = { ...DEFAULT_SETTINGS, ...(match.settings || {}) };

    const players = (match.players || []).map((p: any) => {
      const isSelf = p.seat === mySeat;
      const opponentId = p.user_id ?? p.id ?? p.userId;
      const cachedOpponent = opponentId ? opponentAvatars[opponentId] : null;
      return {
        seat: remap(p.seat, mySeat),
        name: isSelf ? (selfProfile?.username || p.username || 'You') : (p.username || 'Player'),
        equippedByCategory: isSelf
          ? (selfProfile?.equippedByCategory || {})
          : (p.equippedByCategory || cachedOpponent?.equippedByCategory || {}),
        photoUrl: isSelf ? selfProfile?.photoUrl : (p.photoUrl || cachedOpponent?.photoUrl),
        hand: isSelf ? (match.yourHand || []) : new Array(p.cardsRemaining || 0).fill(null),
        doom: p.risk || 0,
        riskMax: p.riskMax ?? settings.doomMax,
        lastPlayedCount: p.lastPlayedCount || 0,
        isEliminated: !!p.isEliminated,
      };
    });

    const bySeat = new Map<number, any>(players.map((p: any) => [p.seat, p] as [number, any]));
    const currentTurnSeat = match.phase === 'turn' ? remap(match.currentTurnSeat, mySeat) : null;
    const lastPlay = match.lastActorSeat != null && match.pileCount > 0
      ? { seat: remap(match.lastActorSeat, mySeat) }
      : null;

    const reveal: BluffRevealResult | null = match.reveal
      ? {
          cards: match.reveal.cards,
          callSigilId: match.reveal.call_sigil,
          wasTruthful: match.reveal.was_truthful,
          loserName: bySeat.get(remap(match.reveal.loser_seat, mySeat))?.name || '',
          accuserName: bySeat.get(remap(match.reveal.accuser_seat, mySeat))?.name || '',
          prevPlayerName: bySeat.get(remap(match.reveal.prev_seat, mySeat))?.name || '',
          loserAvatar: {
            equippedByCategory: bySeat.get(remap(match.reveal.loser_seat, mySeat))?.equippedByCategory,
            photoUrl: bySeat.get(remap(match.reveal.loser_seat, mySeat))?.photoUrl,
          },
          accuserAvatar: {
            equippedByCategory: bySeat.get(remap(match.reveal.accuser_seat, mySeat))?.equippedByCategory,
            photoUrl: bySeat.get(remap(match.reveal.accuser_seat, mySeat))?.photoUrl,
          },
          eliminated: bySeat.get(remap(match.reveal.loser_seat, mySeat))?.isEliminated ?? !!match.reveal.eliminated_now,
          chambersAfter: match.reveal.chambers_after,
          chambersMax: settings.doomMax,
        }
      : null;

    return { mySeat, settings, players, currentTurnSeat, lastPlay, reveal, bySeat };
  }, [match, selfProfile, opponentAvatars]);

  if (!show) return null;

  if (!match || !view) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color="#f6bc7a" />
        <Text style={styles.loadingText}>Setting up the table…</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const { mySeat, settings, players, currentTurnSeat, lastPlay, reveal, bySeat } = view as any;
  const self = players.find((p: any) => p.seat === 0);
  const phase = match.phase;
  const isMyTurn = phase === 'turn' && currentTurnSeat === 0 && !self.isEliminated;
  const canAccuse = isMyTurn && !!lastPlay;
  const gameOver = match.gameOver;

  const tableSeatPlayers = players.map((p: any) => ({
    seat: p.seat,
    name: p.name,
    equippedByCategory: p.equippedByCategory,
    photoUrl: p.photoUrl,
    cardsRemaining: p.hand.length,
    risk: p.doom,
    riskMax: p.riskMax,
    lastPlayedCount: p.lastPlayedCount,
    isEliminated: p.isEliminated,
  }));

  const iWon = gameOver && gameOver.winner_seat != null && remap(gameOver.winner_seat, mySeat) === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerBtn}>
          <Ionicons name="close" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Bluff Court</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.tableWrap}>
        <BluffTableSeats
          players={tableSeatPlayers}
          currentTurnSeat={phase === 'turn' ? currentTurnSeat : null}
          selfSeat={0}
          callSigilId={match.callSigil}
          pileCount={match.pileCount}
        />
        {match.timedOut && phase === 'turn' && (
          <Text style={styles.timedOutText}>A player ran out of time.</Text>
        )}
      </View>

      <BluffActionBar
        visible={canAccuse}
        prevPlayerName={lastPlay ? bySeat.get(lastPlay.seat)?.name : ''}
        prevPlayCount={lastPlay ? (bySeat.get(lastPlay.seat)?.lastPlayedCount || 0) : 0}
        onAccuse={onAccuse}
      />

      <BluffHandTray
        hand={self.hand}
        canPlay={isMyTurn}
        maxPlayCount={settings.maxPlayCount}
        onPlay={(idxs) => onPlayCards(idxs)}
      />

      {phase === 'revealing' && <BluffRevealPanel result={reveal} />}

      {!!gameOver && (
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverCard}>
            {iWon ? (
              <View style={styles.gameOverTitleRow}>
                <Ionicons name="trophy" size={28} color="#4ade80" />
                <Text style={[styles.gameOverTitle, { color: '#4ade80' }]}>You Win!</Text>
              </View>
            ) : (
              <View style={styles.gameOverTitleRow}>
                <Ionicons name="skull" size={28} color="#f87171" />
                <Text style={[styles.gameOverTitle, { color: '#f87171' }]}>Eliminated</Text>
              </View>
            )}
            <Text style={styles.gameOverSub}>
              {gameOver.winner_username ? (
                <>Last standing: <Text style={styles.gameOverBold}>{gameOver.winner_username}</Text></>
              ) : (
                'No survivors.'
              )}
            </Text>
            <Pressable onPress={onClose} style={styles.leaveButton}>
              <Text style={styles.leaveButtonText}>Leave</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#050505' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#9a9a9a' },
  cancelText: { fontSize: 12, color: '#6e6e6e', textDecorationLine: 'underline', marginTop: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(38,38,38,0.8)', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerBtn: { padding: 6, borderRadius: 999 },
  headerTitle: { fontSize: 11, fontWeight: '700', color: '#9a9a9a', textTransform: 'uppercase', letterSpacing: 1 },
  tableWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  timedOutText: { fontSize: 11, color: '#6e6e6e', marginTop: 12, textAlign: 'center', maxWidth: 280 },
  gameOverOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 170,
  },
  gameOverCard: {
    width: '100%', maxWidth: 340, backgroundColor: '#161616', borderRadius: 20,
    borderWidth: 1, borderColor: '#262626', padding: 24, alignItems: 'center',
  },
  gameOverTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  gameOverTitle: { fontSize: 26, fontWeight: '800' },
  gameOverSub: { color: '#c2c2c2', marginBottom: 16, textAlign: 'center' },
  gameOverBold: { fontWeight: '700', color: '#fff' },
  leaveButton: { backgroundColor: '#262626', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  leaveButtonText: { color: '#fff', fontWeight: '700' },
});

export default memo(BluffGamePage);