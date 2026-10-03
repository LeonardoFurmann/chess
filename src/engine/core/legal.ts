import type { Position } from "./position";
import type { Move } from "./types";

/** Pseudo-legal moves that do not leave the own king attacked, with castling safety checks. */
export function generateLegalMoves(position: Position): Move[] {
  throw new Error("not implemented");
}

/** True if the side to move is in check. */
export function inCheck(position: Position): boolean {
  throw new Error("not implemented");
}

export function isCheckmate(position: Position): boolean {
  throw new Error("not implemented");
}

export function isStalemate(position: Position): boolean {
  throw new Error("not implemented");
}
