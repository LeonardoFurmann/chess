import { fileOf, rankOf } from "./board";
import { BISHOP, KING, KNIGHT } from "./types";
import type { Position } from "./position";

/**
 * Exactly the cases of docs/SPEC.md §4.4: K vs K, K+N vs K, K+B vs K, and kings plus bishops
 * only, with every bishop on squares of the same colour.
 */
export function isInsufficientMaterial(position: Position): boolean {
  let knights = 0;
  let bishops = 0;
  let lightBishops = 0;
  let darkBishops = 0;

  for (let square = 0; square < 64; square++) {
    const kind = Math.abs(position.board[square]);
    if (kind === 0 || kind === KING) continue;
    if (kind === KNIGHT) {
      knights++;
    } else if (kind === BISHOP) {
      bishops++;
      // a1 (file 0, rank 0) is a dark square.
      if ((fileOf(square) + rankOf(square)) % 2 === 0) darkBishops++;
      else lightBishops++;
    } else {
      // Any pawn, rook or queen is enough material.
      return false;
    }
  }

  if (knights === 0) return lightBishops === 0 || darkBishops === 0;
  // With a knight, only a lone knight (no bishops, no other knight) is insufficient.
  return knights === 1 && bishops === 0;
}

/** Half-move clock >= 100. Checkmate precedence is handled by the public Game API. */
export function isFiftyMoveDraw(position: Position): boolean {
  return position.halfmoveClock >= 100;
}
