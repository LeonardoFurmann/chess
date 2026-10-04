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

/** Material + piece-square tables, in centipawns, from the side to move's point of view. */
export function evaluate(position: Position): number {
  throw new Error("not implemented");
}
