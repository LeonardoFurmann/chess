import type { Position } from "./position";
import type { Move } from "./types";

/**
 * All pseudo-legal moves of the side to move (docs/SPEC.md §4.2).
 * Castling is generated when the right exists, the rook is in place and the squares between
 * king and rook are empty; attacked squares are checked later by the legality filter.
 */
export function generatePseudoLegalMoves(position: Position): Move[] {
  throw new Error("not implemented");
}
