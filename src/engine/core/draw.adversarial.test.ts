import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PERFT_CASES } from "../../../test/fixtures/perft";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { randomPositions } from "../../../test/fixtures/random-positions";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { MATE_IN_1, MATE_IN_2 } from "../../../test/fixtures/mates";
import { isFiftyMoveDraw, isInsufficientMaterial } from "./draw";
import { START_FEN, parseFen } from "./fen";

const insufficient = (fen: string) => isInsufficientMaterial(parseFen(fen));

function boardToFen(board: string[]): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let out = "";
    let k = 0;
    for (let f = 0; f < 8; f++) {
      const c = board[r * 8 + f];
      if (!c) k++;
      else {
        if (k) out += k;
        k = 0;
        out += c;
      }
    }
    if (k) out += k;
    rows.push(out);
  }
  return `${rows.join("/")} w - - 0 1`;
}

describe("isInsufficientMaterial: true cases (SPEC 4.4)", () => {
  const cases: [string, string][] = [
    ["K v K corners", "K7/8/8/8/8/8/8/7k w - - 0 1"],
    ["K v K black to move", "K7/8/8/8/8/8/8/7k b - - 0 1"],
    ["KN v K white knight", "8/8/8/4k3/8/8/8/K1N5 w - - 0 1"],
    ["KN v K black knight", "8/8/8/4k3/8/8/n7/K7 w - - 0 1"],
    ["KN v K knight on other colour", "8/8/8/4k3/8/8/8/K5N1 w - - 0 1"],
    ["KB v K", "8/8/8/4k3/8/8/8/K1B5 w - - 0 1"],
    ["KB v K black bishop", "8/8/8/4k3/8/8/8/K1b5 w - - 0 1"],
    ["KB v KB same colour (c1,f4)", "8/8/8/4k3/5b2/8/8/K1B5 w - - 0 1"],
    ["KB v KB same colour (c1,a3)", "8/8/8/4k3/8/b7/8/K1B5 w - - 0 1"],
    ["KBB v K same colour (c1,f4)", "8/8/8/4k3/5B2/8/8/K1B5 w - - 0 1"],
    ["KB v KBB same colour", "8/8/8/4k3/5b2/8/8/K1B1b3 w - - 0 1"],
    ["KBBB v K all dark (promoted)", "8/8/8/4k3/8/8/1B1B4/K1B5 w - - 0 1"],
    ["KBBBB v K all light (promoted)", "8/8/8/4k3/8/8/8/K1B1B1B1 w - - 0 1"],
  ];
  it.each(cases)("%s", (_name, fen) => {
    expect(insufficient(fen)).toBe(true);
  });
});

describe("isInsufficientMaterial: false cases", () => {
  const cases: [string, string][] = [
    ["start position", START_FEN],
    ["white pawn", "8/8/8/4k3/8/8/4P3/K7 w - - 0 1"],
    ["black pawn", "8/8/8/4k3/8/8/4p3/K7 w - - 0 1"],
    ["pawn plus bishop", "8/8/8/4k3/8/8/4P3/K1B5 w - - 0 1"],
    ["rook", "8/8/8/4k3/8/8/8/K6R w - - 0 1"],
    ["black rook", "8/8/8/4k3/8/8/8/K6r w - - 0 1"],
    ["queen", "8/8/8/4k3/8/8/8/K6Q w - - 0 1"],
    ["black queen", "8/8/8/4k3/8/8/8/K6q w - - 0 1"],
    ["KNN v K", "8/8/8/4k3/8/8/8/KNN5 w - - 0 1"],
    ["KN v KN", "8/8/8/4k3/8/8/n7/KN6 w - - 0 1"],
    ["KNN v K black knights", "8/8/8/4k3/8/8/nn6/K7 w - - 0 1"],
    ["KB v KB opposite colours", "8/8/8/4k3/5b2/8/8/K2B4 w - - 0 1"],
    ["KB v KB opposite colours a2 v c1", "8/8/8/4k3/8/8/b7/K1B5 w - - 0 1"],
    ["KB v KN", "8/8/8/4k3/8/8/n7/K1B5 w - - 0 1"],
    ["KN v KB", "8/8/8/4k3/8/8/b7/K1N5 w - - 0 1"],
    ["KBN v K", "8/8/8/4k3/8/8/8/K1BN4 w - - 0 1"],
    ["KBB v K opposite colours", "8/8/8/4k3/8/8/8/KBB5 w - - 0 1"],
    ["KBB v K mixed (c1,d1)", "8/8/8/4k3/8/8/8/K1BB4 w - - 0 1"],
    ["white bishops mixed v black bishop", "8/8/8/4kb2/8/8/8/K1BB4 w - - 0 1"],
    ["KBB v KB: white same colour, black opposite", "8/8/8/4k3/5B2/8/8/K1B2b2 w - - 0 1"],
    ["same-colour bishops plus a knight", "8/8/8/4k3/5B2/8/8/K1B1N3 w - - 0 1"],
  ];
  it.each(cases)("%s", (_name, fen) => {
    expect(insufficient(fen)).toBe(false);
  });
});

