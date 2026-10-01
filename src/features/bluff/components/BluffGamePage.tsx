import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BluffPlayerChip, { BluffPfp, type SeatPlayer } from './BluffPlayerChip';
import BluffArena from './BluffArena';
import BluffDeckInfo from './BluffDeckInfo';
import BluffHandTray from './BluffHandTray';
import BluffBottomBar from './BluffBottomBar';
import BluffCardFlight, { FLIGHT_TOTAL_MS } from './BluffCardFlight';
import BluffRevealPanel, { type BluffRevealResult } from './BluffRevealPanel';
import { DEFAULT_SETTINGS, sigilById } from '../theme/bluffTheme';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import { showAlert } from '../../../shared/utils/alertBus';

// BluffGamePage - "Bluff Court" (ONLINE, server-authoritative). Poora
// game-state `match` prop se aata hai (useGameOverlays ke bluff_* payloads).
// Yeh component khud koi game-decision nahi leta - sirf render karta hai.
//
// UI: upar 4 player cards (sirf PFP) + turn timer, beech mein oval table +
// pile, event banner, neeche hand fan + CALL / ACCUSE buttons.
//
// SEAT REMAPPING: server seats 0-3 absolute hote hain, display seat 0 hamesha "self".

const remap = (serverSeat: number, mySeat: number) => (serverSeat - mySeat + 4) % 4;

