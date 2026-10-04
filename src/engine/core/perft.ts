import type { Position } from "./position";
import type { Move } from "./types";

/** Number of leaf nodes of the legal move tree at the given depth. */
export function perft(position: Position, depth: number): number {
  throw new Error("not implemented");
}

/** Perft split by root move, for debugging divergences. */
export function perftDivide(position: Position, depth: number): { move: Move; nodes: number }[] {
  throw new Error("not implemented");
}
