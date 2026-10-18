import {
  BISHOP_DIRECTIONS,
  ROOK_DIRECTIONS,
  fileOf,
  kingTargets,
  knightTargets,
  ray,
} from "./board";
import type { Direction } from "./board";
import type { Position } from "./position";
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "./types";
import type { Color, Square } from "./types";

function slidingAttacker(
  position: Position,
  square: Square,
  directions: readonly Direction[],
  slider: number,
  queen: number,
): boolean {
  const board = position.board;
  for (const direction of directions) {
    for (const target of ray(square, direction)) {
      const piece = board[target];
      if (piece === 0) continue;
      if (piece === slider || piece === queen) return true;
      break;
    }
  }
  return false;
}

/** True if any piece of `byColor` attacks `square` (en passant is not an attack on a square). */
export function isSquareAttacked(position: Position, square: Square, byColor: Color): boolean {
  const board = position.board;

  // Pawns: a white pawn attacks one rank up, so it sits one rank below the target (and vice versa).
  const pawn = PAWN * byColor;
  const base = square + (byColor === WHITE ? -8 : 8);
  if (base >= 0 && base < 64) {
    const file = fileOf(square);
    if (file > 0 && board[base - 1] === pawn) return true;
    if (file < 7 && board[base + 1] === pawn) return true;
  }

  const knight = KNIGHT * byColor;
  for (const s of knightTargets(square)) {
    if (board[s] === knight) return true;
  }

  const king = KING * byColor;
  for (const s of kingTargets(square)) {
    if (board[s] === king) return true;
  }

  const queen = QUEEN * byColor;
  return (
    slidingAttacker(position, square, BISHOP_DIRECTIONS, BISHOP * byColor, queen) ||
    slidingAttacker(position, square, ROOK_DIRECTIONS, ROOK * byColor, queen)
  );
}
