import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Chess, Move, Square } from 'chess.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

// Unicode chess glyphs - no assets/images needed, render consistently
// across every device and stay perfectly crisp at any size (scalable
// like SVG, just free).
const PIECE_GLYPHS: Record<'w' | 'b', Record<string, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

/**
 * Props same as web version:
 *  chess: chess.js Chess instance (mutable, parent calls move() on it)
 *  orientation: 'white' | 'black' - which side sits at the bottom
 *    (the player's side)
 *  disabled: true means no square-tap works (bot's turn, or the game
 *    already ended)
 *  lastMove: { from, to } | null - for highlighting
 *  onMove(from, to, promotion): the player picked a legal move
 *
 * WEB -> RN CHANGES:
 * - CSS grid (`grid-cols-8` + explicit row-sizing fix) -> plain View
 *   rows (flexDirection: 'row') inside a column View, each square
 *   `flex: 1` - RN has no CSS grid, this gives the same equal 8x8 split.
 * - Piece glyph font-size was `text-[6.5vw] sm:text-3xl` (viewport-unit
 *   based) - RN has no vw units, so we measure the board's own width via
 *   onLayout and derive glyph size from that instead (works at any
 *   embed size, same idea as the web vw hack).
 * - `onClick` -> `onPress` on a `Pressable` per square (no hover state
 *   needed on touch).
 */
interface ChessBoardProps {
  chess: Chess;
  orientation?: 'white' | 'black';
  disabled?: boolean;
  lastMove?: { from: string; to: string } | null;
  onMove: (from: string, to: string, promotion?: string) => void;
}

const ChessBoard = ({ chess, orientation = 'white', disabled = false, lastMove, onMove }: ChessBoardProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<Move[]>([]);
  const [boardWidth, setBoardWidth] = useState(0);

  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? RANKS : [...RANKS].reverse();

  const board = chess.board(); // board[0] = rank 8 ... board[7] = rank 1

  const pieceAt = (square: string) => {
    const fileIdx = FILES.indexOf(square[0] as typeof FILES[number]);
    const rankIdx = RANKS.indexOf(square[1] as typeof RANKS[number]);
    return board[rankIdx][fileIdx];
  };

  const clearSelection = () => {
    setSelected(null);
    setLegalTargets([]);
  };

  const selectSquare = (square: string) => {
    setSelected(square);
    setLegalTargets(chess.moves({ square: square as Square, verbose: true }) as Move[]);
  };

  const handleSquareClick = (square: string) => {
    if (disabled) return;

    if (selected) {
      if (selected === square) {
        clearSelection();
        return;
      }
      const target = legalTargets.find((m) => m.to === square);
      if (target) {
        // Promotion is always Queen - simplest UX; the other pieces
        // (rook/bishop/knight underpromotion) are rare/advanced enough
        // that we skipped that complexity for v1.
        onMove(selected, square, target.promotion ? 'q' : undefined);
        clearSelection();
        return;
      }
      const piece = pieceAt(square);
      if (piece && piece.color === chess.turn()) {
        selectSquare(square);
      } else {
        clearSelection();
      }
      return;
    }

    const piece = pieceAt(square);
    if (piece && piece.color === chess.turn()) {
      selectSquare(square);
    }
  };

  const onBoardLayout = (e: LayoutChangeEvent) => {
    setBoardWidth(e.nativeEvent.layout.width);
  };

  const glyphSize = boardWidth > 0 ? boardWidth / 8 * 0.62 : 24;

  return (
    <View style={styles.board} onLayout={onBoardLayout}>
      {ranks.map((rank) => (
        <View key={rank} style={styles.row}>
          {files.map((file) => {
            const square = `${file}${rank}`;
            const piece = pieceAt(square);
            const isDark = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 1;
            const isSelected = selected === square;
            const isTarget = legalTargets.some((m) => m.to === square);
            const isLastMove = !!lastMove && (lastMove.from === square || lastMove.to === square);

            return (
              <Pressable
                key={square}
                onPress={() => handleSquareClick(square)}
                style={[styles.square, { backgroundColor: isDark ? '#5b4636' : '#e8d9b8' }]}
              >
                {isLastMove && <View style={[StyleSheet.absoluteFill, styles.lastMoveOverlay]} />}
                {isSelected && <View style={[StyleSheet.absoluteFill, styles.selectedOverlay]} />}
                {!!piece && (
                  <Text
                    style={[
                      styles.glyph,
                      { fontSize: glyphSize, color: piece.color === 'w' ? '#f8fafc' : '#0a0912' },
                    ]}
                  >
                    {PIECE_GLYPHS[piece.color as 'w' | 'b'][piece.type]}
                  </Text>
                )}
                {isTarget && !piece && <View style={styles.targetDot} />}
                {isTarget && !!piece && <View style={styles.targetCaptureRing} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  board: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#5b3a29',
  },
  row: { flex: 1, flexDirection: 'row' },
  square: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lastMoveOverlay: { backgroundColor: 'rgba(212,160,23,0.25)' },
  selectedOverlay: {
    borderWidth: 3,
    borderColor: '#8b5cf6',
  },
  glyph: {
    // drop-shadow(0 1px 1px rgba(0,0,0,0.6)) approximated with RN
    // textShadow, since RN Text has no filter/drop-shadow support.
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  targetDot: {
    position: 'absolute',
    width: '33%',
    height: '33%',
    borderRadius: 999,
    backgroundColor: 'rgba(124,58,237,0.7)',
  },
  targetCaptureRing: {
    position: 'absolute',
    top: 2, left: 2, right: 2, bottom: 2,
    borderRadius: 4,
    borderWidth: 4,
    borderColor: 'rgba(239,68,68,0.8)',
  },
});

export default ChessBoard;