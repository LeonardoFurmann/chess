import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PERFT_CASES } from "../../../test/fixtures/perft";
import { parseSquare } from "./board";
import { START_FEN, parseFen, toFen } from "./fen";
import { computeHash } from "./zobrist";
import {
  BLACK,
  CASTLE_BLACK_QUEEN,
  CASTLE_WHITE_KING,
  KING,
  NO_SQUARE,
  WHITE,
} from "./types";

describe("parseFen / toFen round trip", () => {
  it("reproduces START_FEN", () => {
    expect(toFen(parseFen(START_FEN))).toBe(START_FEN);
  });

  for (const c of PERFT_CASES) {
    it(`reproduces perft fixture "${c.name}"`, () => {
      expect(toFen(parseFen(c.fen))).toBe(c.fen);
    });
  }

  it("round-trips en passant, partial castling and large counters", () => {
    for (const fen of [
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      "4k3/8/8/8/8/8/8/R3K2R w Kq - 99 250",
      "4k3/8/8/3pP3/8/8/8/4K3 w - d6 12345 6789",
      "4k3/8/8/8/8/8/8/4K3 b - - 0 1",
    ]) {
      expect(toFen(parseFen(fen))).toBe(fen);
    }
  });
});

describe("parseFen fields", () => {
  it("fills the position", () => {
    const p = parseFen("4k3/8/8/3pP3/8/8/8/R3K2R b Kq d6 7 42");
    expect(p.sideToMove).toBe(BLACK);
    expect(p.castling).toBe(CASTLE_WHITE_KING | CASTLE_BLACK_QUEEN);
    expect(p.epSquare).toBe(parseSquare("d6"));
    expect(p.halfmoveClock).toBe(7);
    expect(p.fullmoveNumber).toBe(42);
    expect(p.whiteKing).toBe(parseSquare("e1"));
    expect(p.blackKing).toBe(parseSquare("e8"));
    expect(p.board[parseSquare("e1")]).toBe(KING * WHITE);
    expect(p.board[parseSquare("e8")]).toBe(KING * BLACK);
    expect(p.board[parseSquare("d5")]).toBe(-1);
    expect(p.board[parseSquare("e5")]).toBe(1);
    expect({ hi: p.hashHi, lo: p.hashLo }).toEqual(computeHash(p));
    expect(p.history).toEqual([]);
  });

  it("sets NO_SQUARE for '-' en passant and zero castling", () => {
    const p = parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(p.epSquare).toBe(NO_SQUARE);
    expect(p.castling).toBe(0);
  });

  it("tolerates extra whitespace", () => {
    expect(toFen(parseFen(`  ${START_FEN.replace(/ /g, "   ")}  `))).toBe(START_FEN);
  });

  it("accepts kings-only positions", () => {
    const p = parseFen("k7/8/8/8/8/8/8/7K w - - 0 1");
    expect(p.whiteKing).toBe(7);
    expect(p.blackKing).toBe(56);
  });
});

describe("parseFen errors", () => {
  const valid = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

  it("rejects missing fields", () => {
    expect(() => parseFen("")).toThrow(/6 fields/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w - -")).toThrow(/6 fields/);
    expect(() => parseFen(`${valid} extra`)).toThrow(/6 fields/);
  });

  it("rejects wrong rank count", () => {
    expect(() => parseFen("4k3/8/8/8/8/8/4K3 w - - 0 1")).toThrow(/ranks/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/8/4K3 w - - 0 1")).toThrow(/ranks/);
  });

  it("rejects ranks with 7 or 9 squares", () => {
    expect(() => parseFen("4k2/8/8/8/8/8/8/4K3 w - - 0 1")).toThrow(/rank 8/);
    expect(() => parseFen("4k4/8/8/8/8/8/8/4K3 w - - 0 1")).toThrow(/rank 8/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K2PP w - - 0 1")).toThrow(/rank 1/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/3pK4 w - - 0 1")).toThrow(/rank 1/);
  });

  it("rejects unknown pieces and zero digits", () => {
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K2X w - - 0 1")).toThrow(/unknown piece/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K03 w - - 0 1")).toThrow(/unknown piece/);
  });

  it("rejects wrong king counts", () => {
    expect(() => parseFen("4k3/8/8/8/8/8/8/3KK3 w - - 0 1")).toThrow(/white king/);
    expect(() => parseFen("8/8/8/8/8/8/8/4K3 w - - 0 1")).toThrow(/black king/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/8 w - - 0 1")).toThrow(/white king/);
    expect(() => parseFen("3kk3/8/8/8/8/8/8/4K3 w - - 0 1")).toThrow(/black king/);
  });

  it("rejects bad side to move", () => {
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 x - - 0 1")).toThrow(/side to move/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 W - - 0 1")).toThrow(/side to move/);
  });

  it("rejects bad castling", () => {
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w X - 0 1")).toThrow(/castling/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w KK - 0 1")).toThrow(/castling/);
  });

  it("rejects bad en passant squares", () => {
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w - e4 0 1")).toThrow(/en passant/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w - e9 0 1")).toThrow(/en passant/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w - z3 0 1")).toThrow(/en passant/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w - e 0 1")).toThrow(/en passant/);
  });

  it("rejects bad counters", () => {
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w - - -1 1")).toThrow(/halfmove/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w - - x 1")).toThrow(/halfmove/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 -1")).toThrow(/fullmove/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 0")).toThrow(/fullmove/);
    expect(() => parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1.5")).toThrow(/fullmove/);
  });
});
