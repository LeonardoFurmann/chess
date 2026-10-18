import { makeSquare, parseSquare, rankOf, squareName } from "./board";
import { createEmptyPosition } from "./position";
import type { Position } from "./position";
import { computeHash } from "./zobrist";
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

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const PIECE_CHARS = "pnbrqk";

const CASTLE_FLAGS: Record<string, number> = {
  K: CASTLE_WHITE_KING,
  Q: CASTLE_WHITE_QUEEN,
  k: CASTLE_BLACK_KING,
  q: CASTLE_BLACK_QUEEN,
};

function pieceFromChar(ch: string): number {
  const index = PIECE_CHARS.indexOf(ch.toLowerCase());
  if (index < 0) return 0;
  const kind = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING][index];
  return ch === ch.toLowerCase() ? -kind : kind;
}

function parseCounter(text: string, field: string, min: number): number {
  if (!/^\d+$/.test(text)) {
    throw new Error(`Invalid FEN: ${field} "${text}" is not a non-negative integer`);
  }
  const value = Number(text);
  if (value < min) {
    throw new Error(`Invalid FEN: ${field} "${text}" must be at least ${min}`);
  }
  return value;
}

/**
 * Parses a FEN string into a new position (docs/SPEC.md §4.5).
 * Throws an Error whose message identifies the invalid field.
 */
export function parseFen(fen: string): Position {
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) {
    throw new Error(`Invalid FEN: expected 6 fields, got ${fields.length}`);
  }
  const [placement, side, castling, ep, halfmove, fullmove] = fields;
  const position = createEmptyPosition();

  const ranks = placement.split("/");
  if (ranks.length !== 8) {
    throw new Error(`Invalid FEN: piece placement must have 8 ranks, got ${ranks.length}`);
  }
  let whiteKings = 0;
  let blackKings = 0;
  for (let i = 0; i < 8; i++) {
    const rank = 7 - i;
    let file = 0;
    for (const ch of ranks[i]) {
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
        if (file > 8) {
          throw new Error(`Invalid FEN: piece placement rank ${rank + 1} has more than 8 squares`);
        }
        continue;
      }
      const piece = pieceFromChar(ch);
      if (piece === 0) {
        throw new Error(`Invalid FEN: piece placement has unknown piece "${ch}"`);
      }
      if (file >= 8) {
        throw new Error(`Invalid FEN: piece placement rank ${rank + 1} has more than 8 squares`);
      }
      const square = makeSquare(file, rank);
      position.board[square] = piece;
      if (piece === KING) {
        whiteKings++;
        position.whiteKing = square;
      } else if (piece === -KING) {
        blackKings++;
        position.blackKing = square;
      }
      file++;
    }
    if (file !== 8) {
      throw new Error(`Invalid FEN: piece placement rank ${rank + 1} has ${file} squares, expected 8`);
    }
  }
  if (whiteKings !== 1) {
    throw new Error(`Invalid FEN: piece placement must have exactly one white king, got ${whiteKings}`);
  }
  if (blackKings !== 1) {
    throw new Error(`Invalid FEN: piece placement must have exactly one black king, got ${blackKings}`);
  }

  if (side === "w") position.sideToMove = WHITE;
  else if (side === "b") position.sideToMove = BLACK;
  else throw new Error(`Invalid FEN: side to move "${side}" must be "w" or "b"`);

  if (castling !== "-") {
    if (!/^[KQkq]+$/.test(castling)) {
      throw new Error(`Invalid FEN: castling "${castling}" is invalid`);
    }
    for (const ch of castling) {
      const flag = CASTLE_FLAGS[ch];
      if (position.castling & flag) {
        throw new Error(`Invalid FEN: castling "${castling}" has duplicate flags`);
      }
      position.castling |= flag;
    }
  }

  if (ep !== "-") {
    const square = parseSquare(ep);
    if (square === NO_SQUARE) {
      throw new Error(`Invalid FEN: en passant square "${ep}" is invalid`);
    }
    if (rankOf(square) !== 2 && rankOf(square) !== 5) {
      throw new Error(`Invalid FEN: en passant square "${ep}" must be on rank 3 or 6`);
    }
    position.epSquare = square;
  }

  position.halfmoveClock = parseCounter(halfmove, "halfmove clock", 0);
  position.fullmoveNumber = parseCounter(fullmove, "fullmove number", 1);
  const hash = computeHash(position);
  position.hashHi = hash.hi;
  position.hashLo = hash.lo;
  return position;
}

/** Standard FEN serialization; the en passant square is written after every double push. */
export function toFen(position: Position): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = position.board[makeSquare(file, rank)];
      if (piece === 0) {
        empty++;
        continue;
      }
      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }
      const ch = PIECE_CHARS[Math.abs(piece) - 1];
      row += piece > 0 ? ch.toUpperCase() : ch;
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }

  let castling = "";
  if (position.castling & CASTLE_WHITE_KING) castling += "K";
  if (position.castling & CASTLE_WHITE_QUEEN) castling += "Q";
  if (position.castling & CASTLE_BLACK_KING) castling += "k";
  if (position.castling & CASTLE_BLACK_QUEEN) castling += "q";

  const ep = position.epSquare === NO_SQUARE ? "-" : squareName(position.epSquare);
  const side = position.sideToMove === WHITE ? "w" : "b";
  return `${rows.join("/")} ${side} ${castling || "-"} ${ep} ${position.halfmoveClock} ${position.fullmoveNumber}`;
}
