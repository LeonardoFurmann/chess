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

/** File 0..7 (a..h). */
export function fileOf(square: Square): number {
  throw new Error("not implemented");
}

/** Rank 0..7 (1..8). */
export function rankOf(square: Square): number {
  throw new Error("not implemented");
}

export function makeSquare(file: number, rank: number): Square {
  throw new Error("not implemented");
}

/** 0 -> "a1", 63 -> "h8". */
export function squareName(square: Square): string {
  throw new Error("not implemented");
}

/** "a1" -> 0, "h8" -> 63; NO_SQUARE for invalid input. */
export function parseSquare(name: string): Square {
  throw new Error("not implemented");
}

/** Precomputed knight destinations from a square. */
export function knightTargets(square: Square): readonly Square[] {
  throw new Error("not implemented");
}

/** Precomputed king destinations (the up to 8 neighbours) from a square. */
export function kingTargets(square: Square): readonly Square[] {
  throw new Error("not implemented");
}

/** Precomputed squares along a direction, nearest first, without wrapping around the board. */
export function ray(square: Square, direction: Direction): readonly Square[] {
  throw new Error("not implemented");
}
