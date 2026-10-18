import {
  BISHOP_DIRECTIONS,
  QUEEN_DIRECTIONS,
  ROOK_DIRECTIONS,
  fileOf,
  kingTargets,
  knightTargets,
  rankOf,
  ray,
} from "./board";
import type { Direction } from "./board";
import {
  MOVE_CAPTURE,
  MOVE_CASTLE_KING,
  MOVE_CASTLE_QUEEN,
  MOVE_DOUBLE_PUSH,
  MOVE_EN_PASSANT,
  encodeMove,
} from "./move";
import type { Position } from "./position";
import {
  BISHOP,
  BLACK,
  CASTLE_BLACK_KING,
  CASTLE_BLACK_QUEEN,
  CASTLE_WHITE_KING,
  CASTLE_WHITE_QUEEN,
  KING,
  KNIGHT,
  NO_SQUARE,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
} from "./types";
import type { Move, PromotionKind, Square } from "./types";

const PROMOTIONS: readonly PromotionKind[] = [QUEEN, ROOK, BISHOP, KNIGHT];

function addPawnMove(moves: Move[], from: Square, to: Square, flags: number, lastRank: boolean): void {
  if (lastRank) {
    for (const kind of PROMOTIONS) moves.push(encodeMove(from, to, flags, kind));
  } else {
    moves.push(encodeMove(from, to, flags));
  }
}

function generatePawnMoves(position: Position, from: Square, color: number, moves: Move[]): void {
  const board = position.board;
  const forward = color === WHITE ? 8 : -8;
  const startRank = color === WHITE ? 1 : 6;
  const lastRank = color === WHITE ? 7 : 0;
  const rank = rankOf(from);
  const file = fileOf(from);
  const one = from + forward;
  const promotes = rankOf(one) === lastRank;

  if (board[one] === 0) {
    addPawnMove(moves, from, one, 0, promotes);
    if (rank === startRank && board[one + forward] === 0) {
      moves.push(encodeMove(from, one + forward, MOVE_DOUBLE_PUSH));
    }
  }

  for (const df of [-1, 1]) {
    const f = file + df;
    if (f < 0 || f > 7) continue;
    const to = one + df;
    const target = board[to];
    if (target !== 0 && target * color < 0) {
      addPawnMove(moves, from, to, MOVE_CAPTURE, promotes);
    } else if (target === 0 && to === position.epSquare && position.epSquare !== NO_SQUARE) {
      // The captured pawn sits behind the target square and must be an enemy pawn.
      if (board[to - forward] === -color * PAWN) {
        moves.push(encodeMove(from, to, MOVE_CAPTURE | MOVE_EN_PASSANT));
      }
    }
  }
}

function addStepMoves(
  position: Position,
  from: Square,
  color: number,
  targets: readonly Square[],
  moves: Move[],
): void {
  const board = position.board;
  for (const to of targets) {
    const target = board[to];
    if (target === 0) moves.push(encodeMove(from, to));
    else if (target * color < 0) moves.push(encodeMove(from, to, MOVE_CAPTURE));
  }
}

function addSlidingMoves(
  position: Position,
  from: Square,
  color: number,
  directions: readonly Direction[],
  moves: Move[],
): void {
  const board = position.board;
  for (const direction of directions) {
    for (const to of ray(from, direction)) {
      const target = board[to];
      if (target === 0) {
        moves.push(encodeMove(from, to));
        continue;
      }
      if (target * color < 0) moves.push(encodeMove(from, to, MOVE_CAPTURE));
      break;
    }
  }
}

function generateCastling(position: Position, color: number, moves: Move[]): void {
  const board = position.board;
  const base = color === WHITE ? 0 : 56;
  const kingSquare = base + 4;
  if (board[kingSquare] !== color * KING) return;
  const kingRight = color === WHITE ? CASTLE_WHITE_KING : CASTLE_BLACK_KING;
  const queenRight = color === WHITE ? CASTLE_WHITE_QUEEN : CASTLE_BLACK_QUEEN;
  const rook = color * ROOK;

  if (
    (position.castling & kingRight) !== 0 &&
    board[base + 7] === rook &&
    board[base + 5] === 0 &&
    board[base + 6] === 0
  ) {
    moves.push(encodeMove(kingSquare, base + 6, MOVE_CASTLE_KING));
  }
  if (
    (position.castling & queenRight) !== 0 &&
    board[base] === rook &&
    board[base + 1] === 0 &&
    board[base + 2] === 0 &&
    board[base + 3] === 0
  ) {
    moves.push(encodeMove(kingSquare, base + 2, MOVE_CASTLE_QUEEN));
  }
}

/**
 * All pseudo-legal moves of the side to move (docs/SPEC.md §4.2).
 * Castling is generated when the right exists, the rook is in place and the squares between
 * king and rook are empty; attacked squares are checked later by the legality filter.
 */
export function generatePseudoLegalMoves(position: Position): Move[] {
  const moves: Move[] = [];
  const color = position.sideToMove === BLACK ? BLACK : WHITE;
  const board = position.board;

  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (piece === 0 || piece * color < 0) continue;
    switch (Math.abs(piece)) {
      case PAWN:
        generatePawnMoves(position, from, color, moves);
        break;
      case KNIGHT:
        addStepMoves(position, from, color, knightTargets(from), moves);
        break;
      case BISHOP:
        addSlidingMoves(position, from, color, BISHOP_DIRECTIONS, moves);
        break;
      case ROOK:
        addSlidingMoves(position, from, color, ROOK_DIRECTIONS, moves);
        break;
      case QUEEN:
        addSlidingMoves(position, from, color, QUEEN_DIRECTIONS, moves);
        break;
      case KING:
        addStepMoves(position, from, color, kingTargets(from), moves);
        break;
    }
  }
  generateCastling(position, color, moves);
  return moves;
}
