import type { Position } from "./position";
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

/** Lazily built, cached key tables. */
export function getZobristKeys(): ZobristKeys {
  throw new Error("not implemented");
}

/**
 * File (0..7) of the en passant square if it enters the hash — only when the side to move
 * has a pseudo-legal en passant capture — otherwise -1.
 */
export function hashedEpFile(position: Position): number {
  throw new Error("not implemented");
}

/** Full hash computed from scratch. */
export function computeHash(position: Position): HashPair {
  throw new Error("not implemented");
}
