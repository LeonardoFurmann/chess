import type { Position } from "./position";
import type { Move } from "./types";

/**
 * Applies a pseudo-legal move in place: captures, en passant, castling, promotion, castling
 * rights, en passant square, counters, side to move, king squares and incremental hash.
 * Pushes an UndoInfo onto position.history.
 */
export function makeMove(position: Position, move: Move): void {
  throw new Error("not implemented");
}

/** Restores exactly the state before the last makeMove (hash included). */
export function unmakeMove(position: Position): void {
  throw new Error("not implemented");
}
