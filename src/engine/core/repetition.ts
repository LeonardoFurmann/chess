import type { Position } from "./position";

/**
 * How many times the current position has occurred, including now (1 = first occurrence).
 * Only looks back to the last irreversible move (bounded by the half-move clock).
 */
export function repetitionCount(position: Position): number {
  const history = position.history;
  const limit = Math.min(position.halfmoveClock, history.length);
  let count = 1;
  // history[length - k] holds the hash from k plies ago; only even k have the same side to move.
  for (let k = 2; k <= limit; k += 2) {
    const entry = history[history.length - k];
    if (entry.hashHi === position.hashHi && entry.hashLo === position.hashLo) count++;
  }
  return count;
}
