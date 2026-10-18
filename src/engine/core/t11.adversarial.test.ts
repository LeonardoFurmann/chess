import { describe, expect, it } from "vitest";
import {
  BISHOP_DIRECTIONS, EAST, NORTH, NORTH_EAST, NORTH_WEST, QUEEN_DIRECTIONS, ROOK_DIRECTIONS, SOUTH, SOUTH_EAST,
  SOUTH_WEST, WEST, fileOf, kingTargets, knightTargets, makeSquare, parseSquare, rankOf, ray, squareName,
} from "./board";
import type { Direction } from "./board";
import { clonePosition, createEmptyPosition } from "./position";
import { START_FEN, parseFen, toFen } from "./fen";
import {
  BLACK, CASTLE_ALL, CASTLE_BLACK_KING, CASTLE_BLACK_QUEEN, CASTLE_WHITE_KING, CASTLE_WHITE_QUEEN, NO_SQUARE, WHITE,
} from "./types";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PERFT_CASES } from "../../../test/fixtures/perft";

const ALL_DIRS: Direction[] = [NORTH, SOUTH, EAST, WEST, NORTH_EAST, NORTH_WEST, SOUTH_EAST, SOUTH_WEST];
const sorted = (a: readonly number[]) => [...a].sort((x, y) => x - y);

describe("board helpers", () => {
  it("maps all squares both ways", () => {
    for (let s = 0; s < 64; s++) {
      expect(makeSquare(fileOf(s), rankOf(s))).toBe(s);
      expect(parseSquare(squareName(s))).toBe(s);
      expect(squareName(s)).toBe("abcdefgh"[s % 8] + String(Math.floor(s / 8) + 1));
    }
    expect(squareName(0)).toBe("a1");
    expect(squareName(7)).toBe("h1");
    expect(squareName(56)).toBe("a8");
    expect(squareName(63)).toBe("h8");
  });

  it("parseSquare rejects invalid names", () => {
    for (const bad of ["", "a0", "a9", "i1", "h", "11", "A1", "a11", "e", "z9"]) {
      expect(parseSquare(bad)).toBe(NO_SQUARE);
    }
  });

  it("knight targets at corners and center", () => {
    expect(sorted(knightTargets(0))).toEqual([parseSquare("b3"), parseSquare("c2")].sort((a, b) => a - b));
    expect(knightTargets(parseSquare("d4"))).toHaveLength(8);
    expect(knightTargets(parseSquare("h8"))).toHaveLength(2);
    expect(knightTargets(parseSquare("h1"))).toHaveLength(2);
    expect(knightTargets(parseSquare("a8"))).toHaveLength(2);
    expect(knightTargets(parseSquare("a4"))).toHaveLength(4);
    expect(knightTargets(parseSquare("b1"))).toHaveLength(3);
  });

  it("knight and king moves never wrap and are symmetric", () => {
    for (let s = 0; s < 64; s++) {
      for (const t of knightTargets(s)) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(64);
        const df = Math.abs(fileOf(t) - fileOf(s));
        const dr = Math.abs(rankOf(t) - rankOf(s));
        expect([df, dr].sort()).toEqual([1, 2]);
        expect(knightTargets(t)).toContain(s);
      }
      for (const t of kingTargets(s)) {
        expect(Math.max(Math.abs(fileOf(t) - fileOf(s)), Math.abs(rankOf(t) - rankOf(s)))).toBe(1);
        expect(kingTargets(t)).toContain(s);
      }
    }
  });

  it("king target counts", () => {
    expect(kingTargets(parseSquare("h8"))).toHaveLength(3);
    expect(kingTargets(parseSquare("a1"))).toHaveLength(3);
    expect(kingTargets(parseSquare("a5"))).toHaveLength(5);
    expect(kingTargets(parseSquare("e1"))).toHaveLength(5);
    expect(kingTargets(parseSquare("d4"))).toHaveLength(8);
    expect(new Set(kingTargets(parseSquare("d4"))).size).toBe(8);
  });

  it("rays do not cross the edge", () => {
    expect(ray(parseSquare("h1"), EAST)).toEqual([]);
    expect(ray(parseSquare("h1"), SOUTH)).toEqual([]);
    expect(ray(parseSquare("h1"), NORTH_EAST)).toEqual([]);
    expect(ray(parseSquare("a8"), WEST)).toEqual([]);
    expect(ray(parseSquare("a8"), NORTH)).toEqual([]);
    expect(ray(parseSquare("a1"), SOUTH_WEST)).toEqual([]);
    expect(ray(parseSquare("h1"), WEST)).toHaveLength(7);
    expect(ray(0, NORTH_EAST).map(squareName)).toEqual(["b2", "c3", "d4", "e5", "f6", "g7", "h8"]);
    expect(ray(parseSquare("d4"), WEST).map(squareName)).toEqual(["c4", "b4", "a4"]);
    expect(ray(parseSquare("d4"), SOUTH).map(squareName)).toEqual(["d3", "d2", "d1"]);
    expect(ray(parseSquare("d4"), NORTH_WEST).map(squareName)).toEqual(["c5", "b6", "a7"]);
    expect(ray(parseSquare("d4"), SOUTH_EAST).map(squareName)).toEqual(["e3", "f2", "g1"]);
  });

  it("every ray is a straight line, nearest first, in range", () => {
    const delta: Record<number, [number, number]> = {
      [NORTH]: [0, 1], [SOUTH]: [0, -1], [EAST]: [1, 0], [WEST]: [-1, 0],
      [NORTH_EAST]: [1, 1], [NORTH_WEST]: [-1, 1], [SOUTH_EAST]: [1, -1], [SOUTH_WEST]: [-1, -1],
    };
    for (let s = 0; s < 64; s++) {
      for (const d of ALL_DIRS) {
        const [df, dr] = delta[d];
        const r = ray(s, d);
        r.forEach((t, i) => {
          expect(fileOf(t)).toBe(fileOf(s) + df * (i + 1));
          expect(rankOf(t)).toBe(rankOf(s) + dr * (i + 1));
        });
        const f = fileOf(s) + df * (r.length + 1);
        const rk = rankOf(s) + dr * (r.length + 1);
        expect(f < 0 || f > 7 || rk < 0 || rk > 7).toBe(true);
      }
    }
  });

  it("direction groups", () => {
    expect(sorted(ROOK_DIRECTIONS)).toEqual(sorted([NORTH, SOUTH, EAST, WEST]));
    expect(sorted(BISHOP_DIRECTIONS)).toEqual(sorted([NORTH_EAST, NORTH_WEST, SOUTH_EAST, SOUTH_WEST]));
    expect(QUEEN_DIRECTIONS).toHaveLength(8);
  });
});

