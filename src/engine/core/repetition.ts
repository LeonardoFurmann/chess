import type { Position } from "./position";

/**
 * How many times the current position has occurred, including now (1 = first occurrence).
 * Only looks back to the last irreversible move (bounded by the half-move clock).
 */
export function repetitionCount(position: Position): number {
  throw new Error("not implemented");
}
