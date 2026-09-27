import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chess } from 'chess.js';
import { Ionicons } from '@expo/vector-icons';
import ChessBoard from './ChessBoard';
import { pickBotMove, CHESS_DIFFICULTIES, type ChessDifficulty } from '../../../shared/utils/chessBot';

// How long the bot "thinks" for (ms) - purely a cosmetic delay, so the
// move doesn't instant-snap and feels a bit more like it's "thinking".
const BOT_THINK_MIN_MS = 400;
const BOT_THINK_MAX_MS = 900;

type Stage = 'select' | 'difficulty' | 'playing';
type GameStatus = 'you_win' | 'bot_win' | 'draw' | null;

/**
 * Stages:
 *  'select'     - choose Offline vs Online
 *  'difficulty' - (offline picked) choose Easy/Medium/Hard
 *  'playing'    - game in progress
 *
 * This component makes no assumptions about any surrounding chrome
 * (header/close-button) - both RoomChessPanel (floating, draggable) and
 * ChessFullScreenModal (from home, full screen) embed it and render
 * their own chrome around it.
 *
 * WEB -> RN CHANGES:
 * - `lucide-react` icons (ChevronLeft, Swords, Bot, Users, RotateCcw)
 *   -> `Ionicons` (@expo/vector-icons), same convention already used
 *   across the rest of this RN codebase (see PlayerPreviewModal etc).
 * - Tailwind classNames -> StyleSheet objects.
 * - `../../utils/chessBot` -> `../../../shared/utils/chessBot` (utils
 *   live under shared/ in the RN structure).
 */
