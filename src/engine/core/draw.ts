import type { Position } from "./position";

/**
 * Exactly the cases of docs/SPEC.md §4.4: K vs K, K+N vs K, K+B vs K, and kings plus bishops
 * only, with every bishop on squares of the same colour.
 */
export function isInsufficientMaterial(position: Position): boolean {
  throw new Error("not implemented");
}

/** Half-move clock >= 100. Checkmate precedence is handled by the public Game API. */
export function isFiftyMoveDraw(position: Position): boolean {
  throw new Error("not implemented");
}