type Rect = { x: number; y: number; w: number; h: number };
const measureWin = (node: any) =>
  new Promise<Rect | null>((resolve) => {
    if (!node || !node.measureInWindow) return resolve(null);
    node.measureInWindow((x: number, y: number, w: number, h: number) => resolve({ x, y, w, h }));
  });

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
  const insets = useSafeAreaInsets();

  // ---------- derived view ----------
  const view = useMemo(() => {
    if (!match) return null;
    const mySeat = match.yourSeat;
    const settings = { ...DEFAULT_SETTINGS, ...(match.settings || {}) };

    const players: (SeatPlayer & { hand: any[]; userId?: any })[] = (match.players || []).map((p: any) => {
      const isSelf = p.seat === mySeat;
      const opponentId = p.user_id ?? p.id ?? p.userId;
      const cachedOpponent = opponentId ? opponentAvatars[opponentId] : null;
      const hand = isSelf ? match.yourHand || [] : new Array(p.cardsRemaining || 0).fill(null);
      return {
        seat: remap(p.seat, mySeat),
        name: isSelf ? selfProfile?.username || p.username || 'You' : p.username || 'Player',
        photoUrl: isSelf ? selfProfile?.photoUrl : p.photoUrl || cachedOpponent?.photoUrl,
        hand,
        cardsRemaining: hand.length,
        risk: p.risk || 0,
        riskMax: p.riskMax ?? settings.doomMax,
        lastPlayedCount: p.lastPlayedCount || 0,
        isEliminated: !!p.isEliminated,
      };
    });

    const bySeat = new Map<number, any>(players.map((p) => [p.seat, p] as [number, any]));
    const currentTurnSeat = match.phase === 'turn' ? remap(match.currentTurnSeat, mySeat) : null;
    const lastPlay =
      match.lastActorSeat != null && match.pileCount > 0 ? { seat: remap(match.lastActorSeat, mySeat) } : null;

    const reveal: BluffRevealResult | null = match.reveal
      ? {
          cards: match.reveal.cards,
          callSigilId: match.reveal.call_sigil,
          wasTruthful: match.reveal.was_truthful,
          loserName: bySeat.get(remap(match.reveal.loser_seat, mySeat))?.name || '',
          accuserName: bySeat.get(remap(match.reveal.accuser_seat, mySeat))?.name || '',
          prevPlayerName: bySeat.get(remap(match.reveal.prev_seat, mySeat))?.name || '',
          loserAvatar: {
            equippedByCategory: undefined,
            photoUrl: bySeat.get(remap(match.reveal.loser_seat, mySeat))?.photoUrl,
          },
          accuserAvatar: {
            equippedByCategory: undefined,
            photoUrl: bySeat.get(remap(match.reveal.accuser_seat, mySeat))?.photoUrl,
          },
          prevAvatar: {
            equippedByCategory: undefined,
            photoUrl: bySeat.get(remap(match.reveal.prev_seat, mySeat))?.photoUrl,
          },
          accuserIsSelf: remap(match.reveal.accuser_seat, mySeat) === 0,
          loserIsSelf: remap(match.reveal.loser_seat, mySeat) === 0,
          prevIsSelf: remap(match.reveal.prev_seat, mySeat) === 0,
          eliminated: bySeat.get(remap(match.reveal.loser_seat, mySeat))?.isEliminated ?? !!match.reveal.eliminated_now,
          chambersAfter: match.reveal.chambers_after,
          chambersMax: settings.doomMax,
        }
      : null;

    return { mySeat, settings, players, currentTurnSeat, lastPlay, reveal, bySeat };
  }, [match, selfProfile, opponentAvatars]);

  // ---------- turn timer ----------
  const phase = match?.phase;
  const endsAt: number | null = phase === 'turn' ? match?.turnEndsAt ?? null : null;
  const totalMs = ((match?.turnTime as number) || 20) * 1000;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  // ---------- hand selection ----------
  const handKey = (match?.yourHand || []).join(',');
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => setSelected([]), [handKey, match?.currentTurnSeat, match?.round]);
  const [handOpen, setHandOpen] = useState(true);

  // ---------- card-play animation ----------
  const rootRef = useRef<View>(null);
  const handRef = useRef<View>(null);
  const pileRef = useRef<View>(null);
  const chipRefs = useRef<(View | null)[]>([]);
  const [flight, setFlight] = useState<{ id: number; from: { x: number; y: number }; to: { x: number; y: number }; count: number } | null>(null);
  const [holdPile, setHoldPile] = useState<number | null>(null);
  const [landTick, setLandTick] = useState(0);
  const flightId = useRef(0);
  const prevRef = useRef<{ pile: number; round: number } | null>(null);
  const flightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flightTimer.current) clearTimeout(flightTimer.current);
    },
    []
  );

  const fireFlight = useCallback(async (displaySeat: number, count: number, prevPile: number) => {
    setHoldPile(prevPile); // pile ka count tab tak purana dikhao jab tak cards land na ho jaayein
    const [root, src, dst] = await Promise.all([
      measureWin(rootRef.current),
      measureWin(displaySeat === 0 ? handRef.current : chipRefs.current[displaySeat]),
      measureWin(pileRef.current),
    ]);
    if (!root || !src || !dst) {
      setHoldPile(null);
      return;
    }
    const n = Math.min(count, 3);
    setFlight({
      id: ++flightId.current,
      from: { x: src.x - root.x + src.w / 2, y: src.y - root.y + src.h / 2 },
      to: { x: dst.x - root.x + dst.w / 2, y: dst.y - root.y + dst.h / 2 },
      count: n,
    });
    if (flightTimer.current) clearTimeout(flightTimer.current);
    flightTimer.current = setTimeout(() => {
      setFlight(null);
      setHoldPile(null);
      setLandTick((t) => t + 1);
    }, FLIGHT_TOTAL_MS(n));
  }, []);

  useEffect(() => {
    if (!match) return;
    const prev = prevRef.current;
    prevRef.current = { pile: match.pileCount, round: match.round };
    if (!prev || !show) return;
    if (
      match.round === prev.round &&
      match.phase === 'turn' &&
      match.pileCount > prev.pile &&
      match.lastActorSeat != null
    ) {
      fireFlight(remap(match.lastActorSeat, match.yourSeat), match.pileCount - prev.pile, prev.pile);
    }
  }, [match, show, fireFlight]);

  // ---------- render ----------
  if (!show) return null;

  if (!match || !view) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }, styles.centered]}>
        <ActivityIndicator size="large" color="#a78bfa" />
        <Text style={styles.loadingText}>Setting up the table…</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const { settings, players, currentTurnSeat, lastPlay, reveal, bySeat } = view as any;
  const self = players.find((p: any) => p.seat === 0);
  const isMyTurn = phase === 'turn' && currentTurnSeat === 0 && !self.isEliminated;
  const canAccuse = isMyTurn && !!lastPlay;
  const canPlay = isMyTurn && selected.length > 0;
  const gameOver = match.gameOver;
  const iWon = gameOver && gameOver.winner_seat != null && remap(gameOver.winner_seat, view.mySeat) === 0;
  const alive = players.filter((p: any) => !p.isEliminated).length;
  const call = match.callSigil ? sigilById(match.callSigil) : null;

  const toggleCard = (idx: number) => {
    if (!isMyTurn) return;
    setSelected((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      if (prev.length >= settings.maxPlayCount) return prev;
      return [...prev, idx];
    });
  };

  const handlePlay = () => {
    if (!canPlay) return;
    onPlayCards(selected);
    setSelected([]);
  };

  // Event banner text
  const lastActor = lastPlay ? bySeat.get(lastPlay.seat) : null;
  const turnPlayer = currentTurnSeat != null ? bySeat.get(currentTurnSeat) : null;
  let bannerTitle: React.ReactNode;
  let bannerSub: string;
  let bannerPhoto: string | null | undefined = lastActor?.photoUrl;
  let bannerName: string | undefined = lastActor?.name;
  if (lastActor) {
    const n = lastActor.lastPlayedCount || 0;
    bannerTitle = (
      <>
        <Text style={styles.bannerBold}>{lastActor.name}</Text> played <Text style={styles.bannerBold}>{n}</Text> card{n === 1 ? '' : 's'}.
      </>
    );
    bannerSub = isMyTurn ? 'Trust them, or call it out?' : turnPlayer ? `${turnPlayer.name} is deciding…` : '';
  } else {
    bannerPhoto = turnPlayer?.photoUrl;
    bannerName = turnPlayer?.name;
    bannerTitle = isMyTurn ? (
      <Text style={styles.bannerBold}>Your move</Text>
    ) : (
      <>
        <Text style={styles.bannerBold}>{turnPlayer?.name || 'Someone'}</Text> opens the round.
      </>
    );
    bannerSub = isMyTurn ? 'Play your cards face-down. Bluff if you must.' : 'Waiting for the first play…';
  }

  const slots = [0, 1, 2, 3].map((s) => bySeat.get(s) || null);

  return (
    <View ref={rootRef} collapsable={false} style={styles.screen}>
      <LinearGradient colors={['#0b0716', '#150b28', '#07050f']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onClose} style={styles.roundBtn} accessibilityLabel="Leave table">
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>

        <View style={styles.titleBlock}>
          <MaterialCommunityIcons name="crown" size={22} color="#facc15" style={{ marginBottom: -2 }} />
          <Text style={styles.title}>BLUFF COURT</Text>
          <View style={styles.titleUnderline} />
          <Text style={styles.tagline}>DON'T JUST PLAY  •  BLUFF</Text>
        </View>

        <Pressable
          onPress={() =>
            showAlert(
              `Play cards face-down and claim they match the call${call ? ` (${call.name})` : ''}. Next player can trust you, or ACCUSE. The liar takes a trigger shot - last one standing wins. You have ${Math.round(totalMs / 1000)}s per turn.`,
              'info'
            )
          }
          style={styles.roundBtn}
          accessibilityLabel="How to play"
        >
          <Ionicons name="information" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Players (PFP only) */}
      <View style={styles.playersRow}>
        {slots.map((p: any, seat: number) => (
          <BluffPlayerChip
            key={seat}
            player={p}
            displaySeat={seat}
            isSelf={seat === 0}
            isTurn={!!p && currentTurnSeat === seat}
            secondsLeft={secondsLeft}
            endsAt={endsAt}
            totalMs={totalMs}
            chipRef={(node) => {
              chipRefs.current[seat] = node;
            }}
          />
        ))}
      </View>

      {/* Table */}
      <View style={styles.tableWrap}>
        <BluffArena
          callSigilId={match.callSigil}
          pileCount={holdPile ?? match.pileCount}
          round={match.round}
          alive={alive}
          pileRef={pileRef}
          landTick={landTick}
        />
        <BluffDeckInfo deck={match.deck} hand={match.yourHand} callSigilId={match.callSigil} />
        {match.timedOut && phase === 'turn' && <Text style={styles.timedOutText}>A player ran out of time.</Text>}
      </View>

      {/* Event banner */}
      <View style={styles.banner}>
        <View style={styles.bannerAccent} />
        <BluffPfp uri={bannerPhoto} size={38} name={bannerName} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerText}>{bannerTitle}</Text>
          {!!bannerSub && <Text style={styles.bannerSub}>{bannerSub}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#8b5cf6" />
      </View>

      {/* Hand */}
      <View style={styles.handArea}>
        <Pressable onPress={() => setHandOpen((o) => !o)} style={styles.viewCards}>
          <Ionicons name={handOpen ? 'eye-off-outline' : 'cube-outline'} size={20} color="#c4b5fd" />
          <Text style={styles.viewCardsText}>{handOpen ? 'Hide\nCards' : 'View\nCards'}</Text>
        </Pressable>
        <Text style={styles.selectedText}>{selected.length} selected</Text>

        {handOpen ? (
          <BluffHandTray
            hand={self.hand}
            selected={selected}
            canPlay={isMyTurn}
            maxPlayCount={settings.maxPlayCount}
            onToggle={toggleCard}
            containerRef={handRef}
          />
        ) : (
          <View ref={handRef} collapsable={false} style={styles.handHidden}>
            <Text style={styles.handHiddenText}>{self.hand.length} cards hidden</Text>
          </View>
        )}
      </View>

      <BluffBottomBar
        callSigilId={match.callSigil}
        canPlay={canPlay}
        canAccuse={canAccuse}
        onPlay={handlePlay}
        onAccuse={onAccuse}
        bottomInset={insets.bottom}
      />

      <BluffCardFlight flight={flight} />

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
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#07050f' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#a78bfa' },
  cancelText: { fontSize: 12, color: '#6e6e6e', textDecorationLine: 'underline', marginTop: 8 },

  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 6 },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,12,40,0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.45)',
  },
  titleBlock: { alignItems: 'center' },
  title: {
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: '#7c3aed',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 2 },
  },
  titleUnderline: { width: 150, height: 3, borderRadius: 2, backgroundColor: '#facc15', marginTop: -2 },
  tagline: { marginTop: 6, fontSize: 9, letterSpacing: 2.2, color: '#a78bfa', fontWeight: '600' },

  playersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingTop: 16 },
  tableWrap: { flex: 1, paddingHorizontal: 12 },
  timedOutText: { fontSize: 11, color: '#8b7bb5', textAlign: 'center', marginBottom: 4 },

  banner: {
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16,10,34,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.35)',
    overflow: 'hidden',
  },
  bannerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#8b5cf6' },
  bannerText: { fontSize: 14, color: '#e5e7eb' },
  bannerBold: { fontWeight: '800', color: '#fff' },
  bannerSub: { fontSize: 12, color: '#a78bfa', marginTop: 2 },

  handArea: { paddingTop: 6, minHeight: 150 },
  viewCards: {
    position: 'absolute',
    left: 12,
    top: 34,
    zIndex: 5,
    width: 58,
    height: 74,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: 'rgba(20,12,40,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.4)',
  },
  viewCardsText: { fontSize: 11, fontWeight: '600', color: '#e9d5ff', textAlign: 'center' },
  selectedText: { position: 'absolute', right: 14, top: 12, fontSize: 12, color: '#a78bfa', zIndex: 5 },
  handHidden: { minHeight: 118, alignItems: 'center', justifyContent: 'center' },
  handHiddenText: { fontSize: 12, color: '#6b5b8f' },

  gameOverOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 170,
  },
  gameOverCard: { width: '100%', maxWidth: 340, backgroundColor: '#161022', borderRadius: 20, borderWidth: 1, borderColor: '#2e1f52', padding: 24, alignItems: 'center' },
  gameOverTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  gameOverTitle: { fontSize: 26, fontWeight: '800' },
  gameOverSub: { color: '#c2c2c2', marginBottom: 16, textAlign: 'center' },
  gameOverBold: { fontWeight: '700', color: '#fff' },
  leaveButton: { backgroundColor: '#2e1f52', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  leaveButtonText: { color: '#fff', fontWeight: '700' },
});

export default memo(BluffGamePage);