describe("isInsufficientMaterial: bishop colour by square", () => {
  it("matches chess.js for every pair of bishop squares", () => {
    let checked = 0;
    for (let a = 1; a < 63; a++) {
      for (let b = a + 1; b < 63; b++) {
        for (const [pa, pb] of [
          ["B", "B"],
          ["B", "b"],
        ]) {
          const board = Array<string>(64).fill("");
          board[0] = "K";
          board[63] = "k";
          board[a] = pa;
          board[b] = pb;
          const fen = boardToFen(board);
          let oracle: boolean;
          try {
            oracle = new Chess(fen).isInsufficientMaterial();
          } catch {
            continue;
          }
          expect(insufficient(fen), fen).toBe(oracle);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe("isInsufficientMaterial: agrees with chess.js on fixtures", () => {
  it("perft positions", () => {
    for (const c of PERFT_CASES) {
      expect(insufficient(c.fen), c.fen).toBe(new Chess(c.fen).isInsufficientMaterial());
    }
  });
  it("mate puzzles", () => {
    for (const p of [...MATE_IN_1, ...MATE_IN_2]) {
      expect(insufficient(p.fen), p.fen).toBe(new Chess(p.fen).isInsufficientMaterial());
    }
  });
  it("random positions", () => {
    for (const p of randomPositions({ count: 150 })) {
      expect(insufficient(p.fen), p.fen).toBe(new Chess(p.fen).isInsufficientMaterial());
    }
  });
  it("seeded random sparse endgames", () => {
    let seed = 12345;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const pieces = ["B", "b", "B", "b", "N", "n", "R", "r", "Q", "q", "P", "p"];
    let checked = 0;
    let trues = 0;
    for (let i = 0; i < 3000; i++) {
      const board = Array<string>(64).fill("");
      const free = () => {
        for (;;) {
          const s = Math.floor(rnd() * 64);
          if (!board[s]) return s;
        }
      };
      const wk = free();
      board[wk] = "K";
      let bk = free();
      while (
        Math.abs((bk % 8) - (wk % 8)) <= 1 &&
        Math.abs(Math.floor(bk / 8) - Math.floor(wk / 8)) <= 1
      )
        bk = free();
      board[bk] = "k";
      const n = Math.floor(rnd() * 5);
      for (let j = 0; j < n; j++) {
        const pool = rnd() < 0.85 ? pieces.slice(0, 6) : pieces;
        let p = pool[Math.floor(rnd() * pool.length)];
        const s = free();
        if ((p === "P" || p === "p") && (s < 8 || s >= 56)) p = "B";
        board[s] = p;
      }
      const fen = boardToFen(board);
      let oracle: boolean;
      try {
        oracle = new Chess(fen).isInsufficientMaterial();
      } catch {
        continue;
      }
      expect(insufficient(fen), fen).toBe(oracle);
      checked++;
      if (oracle) trues++;
    }
    expect(checked).toBeGreaterThan(1000);
    expect(trues).toBeGreaterThan(50);
  });
});

describe("isInsufficientMaterial: does not depend on other state", () => {
  it("ignores side to move and clock, and does not mutate the position", () => {
    const pos = parseFen("8/8/8/4k3/8/8/8/K1B5 b - - 99 70");
    const before = Array.from(pos.board);
    expect(isInsufficientMaterial(pos)).toBe(true);
    expect(Array.from(pos.board)).toEqual(before);
    expect(pos.halfmoveClock).toBe(99);
  });
});

describe("isFiftyMoveDraw", () => {
  const withClock = (n: number) => {
    const pos = parseFen(START_FEN);
    pos.halfmoveClock = n;
    return pos;
  };
  it("is false below 100", () => {
    for (const n of [0, 1, 98, 99]) expect(isFiftyMoveDraw(withClock(n))).toBe(false);
  });
  it("is true at 100 and above", () => {
    for (const n of [100, 101, 120, 1000]) expect(isFiftyMoveDraw(withClock(n))).toBe(true);
  });
  it("reads the clock parsed from FEN, for either side to move", () => {
    expect(isFiftyMoveDraw(parseFen("4k3/8/8/8/8/8/8/4K2R w - - 99 80"))).toBe(false);
    expect(isFiftyMoveDraw(parseFen("4k3/8/8/8/8/8/8/4K2R w - - 100 80"))).toBe(true);
    expect(isFiftyMoveDraw(parseFen("4k3/8/8/8/8/8/8/4K2R b - - 100 80"))).toBe(true);
    expect(isFiftyMoveDraw(parseFen("4k3/8/8/8/8/8/8/4K2R b - - 120 80"))).toBe(true);
  });
  it("is independent of material", () => {
    expect(isFiftyMoveDraw(parseFen("K7/8/8/8/8/8/8/7k w - - 100 90"))).toBe(true);
    expect(isFiftyMoveDraw(parseFen("K7/8/8/8/8/8/8/7k w - - 99 90"))).toBe(false);
  });
});
