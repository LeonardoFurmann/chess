import type { Position } from "./position";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Parses a FEN string into a new position (docs/SPEC.md §4.5).
 * Throws an Error whose message identifies the invalid field.
 */
export function parseFen(fen: string): Position {
  throw new Error("not implemented");
}

/** Standard FEN serialization; the en passant square is written after every double push. */
export function toFen(position: Position): string {
  throw new Error("not implemented");
}
