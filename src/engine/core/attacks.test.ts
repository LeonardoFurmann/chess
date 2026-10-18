import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PERFT_CASES } from "../../../test/fixtures/perft";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { randomPositions } from "../../../test/fixtures/random-positions";
import { isSquareAttacked } from "./attacks";
import { fileOf, makeSquare, parseSquare, rankOf, squareName } from "./board";
import { parseFen } from "./fen";
import type { Position } from "./position";
import { BLACK, WHITE } from "./types";
import type { Color } from "./types";

function attacked(fen: string, square: string, by: Color): boolean {
  return isSquareAttacked(parseFen(fen), parseSquare(square), by);
}

function clear(position: Position, from: number, df: number, dr: number): boolean {
  const sf = Math.sign(df);
  const sr = Math.sign(dr);
  const steps = Math.max(Math.abs(df), Math.abs(dr));
  for (let i = 1; i < steps; i++) {
    if (position.board[makeSquare(fileOf(from) + sf * i, rankOf(from) + sr * i)] !== 0) return false;
  }
  return true;
}

/** Naive reference: checks every piece against its geometric rule using coordinates. */
function referenceAttacked(position: Position, target: number, by: Color): boolean {
  for (let sq = 0; sq < 64; sq++) {
    const piece = position.board[sq];
    if (piece === 0 || Math.sign(piece) !== by) continue;
    const df = fileOf(target) - fileOf(sq);
    const dr = rankOf(target) - rankOf(sq);
    if (df === 0 && dr === 0) continue;
    const kind = Math.abs(piece);
    const adf = Math.abs(df);
    const adr = Math.abs(dr);
    if (kind === 1 && adf === 1 && dr === by) return true;
    if (kind === 2 && adf * adr === 2) return true;
    if (kind === 6 && adf <= 1 && adr <= 1) return true;
    const straight = df === 0 || dr === 0;
    const diagonal = adf === adr;
    if ((kind === 4 || kind === 5) && straight && clear(position, sq, df, dr)) return true;
    if ((kind === 3 || kind === 5) && diagonal && clear(position, sq, df, dr)) return true;
  }
  return false;
}

describe("pawns", () => {
  it("white pawn on e4 attacks d5 and f5 but not e5", () => {
    const fen = "4k3/8/8/8/4P3/8/8/4K3 w - - 0 1";
    expect(attacked(fen, "d5", WHITE)).toBe(true);
    expect(attacked(fen, "f5", WHITE)).toBe(true);
    expect(attacked(fen, "e5", WHITE)).toBe(false);
    expect(attacked(fen, "d3", WHITE)).toBe(false);
    expect(attacked(fen, "f3", WHITE)).toBe(false);
  });

  it("black pawn on e5 attacks d4 and f4 but not e4", () => {
    const fen = "4k3/8/8/4p3/8/8/8/4K3 w - - 0 1";
    expect(attacked(fen, "d4", BLACK)).toBe(true);
    expect(attacked(fen, "f4", BLACK)).toBe(true);
    expect(attacked(fen, "e4", BLACK)).toBe(false);
    expect(attacked(fen, "d6", BLACK)).toBe(false);
  });

  it("edge pawns do not wrap around the board", () => {
    const fen = "4k3/8/8/8/P6P/8/8/4K3 w - - 0 1";
    expect(attacked(fen, "b5", WHITE)).toBe(true);
    expect(attacked(fen, "g5", WHITE)).toBe(true);
    expect(attacked(fen, "h5", WHITE)).toBe(false);
    expect(attacked(fen, "a5", WHITE)).toBe(false);
    expect(attacked(fen, "h3", WHITE)).toBe(false);
    expect(attacked(fen, "a3", WHITE)).toBe(false);
  });

  it("does not treat the en passant target as attacked by the capturing rule", () => {
    const fen = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1";
    expect(attacked(fen, "d6", BLACK)).toBe(false);
    expect(attacked(fen, "e4", BLACK)).toBe(true);
  });
});

