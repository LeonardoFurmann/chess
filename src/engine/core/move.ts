import type { Move, PromotionKind, Square } from "./types";

/**
 * Bit layout of a packed move (docs/SPEC.md §4.1):
 *
 *   bits  0-5   from square
 *   bits  6-11  to square
 *   bits 12-14  promotion kind (0 = none, otherwise KNIGHT..QUEEN)
 *   bits 15-20  flags (MOVE_* below)
 *
 * Conventions:
 * - En passant moves carry both MOVE_CAPTURE and MOVE_EN_PASSANT.
 * - Castling moves are encoded as the king's move (e1g1, e1c1, e8g8, e8c8).
 * - MOVE_PROMOTION is set automatically when a promotion kind is given.
 */
export const MOVE_CAPTURE = 1;
export const MOVE_DOUBLE_PUSH = 2;
export const MOVE_EN_PASSANT = 4;
export const MOVE_CASTLE_KING = 8;
export const MOVE_CASTLE_QUEEN = 16;
export const MOVE_PROMOTION = 32;

const FLAGS_SHIFT = 15;

export function encodeMove(from: Square, to: Square, flags = 0, promotion: PromotionKind | 0 = 0): Move {
  const allFlags = promotion !== 0 ? flags | MOVE_PROMOTION : flags;
  return from | (to << 6) | (promotion << 12) | (allFlags << FLAGS_SHIFT);
}

export function moveFrom(move: Move): Square {
  return move & 0x3f;
}

export function moveTo(move: Move): Square {
  return (move >> 6) & 0x3f;
}

export function movePromotion(move: Move): PromotionKind | 0 {
  return ((move >> 12) & 0x7) as PromotionKind | 0;
}

export function moveFlags(move: Move): number {
  return (move >> FLAGS_SHIFT) & 0x3f;
}

export function hasFlag(move: Move, flag: number): boolean {
  return (moveFlags(move) & flag) !== 0;
}
