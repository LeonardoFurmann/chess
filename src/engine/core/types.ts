/**
 * Core types and constants of the internal engine layer (docs/SPEC.md §4.1).
 * This file is a contract: do not change it inside a ticket.
 */

/** Side to move / piece owner. White is 1, black is -1, so `-color` is the opponent. */
export const WHITE = 1;
export const BLACK = -1;
export type Color = typeof WHITE | typeof BLACK;

/** Piece kinds. A piece code is `kind * color` (e.g. black queen = -5). */
export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export type PieceKind = typeof PAWN | typeof KNIGHT | typeof BISHOP | typeof ROOK | typeof QUEEN | typeof KING;
export type PromotionKind = typeof KNIGHT | typeof BISHOP | typeof ROOK | typeof QUEEN;

/** Signed piece code stored in the board: positive = white, negative = black, 0 = empty. */
export type PieceCode = number;

/** Square index 0..63, `rank * 8 + file`, with a1 = 0, h1 = 7, a8 = 56, h8 = 63. */
export type Square = number;
export const NO_SQUARE = -1;

/** Packed move (see move.ts for the bit layout). */
export type Move = number;

/** Castling rights bit flags. */
export const CASTLE_WHITE_KING = 1;
export const CASTLE_WHITE_QUEEN = 2;
export const CASTLE_BLACK_KING = 4;
export const CASTLE_BLACK_QUEEN = 8;
export const CASTLE_ALL = 15;

/** 64-bit Zobrist hash stored as two unsigned 32-bit halves (no BigInt). */
export interface HashPair {
  hi: number;
  lo: number;
}

/** State pushed by makeMove and popped by unmakeMove. */
export interface UndoInfo {
  move: Move;
  /** Piece code removed by the move (0 if none). For en passant, the captured pawn. */
  captured: PieceCode;
  castling: number;
  epSquare: Square;
  halfmoveClock: number;
  /** Hash of the position *before* the move. Also used for repetition detection. */
  hashHi: number;
  hashLo: number;
}

export function pieceColor(piece: PieceCode): Color {
  return piece > 0 ? WHITE : BLACK;
}

export function pieceKind(piece: PieceCode): PieceKind {
  return Math.abs(piece) as PieceKind;
}
