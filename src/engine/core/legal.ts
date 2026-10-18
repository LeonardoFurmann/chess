import { isSquareAttacked } from "./attacks";
import { makeMove, unmakeMove } from "./make-move";
import { hasFlag, moveFrom, MOVE_CASTLE_KING, MOVE_CASTLE_QUEEN } from "./move";
import { generatePseudoLegalMoves } from "./movegen";
import type { Position } from "./position";
import { BLACK, WHITE } from "./types";
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

/** Pseudo-legal moves that do not leave the own king attacked, with castling safety checks. */
export function generateLegalMoves(position: Position): Move[] {
  const side: Color = position.sideToMove === BLACK ? BLACK : WHITE;
  const enemy: Color = side === WHITE ? BLACK : WHITE;
  const legal: Move[] = [];
  for (const move of generatePseudoLegalMoves(position)) {
    if (hasFlag(move, MOVE_CASTLE_KING | MOVE_CASTLE_QUEEN) && !castlingTransitAllowed(position, move, enemy)) {
      continue;
    }
    makeMove(position, move);
    if (!isSquareAttacked(position, kingSquareOf(position, side), enemy)) legal.push(move);
    unmakeMove(position);
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
