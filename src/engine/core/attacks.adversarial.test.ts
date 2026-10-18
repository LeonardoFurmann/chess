import { Chess } from "chess.js";
import type { Color as ChessColor, Square as ChessSquare } from "chess.js";
import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { randomPositions } from "../../../test/fixtures/random-positions";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PERFT_CASES } from "../../../test/fixtures/perft";
import { isSquareAttacked } from "./attacks";
import { parseSquare, squareName } from "./board";
import { parseFen } from "./fen";
import type { Position } from "./position";
import { BISHOP, BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "./types";
import type { Color } from "./types";

const at = (fen: string, sq: string, by: Color) => isSquareAttacked(parseFen(fen), parseSquare(sq), by);

function naive(pos: Position, target: number, by: Color): boolean {
  const tf = target % 8;
  const tr = Math.floor(target / 8);
  const pieceAt = (f: number, r: number) => (f < 0 || f > 7 || r < 0 || r > 7 ? 0 : pos.board[r * 8 + f]);
  const is = (f: number, r: number, kind: number) => pieceAt(f, r) === kind * by;
  // a white pawn attacking the target sits one rank below it
  if (is(tf - 1, tr - by, PAWN) || is(tf + 1, tr - by, PAWN)) return true;
  for (const [df, dr] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
    if (is(tf + df, tr + dr, KNIGHT)) return true;
  }
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if ((df || dr) && is(tf + df, tr + dr, KING)) return true;
    }
  }
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const diag = df !== 0 && dr !== 0;
      let f = tf + df;
      let r = tr + dr;
      while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
        const p = pos.board[r * 8 + f];
        if (p !== 0) {
          if (p === QUEEN * by || p === (diag ? BISHOP : ROOK) * by) return true;
          break;
        }
        f += df;
        r += dr;
      }
    }
  }
  return false;
}

describe("isSquareAttacked adversarial: acceptance criteria", () => {
  it("white pawn e4 attacks d5/f5 but not e5, e3, d3, f3", () => {
    const fen = "4k3/8/8/8/4P3/8/8/4K3 w - - 0 1";
    expect(at(fen, "d5", WHITE)).toBe(true);
    expect(at(fen, "f5", WHITE)).toBe(true);
    for (const s of ["e5", "e3", "d3", "f3", "e4"]) expect(at(fen, s, WHITE)).toBe(false);
  });

  it("black pawn e5 attacks d4/f4 but not e4, d6, f6", () => {
    const fen = "4k3/8/8/4p3/8/8/8/4K3 w - - 0 1";
    expect(at(fen, "d4", BLACK)).toBe(true);
    expect(at(fen, "f4", BLACK)).toBe(true);
    for (const s of ["e4", "d6", "f6"]) expect(at(fen, s, BLACK)).toBe(false);
    expect(at(fen, "d4", WHITE)).toBe(false);
  });

  it("pawns on a/h files do not wrap around the board", () => {
    const w = "4k3/8/8/8/P6P/8/8/4K3 w - - 0 1";
    expect(at(w, "b5", WHITE)).toBe(true);
    expect(at(w, "g5", WHITE)).toBe(true);
    for (const s of ["h5", "a5", "h3", "g3", "a3", "b3"]) expect(at(w, s, WHITE)).toBe(false);
    const b = "4k3/8/8/p6p/8/8/8/4K3 w - - 0 1";
    expect(at(b, "b4", BLACK)).toBe(true);
    expect(at(b, "g4", BLACK)).toBe(true);
    for (const s of ["h4", "a4", "h6", "a6"]) expect(at(b, s, BLACK)).toBe(false);
  });

  it("rook blocked by any colour attacks the blocker but not beyond", () => {
    for (const blocker of ["P", "p"]) {
      const fen = `4k3/8/8/8/R2${blocker}4/8/8/4K3 w - - 0 1`;
      expect(at(fen, "d4", WHITE)).toBe(true);
      expect(at(fen, "c4", WHITE)).toBe(true);
      expect(at(fen, "e4", WHITE)).toBe(false);
      expect(at(fen, "h4", WHITE)).toBe(false);
    }
  });

  it("king attacks all 8 neighbours and nothing farther", () => {
    const fen = "7k/8/8/8/3K4/8/8/8 w - - 0 1";
    const near = new Set(["c3", "d3", "e3", "c4", "e4", "c5", "d5", "e5"]);
    for (let s = 0; s < 64; s++) {
      expect(isSquareAttacked(parseFen(fen), s, WHITE)).toBe(near.has(squareName(s)));
    }
  });

  it("knight attacks over surrounding pieces", () => {
    const fen = "7k/8/8/2PPP3/2PNP3/2PPP3/8/K7 w - - 0 1";
    for (const s of ["b3", "b5", "c2", "e2", "f3", "f5"]) expect(at(fen, s, WHITE)).toBe(true);
    expect(at(fen, "a4", WHITE)).toBe(false);
  });
});

