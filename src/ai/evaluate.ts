import { WHITE } from "@/engine/core";
import type { Position } from "@/engine/core";

/** Material values in centipawns (Simplified Evaluation Function), indexed by piece kind. */
export const PIECE_VALUES: Readonly<Record<1 | 2 | 3 | 4 | 5 | 6, number>> = {
  1: 100,
  2: 320,
  3: 330,
  4: 500,
  5: 900,
  6: 0,
};

/*
 * Piece-square tables (Simplified Evaluation Function, Tomasz Michniewski), written from
 * white's point of view as they look on the board: the first row is rank 8, the last is rank 1.
 */
/* prettier-ignore */
const PAWN_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

/* prettier-ignore */
const KNIGHT_TABLE = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

/* prettier-ignore */
const BISHOP_TABLE = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];

/* prettier-ignore */
const ROOK_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0,
];

/* prettier-ignore */
const QUEEN_TABLE = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];

/* prettier-ignore */
const KING_TABLE = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
];

/** Indexed by piece kind (1..6); index 0 is unused. */
const TABLES: readonly (readonly number[])[] = [
  [],
  PAWN_TABLE,
  KNIGHT_TABLE,
  BISHOP_TABLE,
  ROOK_TABLE,
  QUEEN_TABLE,
  KING_TABLE,
];

/** Material + piece-square tables, in centipawns, from the side to move's point of view. */
export function evaluate(position: Position): number {
  const board = position.board;
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq];
    if (piece === 0) continue;
    const kind = (piece > 0 ? piece : -piece) as 1 | 2 | 3 | 4 | 5 | 6;
    // Tables are laid out rank 8 first (index 0 = a8), so white flips the rank and black reads directly.
    const value = PIECE_VALUES[kind] + TABLES[kind][piece > 0 ? sq ^ 56 : sq];
    score += piece > 0 ? value : -value;
  }
  return position.sideToMove === WHITE ? score : 0 - score; // `0 -` avoids returning -0
}
