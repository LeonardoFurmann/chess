import type { Color, Square, UndoInfo } from "./types";

/** Mutable position (docs/SPEC.md §4.1). Only the engine and the AI touch it. */
export interface Position {
  /** 64 signed piece codes, index a1 = 0. */
  board: Int8Array;
  sideToMove: Color;
  /** CASTLE_* bit flags. */
  castling: number;
  /** En passant target square, or NO_SQUARE. */
  epSquare: Square;
  /** Half-moves since the last capture or pawn move (fifty-move rule). */
  halfmoveClock: number;
  fullmoveNumber: number;
  /** King squares, kept up to date by parseFen and makeMove. */
  whiteKing: Square;
  blackKing: Square;
  /** Zobrist hash halves (see zobrist.ts). */
  hashHi: number;
  hashLo: number;
  /** Undo stack, one entry per makeMove. */
  history: UndoInfo[];
}

/** Empty board, white to move, no castling, no en passant, counters 0/1, kings NO_SQUARE. */
export function createEmptyPosition(): Position {
  throw new Error("not implemented");
}

/** Deep copy (board and history included). */
export function clonePosition(position: Position): Position {
  throw new Error("not implemented");
}
