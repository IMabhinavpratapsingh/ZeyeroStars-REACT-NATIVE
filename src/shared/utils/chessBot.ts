// Move-picker for offline "vs Bot" chess. The RULES of chess (legal
// moves, check/checkmate/stalemate, castling, en-passant, promotion,
// all of it) are handled entirely by the 'chess.js' library - all we do
// here is, whenever it's the bot's turn, pick the "best" move (based on
// difficulty) out of whatever legal moves it has available. We didn't
// reinvent the wheel here - as discussed, chess logic is already
// well-established across the world, so we're just using chess.js.
//
// NOTE: for this file to work, the 'chess.js' npm package must be
// installed in the project: `npx expo install chess.js`
// (pure JS logic library, works identically in RN - no web APIs used)

import type { Chess, Move } from 'chess.js';

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Static material eval - just how much "value" of material each side
// has left on the board, positive for white, negative for black. This
// is the ONE eval function used inside both the Medium/Hard minimax -
// depth and randomness are what actually differ between them (below,
// in pickBotMove).
function evaluateBoard(chess: Chess): number {
  const board = chess.board();
  let score = 0;
  for (const row of board) {
    for (const sq of row) {
      if (!sq) continue;
      const val = PIECE_VALUES[sq.type] || 0;
      score += sq.color === 'w' ? val : -val;
    }
  }
  return score;
}

// Standard minimax + alpha-beta pruning, purely on top of the
// material-eval - this depth (max 3) is plenty for that purpose, no
// need to add a full piece-square-table etc (the bot just needs to
// look "somewhat smart", not be Stockfish).
function minimax(chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }
  const moves = chess.moves();
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      chess.move(m);
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    chess.move(m);
    best = Math.min(best, minimax(chess, depth - 1, alpha, beta, true));
    chess.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export type ChessDifficulty = 'easy' | 'medium' | 'hard';

// Returns a verbose move object (from chess.moves({verbose:true})) or
// null if there are no legal moves left (game already over).
//
// Easy (~200 elo): mostly random - no lookahead, just a slight lean
//   towards captures (very much a beginner, frequent blunders).
// Medium (~1000 elo): 2-ply minimax + a fair amount of randomness -
//   plays decent moves but isn't consistent, occasionally picks a weak
//   move too.
// Hard (~2000 elo): 3-ply minimax + less randomness - mostly plays the
//   best-eval move, with a small amount of randomness left in for
//   variety.
export function pickBotMove(chess: Chess, difficulty: ChessDifficulty): Move | null {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    const captures = moves.filter((m: { captured: any; }) => m.captured);
    const pool = captures.length && Math.random() < 0.35 ? captures : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const depth = difficulty === 'hard' ? 3 : 2;
  const randomness = difficulty === 'hard' ? 0.08 : 0.25;
  const botIsWhite = chess.turn() === 'w';

  let bestMove: Move | null = null;
  let bestScore = botIsWhite ? -Infinity : Infinity;
  const scored: { move: Move; score: number }[] = [];

  for (const m of moves) {
    chess.move(m);
    const score = minimax(chess, depth - 1, -Infinity, Infinity, !botIsWhite);
    chess.undo();
    scored.push({ move: m, score });
    if (botIsWhite ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  // Sometimes deliberately skip the best move and pick a random one
  // instead - so the bot doesn't feel like a "perfect calculator", and
  // keeps a bit of human-ish variance.
  if (Math.random() < randomness) {
    return scored[Math.floor(Math.random() * scored.length)].move;
  }
  return bestMove;
}

export const CHESS_DIFFICULTIES = [
  { id: 'easy', label: 'Easy', elo: 200 },
  { id: 'medium', label: 'Medium', elo: 1000 },
  { id: 'hard', label: 'Hard', elo: 2000 },
] as const;