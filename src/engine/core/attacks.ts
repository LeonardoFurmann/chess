import type { Position } from "./position";
import type { Color, Square } from "./types";

/** True if any piece of `byColor` attacks `square` (en passant is not an attack on a square). */
export function isSquareAttacked(position: Position, square: Square, byColor: Color): boolean {
  throw new Error("not implemented");
}
