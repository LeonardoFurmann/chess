import { fileOf, parseSquare, rankOf, squareName } from "./board";
import { generateLegalMoves, inCheck } from "./legal";
import { makeMove, unmakeMove } from "./make-move";
import {
  hasFlag,
  moveFrom,
  movePromotion,
  moveTo,
  MOVE_CAPTURE,
  MOVE_CASTLE_KING,
  MOVE_CASTLE_QUEEN,
} from "./move";
import type { Position } from "./position";
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK } from "./types";
import type { Move } from "./types";

const PROMOTION_LETTERS: Readonly<Record<number, string>> = {
  [KNIGHT]: "n",
  [BISHOP]: "b",
  [ROOK]: "r",
  [QUEEN]: "q",
};

const PIECE_LETTERS: Readonly<Record<number, string>> = {
  [KNIGHT]: "N",
  [BISHOP]: "B",
  [ROOK]: "R",
  [QUEEN]: "Q",
  [KING]: "K",
};

const FILE_LETTERS = "abcdefgh";

function promotionSuffix(move: Move): string {
  const promotion = movePromotion(move);
  return promotion === 0 ? "" : PROMOTION_LETTERS[promotion];
}

/** "e2e4", "e7e8q"; castling as the king move ("e1g1"). */
export function moveToUci(move: Move): string {
  return squareName(moveFrom(move)) + squareName(moveTo(move)) + promotionSuffix(move);
}

/** The legal move matching the UCI string, or null if it is illegal or malformed. */
export function uciToMove(position: Position, uci: string): Move | null {
  if (!/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(uci)) return null;
  const from = parseSquare(uci.slice(0, 2));
  const to = parseSquare(uci.slice(2, 4));
  const suffix = uci.slice(4);
  for (const move of generateLegalMoves(position)) {
    if (moveFrom(move) === from && moveTo(move) === to && promotionSuffix(move) === suffix) return move;
  }
  return null;
}

/** SAN of a legal move, computed before the move is played. Does not change the position. */
export function moveToSan(position: Position, move: Move): string {
  const from = moveFrom(move);
  const to = moveTo(move);
  const kind = Math.abs(position.board[from]);
  let san: string;

  if (hasFlag(move, MOVE_CASTLE_KING)) {
    san = "O-O";
  } else if (hasFlag(move, MOVE_CASTLE_QUEEN)) {
    san = "O-O-O";
  } else {
    const capture = hasFlag(move, MOVE_CAPTURE);
    if (kind === PAWN) {
      san = (capture ? FILE_LETTERS[fileOf(from)] + "x" : "") + squareName(to);
      const promotion = movePromotion(move);
      if (promotion !== 0) san += "=" + PIECE_LETTERS[promotion];
    } else {
      san = PIECE_LETTERS[kind] + disambiguation(position, move, kind) + (capture ? "x" : "") + squareName(to);
    }
  }

  makeMove(position, move);
  try {
    if (inCheck(position)) {
      san += generateLegalMoves(position).length === 0 ? "#" : "+";
    }
  } finally {
    unmakeMove(position);
  }
  return san;
}

/** Minimal origin qualifier among the other legal moves of the same piece kind to the same square. */
function disambiguation(position: Position, move: Move, kind: number): string {
  const from = moveFrom(move);
  const to = moveTo(move);
  let ambiguous = false;
  let sameFile = false;
  let sameRank = false;
  for (const other of generateLegalMoves(position)) {
    const otherFrom = moveFrom(other);
    if (otherFrom === from || moveTo(other) !== to) continue;
    if (Math.abs(position.board[otherFrom]) !== kind) continue;
    ambiguous = true;
    if (fileOf(otherFrom) === fileOf(from)) sameFile = true;
    if (rankOf(otherFrom) === rankOf(from)) sameRank = true;
  }
  if (!ambiguous) return "";
  if (!sameFile) return FILE_LETTERS[fileOf(from)];
  if (!sameRank) return String(rankOf(from) + 1);
  return squareName(from);
}