describe("createEmptyPosition / clonePosition", () => {
  it("has documented defaults", () => {
    const p = createEmptyPosition();
    expect(p.board).toBeInstanceOf(Int8Array);
    expect(p.board).toHaveLength(64);
    expect(p.board.every((v) => v === 0)).toBe(true);
    expect(p.sideToMove).toBe(WHITE);
    expect(p.castling).toBe(0);
    expect(p.epSquare).toBe(NO_SQUARE);
    expect(p.halfmoveClock).toBe(0);
    expect(p.fullmoveNumber).toBe(1);
    expect(p.whiteKing).toBe(NO_SQUARE);
    expect(p.blackKing).toBe(NO_SQUARE);
    expect(p.history).toEqual([]);
  });

  it("creates independent empty positions", () => {
    const a = createEmptyPosition();
    const b = createEmptyPosition();
    a.board[0] = 4;
    a.history.push({ move: 1, captured: 0, castling: 0, epSquare: -1, halfmoveClock: 0, hashHi: 0, hashLo: 0 });
    expect(b.board[0]).toBe(0);
    expect(b.history).toHaveLength(0);
  });

  it("clone is deep, including history", () => {
    const p = parseFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 3 7");
    const entry = { move: 5, captured: -2, castling: 3, epSquare: 20, halfmoveClock: 4, hashHi: 1, hashLo: 2 };
    p.history.push(entry);
    const c = clonePosition(p);
    expect(c).toEqual(p);
    expect(c.board).not.toBe(p.board);
    expect(c.history).not.toBe(p.history);
    expect(c.history[0]).not.toBe(p.history[0]);
    c.board[0] = 0;
    c.sideToMove = BLACK;
    c.castling = 0;
    c.epSquare = 1;
    c.halfmoveClock = 99;
    c.fullmoveNumber = 99;
    c.whiteKing = 0;
    c.history[0].captured = 9;
    c.history.push(entry);
    expect(p.board[0]).toBe(4);
    expect(p.sideToMove).toBe(WHITE);
    expect(p.castling).toBe(CASTLE_ALL);
    expect(p.epSquare).toBe(NO_SQUARE);
    expect(p.halfmoveClock).toBe(3);
    expect(p.fullmoveNumber).toBe(7);
    expect(p.history).toHaveLength(1);
    expect(p.history[0].captured).toBe(-2);
  });
});