const ChessFlow = () => {
  const [stage, setStage] = useState<Stage>('select');
  const [difficulty, setDifficulty] = useState<ChessDifficulty | null>(null);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState<GameStatus>(null);
  const [thinking, setThinking] = useState(false);
  const [, forceRender] = useState(0);

  const chessRef = useRef<Chess | null>(null);

  const startGame = (diffId: ChessDifficulty) => {
    chessRef.current = new Chess();
    setDifficulty(diffId);
    setLastMove(null);
    setStatus(null);
    setThinking(false);
    // Random color each new game - a bit of variety, sometimes white,
    // sometimes black.
    setPlayerColor(Math.random() < 0.5 ? 'w' : 'b');
    setStage('playing');
    forceRender((n) => n + 1);
  };

  const checkGameOver = (chess: Chess) => {
    if (!chess.isGameOver()) return false;
    if (chess.isCheckmate()) {
      // Whoever's turn it was just got checkmated - so the winner is
      // their opponent.
      const loserColor = chess.turn();
      setStatus(loserColor === playerColor ? 'bot_win' : 'you_win');
    } else {
      setStatus('draw');
    }
    return true;
  };

  // The bot's own turn - if the player is 'b', the bot moves first
  // (right as the game starts), otherwise it moves after the player.
  useEffect(() => {
    if (stage !== 'playing') return;
    const chess = chessRef.current;
    if (!chess || chess.isGameOver()) return;

    const botColor = playerColor === 'w' ? 'b' : 'w';
    if (chess.turn() !== botColor) return;

    setThinking(true);
    const delay = BOT_THINK_MIN_MS + Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS);
    const timer = setTimeout(() => {
      const move = difficulty ? pickBotMove(chess, difficulty) : null;
      if (move) {
        chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
        setLastMove({ from: move.from, to: move.to });
      }
      setThinking(false);
      checkGameOver(chess);
      forceRender((n) => n + 1);
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, lastMove, difficulty, playerColor, status]);

  const handlePlayerMove = (from: string, to: string, promotion?: string) => {
    const chess = chessRef.current;
    if (!chess || thinking || status) return;
    if (chess.turn() !== playerColor) return;
    const move = chess.move({ from, to, promotion: promotion || 'q' });
    if (!move) return;
    setLastMove({ from, to });
    checkGameOver(chess);
    forceRender((n) => n + 1);
  };

  // === Stage: mode select ===
  if (stage === 'select') {
    return (
      <View style={styles.centerScreen}>
        <Ionicons name="skull-outline" size={36} color="#8b5cf6" style={{ marginBottom: 4 }} />
        <Text style={styles.title}>Chess</Text>
        <Text style={styles.subtitle}>How do you want to play?</Text>
        <Pressable onPress={() => setStage('difficulty')} style={styles.primaryBtn}>
          <Ionicons name="hardware-chip-outline" size={18} color="#ffffff" />
          <Text style={styles.primaryBtnText}>Offline (vs Bot)</Text>
        </Pressable>
        <View style={[styles.primaryBtn, styles.disabledBtn]}>
          <Ionicons name="people-outline" size={18} color="#5f5878" />
          <Text style={styles.disabledBtnText}>Online — Coming soon</Text>
        </View>
      </View>
    );
  }

  // === Stage: difficulty select ===
  if (stage === 'difficulty') {
    return (
      <View style={styles.centerScreen}>
        <Pressable onPress={() => setStage('select')} style={styles.backRow}>
          <Ionicons name="chevron-back" size={16} color="#a8a0c0" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { marginBottom: 4 }]}>Choose difficulty</Text>
        <View style={styles.difficultyList}>
          {CHESS_DIFFICULTIES.map((d) => (
            <Pressable key={d.id} onPress={() => startGame(d.id)} style={styles.difficultyBtn}>
              <Text style={styles.difficultyLabel}>{d.label}</Text>
              <Text style={styles.difficultyElo}>{d.elo} elo</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // === Stage: playing ===
  const chess = chessRef.current;
  if (!chess) return null;

  return (
    // Simple: sirf board, koi extra "Change difficulty"/status bar
    // nahi - panel (RoomChessPanel) ki height bhi isi board-size ke
    // hisaab se snug-fit calculate hoti hai, isliye yahan ka max-width
    // formula wahan (RoomChessPanel) ke PANEL size calc se match hona
    // chahiye.
    <View style={styles.playWrap}>
      <View style={styles.boardOuter}>
        <ChessBoard
          chess={chess}
          orientation={playerColor === 'w' ? 'white' : 'black'}
          disabled={thinking || !!status || chess.turn() !== playerColor}
          lastMove={lastMove}
          onMove={handlePlayerMove}
        />

        {/* Game-over UI board ke UPAR overlay hai (panel ka size
            fixed/snug rehta hai chahe game khatam ho ya na ho). */}
        {!!status && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              {status === 'you_win' ? '🎉 You won!' : status === 'bot_win' ? 'Bot won, try again' : 'Draw'}
            </Text>
            <Pressable onPress={() => difficulty && startGame(difficulty)} style={styles.rematchBtn}>
              <Ionicons name="refresh" size={14} color="#ffffff" />
              <Text style={styles.rematchBtnText}>Rematch</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  title: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  subtitle: { fontSize: 13, color: '#a8a0c0', marginBottom: 4 },
  primaryBtn: {
    width: '100%', maxWidth: 260, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#7c3aed', paddingVertical: 12, borderRadius: 14,
  },
  primaryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  disabledBtn: { backgroundColor: '#241f38' },
  disabledBtnText: { color: '#5f5878', fontWeight: '700', fontSize: 14 },
  backRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  backText: { color: '#a8a0c0', fontWeight: '600', fontSize: 13 },
  difficultyList: { width: '100%', maxWidth: 260, gap: 8 },
  difficultyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#241f38', borderWidth: 1, borderColor: '#332b52',
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14,
  },
  difficultyLabel: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  difficultyElo: { color: '#a8a0c0', fontWeight: '600', fontSize: 12 },
  playWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, minHeight: 0 },
  boardOuter: { position: 'relative', width: '100%', maxWidth: 380 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 8,
  },
  overlayText: { fontWeight: '700', color: '#ffffff', fontSize: 14 },
  rematchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7c3aed',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
  },
  rematchBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
});

export default ChessFlow;