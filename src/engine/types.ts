/**
 * Public engine types, used by the UI (docs/SPEC.md §4.3). This file is a contract.
 */

export type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
export type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type SquareName = `${File}${Rank}`;

export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type PromotionPiece = "q" | "r" | "b" | "n";

export interface Piece {
  readonly color: Color;
  readonly type: PieceType;
}

/** 64 squares, index a1 = 0, h1 = 7, a8 = 56, h8 = 63. */
export type BoardState = readonly (Piece | null)[];

/** What the UI asks to play. `promotion` is required when a pawn reaches the last rank. */
export interface MoveInput {
  readonly from: SquareName;
  readonly to: SquareName;
  readonly promotion?: PromotionPiece;
}

/** A legal or played move, with its notations. */
export interface GameMove {
  readonly from: SquareName;
  readonly to: SquareName;
  readonly promotion?: PromotionPiece;
  readonly color: Color;
  readonly piece: PieceType;
  readonly captured: boolean;
  readonly san: string;
  /** "e2e4", "e7e8q"; castling as the king move. */
  readonly uci: string;
}

export type DrawReason = "fifty-move" | "threefold" | "insufficient-material";

export type GameStatus =
  | { readonly kind: "playing"; readonly inCheck: boolean }
  | { readonly kind: "checkmate"; readonly winner: Color; readonly inCheck: true }
  | { readonly kind: "stalemate"; readonly inCheck: false }
  | { readonly kind: "draw"; readonly reason: DrawReason; readonly inCheck: boolean };

/**
 * Immutable game: initial FEN plus the moves played (UCI). Implementations may keep derived
 * state (e.g. a cached Position) outside this object, such as in a WeakMap, but never expose it.
 */
export interface Game {
  readonly initialFen: string;
  readonly uciMoves: readonly string[];
}