describe("parseFen", () => {
  it("parses the start position", () => {
    const p = parseFen(START_FEN);
    expect(p.board[parseSquare("e1")]).toBe(6);
    expect(p.board[parseSquare("e8")]).toBe(-6);
    expect(p.board[parseSquare("d1")]).toBe(5);
    expect(p.board[parseSquare("a1")]).toBe(4);
    expect(p.board[parseSquare("b8")]).toBe(-2);
    expect(p.board[parseSquare("c1")]).toBe(3);
    expect(p.board[parseSquare("h2")]).toBe(1);
    expect(p.board[parseSquare("h7")]).toBe(-1);
    expect(p.whiteKing).toBe(4);
    expect(p.blackKing).toBe(60);
    expect(p.sideToMove).toBe(WHITE);
    expect(p.castling).toBe(CASTLE_ALL);
    expect(p.epSquare).toBe(NO_SQUARE);
    expect(p.halfmoveClock).toBe(0);
    expect(p.fullmoveNumber).toBe(1);
    expect(p.history).toEqual([]);
  });

  it("round-trips every perft fixture and the start FEN", () => {
    for (const c of [{ name: "start", fen: START_FEN }, ...PERFT_CASES]) {
      expect(toFen(parseFen(c.fen)), c.name).toBe(c.fen);
    }
  });

  it("round-trips castling subsets, en passant, large counters, bare kings", () => {
    const fens = [
      "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      "4k3/8/8/8/8/8/8/4K3 b - - 0 1",
      "r3k2r/8/8/8/8/8/8/R3K2R w Kq - 12 40",
      "r3k2r/8/8/8/8/8/8/R3K2R b Qk - 0 1",
      "r3k2r/8/8/8/8/8/8/R3K2R w K - 0 1",
      "r3k2r/8/8/8/8/8/8/R3K2R w q - 0 1",
      "4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1",
      "4k3/8/8/4p3/8/8/8/4K3 w - e6 0 2",
      "4k3/8/8/8/8/8/8/4K3 w - - 99 1000",
      "4k3/8/8/8/8/8/8/4K3 w - - 100 123456",
      "k7/8/8/8/8/8/8/7K w - - 0 1",
      "7k/8/8/8/8/8/8/K7 b - - 0 1",
    ];
    for (const f of fens) expect(toFen(parseFen(f)), f).toBe(f);
  });

  it("decodes castling flags and counters", () => {
    expect(parseFen("r3k2r/8/8/8/8/8/8/R3K2R w Kq - 0 1").castling).toBe(CASTLE_WHITE_KING | CASTLE_BLACK_QUEEN);
    expect(parseFen("r3k2r/8/8/8/8/8/8/R3K2R w Qk - 0 1").castling).toBe(CASTLE_WHITE_QUEEN | CASTLE_BLACK_KING);
    expect(parseFen("r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1").castling).toBe(0);
    expect(parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1").castling).toBe(CASTLE_ALL);
    const p = parseFen("4k3/8/8/8/8/8/8/4K3 b - - 57 321");
    expect(p.sideToMove).toBe(BLACK);
    expect(p.halfmoveClock).toBe(57);
    expect(p.fullmoveNumber).toBe(321);
  });

  it("decodes en passant squares", () => {
    expect(parseFen("4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1").epSquare).toBe(parseSquare("e3"));
    expect(parseFen("4k3/8/8/4p3/8/8/8/4K3 w - e6 0 1").epSquare).toBe(parseSquare("e6"));
  });

  it("places kings in the corners", () => {
    const p = parseFen("K6k/8/8/8/8/8/8/8 w - - 0 1");
    expect(p.whiteKing).toBe(56);
    expect(p.blackKing).toBe(63);
    const q = parseFen("8/8/8/8/8/8/8/k6K w - - 0 1");
    expect(q.whiteKing).toBe(7);
    expect(q.blackKing).toBe(0);
  });

  it("handles files a/h on rank edges", () => {
    const p = parseFen("r6r/8/8/8/8/8/8/R3K2k w - - 0 1");
    expect(p.board[56]).toBe(-4);
    expect(p.board[63]).toBe(-4);
    expect(p.board[0]).toBe(4);
    expect(p.board[7]).toBe(-6);
  });

  const valid = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
  const invalid: Array<[string, string]> = [
    ["empty string", ""],
    ["only placement", "4k3/8/8/8/8/8/8/4K3"],
    ["missing counters", "4k3/8/8/8/8/8/8/4K3 w - -"],
    ["missing fullmove", "4k3/8/8/8/8/8/8/4K3 w - - 0"],
    ["rank with 7 squares", "4k3/8/8/8/8/8/8/4K2 w - - 0 1"],
    ["rank with 9 squares", "4k3/8/8/8/8/8/8/4K4 w - - 0 1"],
    ["rank with 9 squares via pieces", "4k3/8/8/8/8/8/8/PPPPPPPPP w - - 0 1"],
    ["7 ranks", "4k3/8/8/8/8/8/4K3 w - - 0 1"],
    ["9 ranks", "4k3/8/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["unknown piece", "4k3/8/8/8/8/8/8/4K2X w - - 0 1"],
    ["digit 9", "4k3/9/8/8/8/8/8/4K3 w - - 0 1"],
    ["digit 0", "4k3/8/8/8/8/8/8/04K3 w - - 0 1"],
    ["two white kings", "4k3/8/8/8/8/8/8/K3K3 w - - 0 1"],
    ["two black kings", "k3k3/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["no black king", "8/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["no white king", "4k3/8/8/8/8/8/8/8 w - - 0 1"],
    ["no kings", "8/8/8/8/8/8/8/8 w - - 0 1"],
    ["bad side", "4k3/8/8/8/8/8/8/4K3 x - - 0 1"],
    ["uppercase side", "4k3/8/8/8/8/8/8/4K3 W - - 0 1"],
    ["bad castling char", "4k3/8/8/8/8/8/8/4K3 w X - 0 1"],
    ["ep on e4", "4k3/8/8/8/8/8/8/4K3 w - e4 0 1"],
    ["ep on rank 1", "4k3/8/8/8/8/8/8/4K3 w - e1 0 1"],
    ["ep on rank 8", "4k3/8/8/8/8/8/8/4K3 w - e8 0 1"],
    ["ep off board", "4k3/8/8/8/8/8/8/4K3 w - i3 0 1"],
    ["ep garbage", "4k3/8/8/8/8/8/8/4K3 w - zz 0 1"],
    ["negative halfmove", "4k3/8/8/8/8/8/8/4K3 w - - -1 1"],
    ["negative fullmove", "4k3/8/8/8/8/8/8/4K3 w - - 0 -1"],
    ["non numeric halfmove", "4k3/8/8/8/8/8/8/4K3 w - - a 1"],
    ["non numeric fullmove", "4k3/8/8/8/8/8/8/4K3 w - - 0 b"],
    ["fractional counter", "4k3/8/8/8/8/8/8/4K3 w - - 1.5 1"],
  ];
  it("accepts the baseline FEN", () => {
    expect(() => parseFen(valid)).not.toThrow();
  });
  for (const [name, fen] of invalid) {
    it(`rejects: ${name}`, () => {
      expect(() => parseFen(fen)).toThrow(Error);
    });
  }

  it("error messages identify the field", () => {
    const msg = (f: string) => {
      try {
        parseFen(f);
      } catch (e) {
        return (e as Error).message.toLowerCase();
      }
      return "";
    };
    expect(msg("4k3/8/8/8/8/8/8/4K3 w - e4 0 1")).toMatch(/en passant|ep/);
    expect(msg("4k3/8/8/8/8/8/8/4K3 x - - 0 1")).toMatch(/side|turn|color|active/);
    expect(msg("4k3/8/8/8/8/8/8/4K3 w X - 0 1")).toMatch(/castl/);
    expect(msg("4k3/8/8/8/8/8/8/4K3 w - - -1 1")).toMatch(/half/);
    expect(msg("4k3/8/8/8/8/8/8/4K3 w - - 0 -1")).toMatch(/full/);
    expect(msg("4k3/8/8/8/8/8/8/K3K3 w - - 0 1")).toMatch(/king/);
    expect(msg("4k3/8/8/8/8/8/8/4K2X w - - 0 1")).toMatch(/piece|placement|character|board/);
  });

  it("returns independent positions on repeated parse", () => {
    const a = parseFen(START_FEN);
    const b = parseFen(START_FEN);
    a.board[0] = 0;
    expect(b.board[0]).toBe(4);
  });

  it("toFen reflects mutations of the position", () => {
    const p = parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    p.sideToMove = BLACK;
    p.halfmoveClock = 5;
    p.fullmoveNumber = 9;
    expect(toFen(p)).toBe("4k3/8/8/8/8/8/8/4K3 b - - 5 9");
    p.board[parseSquare("a1")] = 4;
    p.castling = CASTLE_WHITE_QUEEN;
    expect(toFen(p)).toBe("4k3/8/8/8/8/8/8/R3K3 b Q - 5 9");
  });
});
