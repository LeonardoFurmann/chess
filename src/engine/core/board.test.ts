import { describe, expect, it } from "vitest";
import {
  EAST,
  NORTH,
  NORTH_EAST,
  ROOK_DIRECTIONS,
  SOUTH,
  SOUTH_WEST,
  WEST,
  fileOf,
  kingTargets,
  knightTargets,
  makeSquare,
  parseSquare,
  rankOf,
  ray,
  squareName,
} from "./board";
import type { Direction } from "./board";
import { NO_SQUARE } from "./types";

const ALL_DIRECTIONS: Direction[] = [0, 1, 2, 3, 4, 5, 6, 7];

describe("square helpers", () => {
  it("maps indexes to names and back", () => {
    expect(squareName(0)).toBe("a1");
    expect(squareName(7)).toBe("h1");
    expect(squareName(56)).toBe("a8");
    expect(squareName(63)).toBe("h8");
    for (let sq = 0; sq < 64; sq++) expect(parseSquare(squareName(sq))).toBe(sq);
  });

  it("computes file, rank and makeSquare", () => {
    expect(fileOf(0)).toBe(0);
    expect(rankOf(0)).toBe(0);
    expect(fileOf(63)).toBe(7);
    expect(rankOf(63)).toBe(7);
    expect(makeSquare(4, 3)).toBe(28);
    expect(squareName(28)).toBe("e4");
  });

  it("returns NO_SQUARE for invalid names", () => {
    for (const name of ["", "a", "i1", "a0", "a9", "A1", "a11", "1a"]) {
      expect(parseSquare(name)).toBe(NO_SQUARE);
    }
  });
});

describe("move tables", () => {
  it("knight target counts", () => {
    expect(knightTargets(parseSquare("a1"))).toHaveLength(2);
    expect(knightTargets(parseSquare("h8"))).toHaveLength(2);
    expect(knightTargets(parseSquare("d4"))).toHaveLength(8);
    expect(knightTargets(parseSquare("b1"))).toHaveLength(3);
    expect([...knightTargets(parseSquare("a1"))].sort((a, b) => a - b)).toEqual([
      parseSquare("c2"),
      parseSquare("b3"),
    ].sort((a, b) => a - b));
  });

  it("king target counts", () => {
    expect(kingTargets(parseSquare("h8"))).toHaveLength(3);
    expect(kingTargets(parseSquare("a1"))).toHaveLength(3);
    expect(kingTargets(parseSquare("e1"))).toHaveLength(5);
    expect(kingTargets(parseSquare("e4"))).toHaveLength(8);
  });

  it("never wraps around the board edge", () => {
    for (let sq = 0; sq < 64; sq++) {
      for (const t of [...knightTargets(sq), ...kingTargets(sq)]) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(64);
        expect(Math.abs(fileOf(t) - fileOf(sq))).toBeLessThanOrEqual(2);
      }
      for (const t of kingTargets(sq)) {
        expect(Math.abs(fileOf(t) - fileOf(sq))).toBeLessThanOrEqual(1);
      }
    }
  });

  it("has no ray from h1 heading east", () => {
    const h1 = parseSquare("h1");
    expect(ray(h1, EAST)).toEqual([]);
    expect(ray(h1, SOUTH)).toEqual([]);
    expect(ray(h1, NORTH_EAST)).toEqual([]);
    expect(ray(h1, SOUTH_WEST)).toEqual([]);
    expect(ray(h1, NORTH)).toHaveLength(7);
    expect(ray(h1, WEST)).toHaveLength(7);
  });

  it("orders rays nearest first", () => {
    expect(ray(0, NORTH)).toEqual([8, 16, 24, 32, 40, 48, 56]);
    expect(ray(0, NORTH_EAST)).toEqual([9, 18, 27, 36, 45, 54, 63]);
  });

  it("rays stay on the same line", () => {
    for (let sq = 0; sq < 64; sq++) {
      for (const dir of ALL_DIRECTIONS) {
        let prev = sq;
        for (const t of ray(sq, dir)) {
          expect(Math.abs(fileOf(t) - fileOf(prev))).toBeLessThanOrEqual(1);
          expect(Math.abs(rankOf(t) - rankOf(prev))).toBeLessThanOrEqual(1);
          prev = t;
        }
      }
    }
    expect(ROOK_DIRECTIONS).toHaveLength(4);
  });
});
