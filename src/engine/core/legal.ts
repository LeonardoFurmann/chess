import { isSquareAttacked } from "./attacks";
import { hasFlag, moveFrom, moveTo, MOVE_CASTLE_KING, MOVE_CASTLE_QUEEN, MOVE_EN_PASSANT } from "./move";
import { generatePseudoLegalMoves } from "./movegen";
import type { Position } from "./position";
import { BLACK, KING, WHITE } from "./types";
import type { Color, Move } from "./types";

function kingSquareOf(position: Position, color: Color): number {
  return color === WHITE ? position.whiteKing : position.blackKing;
}

/** Castling is illegal out of check or across an attacked square (the target is checked after the move). */
function castlingTransitAllowed(position: Position, move: Move, enemy: Color): boolean {
  const from = moveFrom(move);
  const transit = hasFlag(move, MOVE_CASTLE_KING) ? from + 1 : from - 1;
  return !isSquareAttacked(position, from, enemy) && !isSquareAttacked(position, transit, enemy);
}

/**
 * True if the mover's king is attacked after the move. Only the board is touched (no history,
 * hash or counters) and it is restored before returning, which is much cheaper than makeMove.
 * For castling the rook is ignored: the transit square was already verified and the rook on it
 * cannot expose the destination square.
 */
function leavesKingAttacked(position: Position, move: Move, side: Color, enemy: Color): boolean {
  const board = position.board;
  const from = moveFrom(move);
  const to = moveTo(move);
  const piece = board[from];
  const victimSquare = hasFlag(move, MOVE_EN_PASSANT) ? to + (side === WHITE ? -8 : 8) : to;
  const victim = board[victimSquare];
  board[victimSquare] = 0;
  board[from] = 0;
  board[to] = piece;
  const kingSquare = Math.abs(piece) === KING ? to : kingSquareOf(position, side);
  const attacked = isSquareAttacked(position, kingSquare, enemy);
  board[to] = 0;
  board[victimSquare] = victim;
  board[from] = piece;
  return attacked;
}

/** Pseudo-legal moves that do not leave the own king attacked, with castling safety checks. */
export function generateLegalMoves(position: Position): Move[] {
  const side: Color = position.sideToMove === BLACK ? BLACK : WHITE;
  const enemy: Color = side === WHITE ? BLACK : WHITE;
  const pseudo = generatePseudoLegalMoves(position);
  const legal: Move[] = [];
  for (let i = 0; i < pseudo.length; i++) {
    const move = pseudo[i];
    if (hasFlag(move, MOVE_CASTLE_KING | MOVE_CASTLE_QUEEN) && !castlingTransitAllowed(position, move, enemy)) {
      continue;
    }
    if (!leavesKingAttacked(position, move, side, enemy)) legal.push(move);
  }
  return legal;
}

/** True if the side to move is in check. */
export function inCheck(position: Position): boolean {
  const side: Color = position.sideToMove === BLACK ? BLACK : WHITE;
  return isSquareAttacked(position, kingSquareOf(position, side), side === WHITE ? BLACK : WHITE);
}

export function isCheckmate(position: Position): boolean {
  return inCheck(position) && generateLegalMoves(position).length === 0;
}

export function isStalemate(position: Position): boolean {
  return !inCheck(position) && generateLegalMoves(position).length === 0;
}
