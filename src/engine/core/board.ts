import { NO_SQUARE } from "./types";
import type { Square } from "./types";

/** Sliding directions. Each ray starts next to the origin and stops at the board edge. */
export const NORTH = 0;
export const SOUTH = 1;
export const EAST = 2;
export const WEST = 3;
export const NORTH_EAST = 4;
export const NORTH_WEST = 5;
export const SOUTH_EAST = 6;
export const SOUTH_WEST = 7;
export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ROOK_DIRECTIONS: readonly Direction[] = [NORTH, SOUTH, EAST, WEST];
export const BISHOP_DIRECTIONS: readonly Direction[] = [NORTH_EAST, NORTH_WEST, SOUTH_EAST, SOUTH_WEST];
export const QUEEN_DIRECTIONS: readonly Direction[] = [...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS];

const FILE_NAMES = "abcdefgh";

/** File 0..7 (a..h). */
export function fileOf(square: Square): number {
  return square & 7;
}

/** Rank 0..7 (1..8). */
export function rankOf(square: Square): number {
  return square >> 3;
}

export function makeSquare(file: number, rank: number): Square {
  return rank * 8 + file;
}

/** 0 -> "a1", 63 -> "h8". */
export function squareName(square: Square): string {
  return FILE_NAMES[fileOf(square)] + String(rankOf(square) + 1);
}

/** "a1" -> 0, "h8" -> 63; NO_SQUARE for invalid input. */
export function parseSquare(name: string): Square {
  if (name.length !== 2) return NO_SQUARE;
  const file = FILE_NAMES.indexOf(name[0]);
  const rank = name.charCodeAt(1) - 49;
  if (file < 0 || rank < 0 || rank > 7) return NO_SQUARE;
  return makeSquare(file, rank);
}

type Delta = readonly [number, number];

/** [fileDelta, rankDelta], indexed by Direction. */
const DIRECTION_DELTAS: readonly Delta[] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

const KNIGHT_DELTAS: readonly Delta[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

function inBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

function offsets(square: Square, deltas: readonly Delta[]): Square[] {
  const result: Square[] = [];
  for (const [df, dr] of deltas) {
    const f = fileOf(square) + df;
    const r = rankOf(square) + dr;
    if (inBoard(f, r)) result.push(makeSquare(f, r));
  }
  return result;
}

const KNIGHT_TABLE: readonly (readonly Square[])[] = Array.from({ length: 64 }, (_, sq) =>
  offsets(sq, KNIGHT_DELTAS),
);

const KING_TABLE: readonly (readonly Square[])[] = Array.from({ length: 64 }, (_, sq) =>
  offsets(sq, DIRECTION_DELTAS),
);

const RAY_TABLE: readonly (readonly (readonly Square[])[])[] = Array.from({ length: 64 }, (_, sq) =>
  DIRECTION_DELTAS.map(([df, dr]) => {
    const squares: Square[] = [];
    let f = fileOf(sq) + df;
    let r = rankOf(sq) + dr;
    while (inBoard(f, r)) {
      squares.push(makeSquare(f, r));
      f += df;
      r += dr;
    }
    return squares;
  }),
);

/** Precomputed knight destinations from a square. */
export function knightTargets(square: Square): readonly Square[] {
  return KNIGHT_TABLE[square];
}

/** Precomputed king destinations (the up to 8 neighbours) from a square. */
export function kingTargets(square: Square): readonly Square[] {
  return KING_TABLE[square];
}

/** Precomputed squares along a direction, nearest first, without wrapping around the board. */
export function ray(square: Square, direction: Direction): readonly Square[] {
  return RAY_TABLE[square][direction];
}