describe("isSquareAttacked adversarial: edges", () => {
  it("bishop on h3 does not wrap to a3/a4", () => {
    const fen = "7k/8/8/8/8/7B/8/K7 w - - 0 1";
    expect(at(fen, "g4", WHITE)).toBe(true);
    expect(at(fen, "e6", WHITE)).toBe(true);
    expect(at(fen, "g2", WHITE)).toBe(true);
    for (const s of ["a3", "a4", "h4", "h2", "b3"]) expect(at(fen, s, WHITE)).toBe(false);
  });

  it("rooks in corners do not wrap along ranks", () => {
    const fen = "R6k/8/8/8/8/8/8/K6R w - - 0 1";
    expect(at(fen, "h8", WHITE)).toBe(true);
    expect(at(fen, "b8", WHITE)).toBe(true);
    expect(at(fen, "a2", WHITE)).toBe(true);
    expect(at(fen, "h2", WHITE)).toBe(true);
    expect(at(fen, "c3", WHITE)).toBe(false);
    expect(at(fen, "g2", WHITE)).toBe(false);
  });

  it("queen in corner covers rank, file and diagonal only", () => {
    const fen = "k7/8/8/8/8/8/8/Q6K w - - 0 1";
    expect(at(fen, "h8", WHITE)).toBe(true);
    expect(at(fen, "a7", WHITE)).toBe(true);
    expect(at(fen, "g1", WHITE)).toBe(true);
    expect(at(fen, "b3", WHITE)).toBe(false);
  });

  it("knights in corners do not wrap", () => {
    const fen = "7k/8/8/8/8/8/8/N6K w - - 0 1";
    expect(at(fen, "b3", WHITE)).toBe(true);
    expect(at(fen, "c2", WHITE)).toBe(true);
    for (const s of ["g3", "h3", "a3", "d3"]) expect(at(fen, s, WHITE)).toBe(false);
    const fen2 = "7k/8/8/8/8/8/8/K6N w - - 0 1";
    expect(at(fen2, "f2", WHITE)).toBe(true);
    expect(at(fen2, "g3", WHITE)).toBe(true);
    for (const s of ["a3", "c3", "h3"]) expect(at(fen2, s, WHITE)).toBe(false);
  });

  it("king on the a-file does not wrap to the h-file", () => {
    const fen = "7k/8/8/8/K7/8/8/8 w - - 0 1";
    expect(at(fen, "h4", WHITE)).toBe(false);
    expect(at(fen, "h5", WHITE)).toBe(false);
    expect(at(fen, "h3", WHITE)).toBe(false);
    expect(at(fen, "b3", WHITE)).toBe(true);
  });

  it("square occupied by a piece of the attacker's colour is still attacked", () => {
    const fen = "4k3/8/8/8/8/8/PP6/RN2K3 w - - 0 1";
    expect(at(fen, "b1", WHITE)).toBe(true);
    expect(at(fen, "a2", WHITE)).toBe(true);
    expect(at(fen, "d1", WHITE)).toBe(true);
    expect(at(fen, "b2", WHITE)).toBe(false);
  });

  it("a piece does not attack the square it stands on", () => {
    expect(at("4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1", "d4", WHITE)).toBe(false);
  });

  it("sliders are blocked by their own pieces too", () => {
    expect(at("4k3/8/8/8/8/8/8/B1P1K3 w - - 0 1", "e1", BLACK)).toBe(false);
    const fen2 = "7k/8/8/8/8/2N5/8/B3K3 w - - 0 1";
    expect(at(fen2, "c3", WHITE)).toBe(true);
    expect(at(fen2, "e5", WHITE)).toBe(false);
  });

  it("colour is respected", () => {
    const fen = "4k3/8/8/8/8/8/8/R3K3 w - - 0 1";
    expect(at(fen, "a8", WHITE)).toBe(true);
    expect(at(fen, "a8", BLACK)).toBe(false);
    expect(at(fen, "d8", BLACK)).toBe(true);
    expect(at(fen, "d8", WHITE)).toBe(false);
  });

  it("empty board (kings only) attacks nothing far from the kings", () => {
    const pos = parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(isSquareAttacked(pos, parseSquare("a4"), WHITE)).toBe(false);
    expect(isSquareAttacked(pos, parseSquare("h5"), BLACK)).toBe(false);
    expect(isSquareAttacked(pos, parseSquare("d1"), WHITE)).toBe(true);
    expect(isSquareAttacked(pos, parseSquare("d8"), BLACK)).toBe(true);
  });

  it("en passant does not make the captured pawn's square attacked", () => {
    const ep = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1";
    expect(at(ep, "d5", WHITE)).toBe(false);
    expect(at(ep, "e4", BLACK)).toBe(true);
    expect(at(ep, "d6", BLACK)).toBe(false);
  });

  it("does not mutate the position", () => {
    const pos = parseFen(PERFT_CASES[1].fen);
    const before = Array.from(pos.board);
    for (let s = 0; s < 64; s++) {
      isSquareAttacked(pos, s, WHITE);
      isSquareAttacked(pos, s, BLACK);
    }
    expect(Array.from(pos.board)).toEqual(before);
  });
});

describe("isSquareAttacked adversarial: exhaustive vs naive reference and chess.js", () => {
  const fens = [
    ...PERFT_CASES.map((c) => c.fen),
    ...randomPositions({ count: 120, seed: 77 }).map((p) => p.fen),
  ];

  it("has at least 50 positions", () => {
    expect(fens.length).toBeGreaterThanOrEqual(50);
  });

  it("matches the naive reference for every square and colour", () => {
    for (const fen of fens) {
      const pos = parseFen(fen);
      for (const color of [WHITE, BLACK] as const) {
        for (let s = 0; s < 64; s++) {
          if (isSquareAttacked(pos, s, color) !== naive(pos, s, color)) {
            throw new Error(`mismatch ${fen} sq=${squareName(s)} color=${color}`);
          }
        }
      }
    }
  });

  it("matches chess.js isAttacked", () => {
    for (const fen of fens) {
      const pos = parseFen(fen);
      const chess = new Chess(fen);
      for (const color of [WHITE, BLACK] as const) {
        const cc: ChessColor = color === WHITE ? "w" : "b";
        for (let s = 0; s < 64; s++) {
          const expected = chess.isAttacked(squareName(s) as ChessSquare, cc);
          if (isSquareAttacked(pos, s, color) !== expected) {
            throw new Error(`chess.js mismatch ${fen} sq=${squareName(s)} color=${cc}`);
          }
        }
      }
    }
  });
});
