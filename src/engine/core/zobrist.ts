import { fileOf, makeSquare, rankOf } from "./board";
import type { Position } from "./position";
import { createRng } from "./rng";
import type { Rng } from "./rng";
import { BLACK, NO_SQUARE, PAWN, WHITE } from "./types";
import type { HashPair, PieceCode, Square } from "./types";

/**
 * Zobrist keys (docs/SPEC.md §4.4), generated from a fixed seed. Each 64-bit key is split in
 * hi/lo unsigned 32-bit halves stored at the same index of the paired arrays.
 */
export interface ZobristKeys {
  /** Indexed by pieceKeyIndex(piece, square). */
  pieceHi: Uint32Array;
  pieceLo: Uint32Array;
  /** XORed when black is to move. */
  sideHi: number;
  sideLo: number;
  /** Indexed by the castling rights bit set (0..15). */
  castlingHi: Uint32Array;
  castlingLo: Uint32Array;
  /** Indexed by en passant file (0..7). */
  epFileHi: Uint32Array;
  epFileLo: Uint32Array;
}

/** Index into ZobristKeys.piece* for a non-empty piece code and a square. */
export function pieceKeyIndex(piece: PieceCode, square: Square): number {
  const kindIndex = Math.abs(piece) - 1 + (piece > 0 ? 0 : 6);
  return kindIndex * 64 + square;
}

const ZOBRIST_SEED = 0x5eed1234;

let cachedKeys: ZobristKeys | null = null;

function fillKeys(rng: Rng, hi: Uint32Array, lo: Uint32Array): void {
  for (let i = 0; i < hi.length; i++) {
    hi[i] = rng.nextUint32();
    lo[i] = rng.nextUint32();
  }
}

/** Lazily built, cached key tables. */
export function getZobristKeys(): ZobristKeys {
  if (cachedKeys !== null) return cachedKeys;
  const rng = createRng(ZOBRIST_SEED);
  const pieceHi = new Uint32Array(12 * 64);
  const pieceLo = new Uint32Array(12 * 64);
  fillKeys(rng, pieceHi, pieceLo);
  const sideHi = rng.nextUint32();
  const sideLo = rng.nextUint32();
  const castlingHi = new Uint32Array(16);
  const castlingLo = new Uint32Array(16);
  fillKeys(rng, castlingHi, castlingLo);
  // Index 0 (no rights) contributes nothing, so "no castling" is the neutral element.
  castlingHi[0] = 0;
  castlingLo[0] = 0;
  const epFileHi = new Uint32Array(8);
  const epFileLo = new Uint32Array(8);
  fillKeys(rng, epFileHi, epFileLo);
  cachedKeys = { pieceHi, pieceLo, sideHi, sideLo, castlingHi, castlingLo, epFileHi, epFileLo };
  return cachedKeys;
}

/**
 * File (0..7) of the en passant square if it enters the hash — only when the side to move
 * has a pseudo-legal en passant capture — otherwise -1.
 */
export function hashedEpFile(position: Position): number {
  const ep = position.epSquare;
  if (ep === NO_SQUARE) return -1;
  const side = position.sideToMove;
  // The target square is on rank 6 when white captures and on rank 3 when black captures.
  if (rankOf(ep) !== (side === WHITE ? 5 : 2)) return -1;
  const file = fileOf(ep);
  const pawn = PAWN * side;
  const pawnRank = side === WHITE ? 4 : 3;
  if (file > 0 && position.board[makeSquare(file - 1, pawnRank)] === pawn) return file;
  if (file < 7 && position.board[makeSquare(file + 1, pawnRank)] === pawn) return file;
  return -1;
}

/** Full hash computed from scratch. */
export function computeHash(position: Position): HashPair {
  const keys = getZobristKeys();
  let hi = 0;
  let lo = 0;
  const board = position.board;
  for (let square = 0; square < 64; square++) {
    const piece = board[square];
    if (piece === 0) continue;
    const index = pieceKeyIndex(piece, square);
    hi ^= keys.pieceHi[index];
    lo ^= keys.pieceLo[index];
  }
  if (position.sideToMove === BLACK) {
    hi ^= keys.sideHi;
    lo ^= keys.sideLo;
  }
  hi ^= keys.castlingHi[position.castling & 15];
  lo ^= keys.castlingLo[position.castling & 15];
  const epFile = hashedEpFile(position);
  if (epFile >= 0) {
    hi ^= keys.epFileHi[epFile];
    lo ^= keys.epFileLo[epFile];
  }
  return { hi: hi >>> 0, lo: lo >>> 0 };
}