describe("sliders", () => {
  it("rook blocked by a piece of any color attacks the blocker but not beyond", () => {
    for (const blocker of ["P", "p"]) {
      const fen = `4k3/8/8/8/R2${blocker}4/8/8/4K3 w - - 0 1`;
      expect(attacked(fen, "b4", WHITE)).toBe(true);
      expect(attacked(fen, "c4", WHITE)).toBe(true);
      expect(attacked(fen, "d4", WHITE)).toBe(true);
      expect(attacked(fen, "e4", WHITE)).toBe(false);
      expect(attacked(fen, "h4", WHITE)).toBe(false);
    }
  });

  it("rook on the edge does not wrap around", () => {
    const fen = "4k3/8/8/8/7R/8/8/4K3 w - - 0 1";
    expect(attacked(fen, "a4", WHITE)).toBe(true);
    expect(attacked(fen, "a5", WHITE)).toBe(false);
    expect(attacked(fen, "a3", WHITE)).toBe(false);
  });

  it("bishop on h3 does not attack a3 and stops at blockers", () => {
    const fen = "4k3/8/8/8/8/7B/8/4K3 w - - 0 1";
    expect(attacked(fen, "a3", WHITE)).toBe(false);
    expect(attacked(fen, "g4", WHITE)).toBe(true);
    expect(attacked(fen, "d7", WHITE)).toBe(true);
    expect(attacked(fen, "g2", WHITE)).toBe(true);
    expect(attacked(fen, "h4", WHITE)).toBe(false);
    const blocked = "4k3/8/8/5p2/8/7B/8/4K3 w - - 0 1";
    expect(attacked(blocked, "g4", WHITE)).toBe(true);
    expect(attacked(blocked, "f5", WHITE)).toBe(true);
    expect(attacked(blocked, "e6", WHITE)).toBe(false);
  });

  it("queen attacks along ranks, files and diagonals", () => {
    const fen = "4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1";
    for (const sq of ["d8", "d1", "a4", "h4", "a1", "g7", "g1", "a7"]) {
      expect(attacked(fen, sq, WHITE), sq).toBe(true);
    }
    expect(attacked(fen, "e6", WHITE)).toBe(false);
    expect(attacked(fen, "b5", WHITE)).toBe(false);
  });

  it("pieces in the corners attack correctly", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1";
    expect(attacked(fen, "a8", WHITE)).toBe(true);
    expect(attacked(fen, "h8", WHITE)).toBe(true);
    expect(attacked(fen, "a1", BLACK)).toBe(true);
    expect(attacked(fen, "h1", BLACK)).toBe(true);
    expect(attacked(fen, "b2", WHITE)).toBe(false);
  });
});

describe("knights and kings", () => {
  it("king attacks exactly its 8 neighbours", () => {
    const fen = "7k/8/8/8/4K3/8/8/8 w - - 0 1";
    const neighbours = new Set(["d3", "e3", "f3", "d4", "f4", "d5", "e5", "f5"]);
    for (let sq = 0; sq < 64; sq++) {
      const name = squareName(sq);
      if (name === "e4") continue;
      expect(attacked(fen, name, WHITE), name).toBe(neighbours.has(name));
    }
  });

  it("knight attacks over pieces and not adjacent squares", () => {
    const fen = "4k3/8/8/3ppp2/3pNp2/3ppp2/8/4K3 w - - 0 1";
    for (const sq of ["d6", "f6", "c5", "g5", "c3", "g3", "d2", "f2"]) {
      expect(attacked(fen, sq, WHITE), sq).toBe(true);
    }
    expect(attacked(fen, "e6", WHITE)).toBe(false);
    expect(attacked(fen, "g4", WHITE)).toBe(false);
  });

  it("knight in the corner does not wrap", () => {
    const fen = "4k3/8/8/8/8/8/8/N3K3 w - - 0 1";
    expect(attacked(fen, "b3", WHITE)).toBe(true);
    expect(attacked(fen, "c2", WHITE)).toBe(true);
    expect(attacked(fen, "h2", WHITE)).toBe(false);
    expect(attacked(fen, "g3", WHITE)).toBe(false);
  });

  it("squares occupied by the attacker's own pieces count as attacked", () => {
    const fen = "4k3/8/8/8/8/8/R7/R3K3 w - - 0 1";
    expect(attacked(fen, "a2", WHITE)).toBe(true);
    expect(attacked(fen, "a1", WHITE)).toBe(true);
    expect(attacked(fen, "d1", WHITE)).toBe(true);
  });
});

describe("exhaustive comparison with a naive reference", () => {
  const fens = [
    ...PERFT_CASES.map((c) => c.fen),
    ...randomPositions({ count: 80 }).map((p) => p.fen),
  ];

  it("uses at least 50 positions", () => {
    expect(fens.length).toBeGreaterThanOrEqual(50);
  });

  it("matches on every square and color", () => {
    for (const fen of fens) {
      const position = parseFen(fen);
      for (let sq = 0; sq < 64; sq++) {
        for (const color of [WHITE, BLACK] as const) {
          expect(isSquareAttacked(position, sq, color), `${fen} sq=${sq} color=${color}`).toBe(
            referenceAttacked(position, sq, color),
          );
        }
      }
    }
  });
});
