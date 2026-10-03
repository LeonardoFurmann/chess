import type { Position } from "./position";
import type { Move } from "./types";

/** "e2e4", "e7e8q"; castling as the king move ("e1g1"). */
export function moveToUci(move: Move): string {
  throw new Error("not implemented");
}

/** The legal move matching the UCI string, or null if it is illegal or malformed. */
export function uciToMove(position: Position, uci: string): Move | null {
  throw new Error("not implemented");
}

/** SAN of a legal move, computed before the move is played. Does not change the position. */
export function moveToSan(position: Position, move: Move): string {
  throw new Error("not implemented");
}
