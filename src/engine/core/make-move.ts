import {
  hasFlag,
  moveFrom,
  movePromotion,
  moveTo,
  MOVE_CAPTURE,
  MOVE_CASTLE_KING,
  MOVE_CASTLE_QUEEN,
  MOVE_DOUBLE_PUSH,
  MOVE_EN_PASSANT,
} from "./move";
import type { Position } from "./position";
import {
  BLACK,
  CASTLE_BLACK_KING,
  CASTLE_BLACK_QUEEN,
  CASTLE_WHITE_KING,
  CASTLE_WHITE_QUEEN,
  KING,
  NO_SQUARE,
  PAWN,
  ROOK,
  WHITE,
} from "./types";
import type { Move } from "./types";
import { getZobristKeys, hashedEpFile } from "./zobrist";

/** Castling rights that survive a move touching each square (as origin or destination). */
const CASTLING_KEEP = (() => {
  const keep = new Uint8Array(64).fill(15);
  keep[4] = 15 & ~(CASTLE_WHITE_KING | CASTLE_WHITE_QUEEN);
  keep[60] = 15 & ~(CASTLE_BLACK_KING | CASTLE_BLACK_QUEEN);
  keep[7] = 15 & ~CASTLE_WHITE_KING;
  keep[0] = 15 & ~CASTLE_WHITE_QUEEN;
  keep[63] = 15 & ~CASTLE_BLACK_KING;
  keep[56] = 15 & ~CASTLE_BLACK_QUEEN;
  return keep;
})();

/**
 * Applies a pseudo-legal move in place: captures, en passant, castling, promotion, castling
 * rights, en passant square, counters, side to move, king squares and incremental hash.
 * Pushes an UndoInfo onto position.history.
 */
export function makeMove(position: Position, move: Move): void {
  const keys = getZobristKeys();
  const board = position.board;
  const side = position.sideToMove === BLACK ? BLACK : WHITE;
  const from = moveFrom(move);
  const to = moveTo(move);
  const piece = board[from];
  const promotion = movePromotion(move);

  const oldHashHi = position.hashHi;
  const oldHashLo = position.hashLo;
  let hi = oldHashHi;
  let lo = oldHashLo;

  // Remove the old castling and en passant contributions.
  const oldEpFile = hashedEpFile(position);
  if (oldEpFile >= 0) {
    hi ^= keys.epFileHi[oldEpFile];
    lo ^= keys.epFileLo[oldEpFile];
  }
  hi ^= keys.castlingHi[position.castling];
  lo ^= keys.castlingLo[position.castling];

  // Captured piece (the pawn behind the target square for en passant).
  let captured = 0;
  if (hasFlag(move, MOVE_CAPTURE)) {
    const capSquare = hasFlag(move, MOVE_EN_PASSANT) ? to + (side === WHITE ? -8 : 8) : to;
    captured = board[capSquare];
    board[capSquare] = 0;
    const index = (Math.abs(captured) - 1 + (captured > 0 ? 0 : 6)) * 64 + capSquare;
    hi ^= keys.pieceHi[index];
    lo ^= keys.pieceLo[index];
  }

  position.history.push({
    move,
    captured,
    castling: position.castling,
    epSquare: position.epSquare,
    halfmoveClock: position.halfmoveClock,
    hashHi: oldHashHi,
    hashLo: oldHashLo,
  });

  // Move the piece, promoting if needed.
  const placed = promotion !== 0 ? promotion * side : piece;
  const sideOffset = side === WHITE ? 0 : 6;
  const fromIndex = (Math.abs(piece) - 1 + sideOffset) * 64 + from;
  const toIndex = (Math.abs(placed) - 1 + sideOffset) * 64 + to;
  hi ^= keys.pieceHi[fromIndex] ^ keys.pieceHi[toIndex];
  lo ^= keys.pieceLo[fromIndex] ^ keys.pieceLo[toIndex];
  board[from] = 0;
  board[to] = placed;

  if (Math.abs(piece) === KING) {
    if (side === WHITE) position.whiteKing = to;
    else position.blackKing = to;
  }

  // Castling moves the rook too.
  const castleKing = hasFlag(move, MOVE_CASTLE_KING);
  if (castleKing || hasFlag(move, MOVE_CASTLE_QUEEN)) {
    const rookFrom = castleKing ? from + 3 : from - 4;
    const rookTo = castleKing ? from + 1 : from - 1;
    board[rookFrom] = 0;
    board[rookTo] = ROOK * side;
    const rookBase = (ROOK - 1 + sideOffset) * 64;
    hi ^= keys.pieceHi[rookBase + rookFrom] ^ keys.pieceHi[rookBase + rookTo];
    lo ^= keys.pieceLo[rookBase + rookFrom] ^ keys.pieceLo[rookBase + rookTo];
  }

  position.castling &= CASTLING_KEEP[from] & CASTLING_KEEP[to];
  hi ^= keys.castlingHi[position.castling];
  lo ^= keys.castlingLo[position.castling];

  position.epSquare = hasFlag(move, MOVE_DOUBLE_PUSH) ? (from + to) >> 1 : NO_SQUARE;
  position.halfmoveClock = captured !== 0 || Math.abs(piece) === PAWN ? 0 : position.halfmoveClock + 1;
  if (side === BLACK) position.fullmoveNumber++;
  position.sideToMove = side === WHITE ? BLACK : WHITE;
  hi ^= keys.sideHi;
  lo ^= keys.sideLo;

  // The new en passant contribution depends on the board after the move.
  const newEpFile = hashedEpFile(position);
  if (newEpFile >= 0) {
    hi ^= keys.epFileHi[newEpFile];
    lo ^= keys.epFileLo[newEpFile];
  }
  position.hashHi = hi >>> 0;
  position.hashLo = lo >>> 0;
}

/** Restores exactly the state before the last makeMove (hash included). */
export function unmakeMove(position: Position): void {
  const undo = position.history.pop();
  if (undo === undefined) throw new Error("unmakeMove: empty history");
  const board = position.board;
  const move = undo.move;
  const from = moveFrom(move);
  const to = moveTo(move);
  // The side that made the move.
  const side = position.sideToMove === WHITE ? BLACK : WHITE;

  position.sideToMove = side;
  if (side === BLACK) position.fullmoveNumber--;

  const moved = movePromotion(move) !== 0 ? PAWN * side : board[to];
  board[from] = moved;
  if (hasFlag(move, MOVE_EN_PASSANT)) {
    board[to] = 0;
    board[to + (side === WHITE ? -8 : 8)] = undo.captured;
  } else {
    board[to] = undo.captured;
  }

  if (Math.abs(moved) === KING) {
    if (side === WHITE) position.whiteKing = from;
    else position.blackKing = from;
  }

  if (hasFlag(move, MOVE_CASTLE_KING)) {
    board[from + 3] = ROOK * side;
    board[from + 1] = 0;
  } else if (hasFlag(move, MOVE_CASTLE_QUEEN)) {
    board[from - 4] = ROOK * side;
    board[from - 1] = 0;
  }

  position.castling = undo.castling;
  position.epSquare = undo.epSquare;
  position.halfmoveClock = undo.halfmoveClock;
  position.hashHi = undo.hashHi;
  position.hashLo = undo.hashLo;
}
