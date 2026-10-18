import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
/* eslint-disable @typescript-eslint/no-restricted-imports */
import { PERFT_CASES } from "../../test/fixtures/perft";
import { randomPositions } from "../../test/fixtures/random-positions";
/* eslint-enable @typescript-eslint/no-restricted-imports */
import { START_FEN, parseFen, toFen } from "@/engine/core";
import { evaluate } from "@/ai/evaluate";

const swapCase = (c: string) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());

/**
 * Color-flipped, rank-flipped position. With `flipSide` the side to move is swapped too
 * (the true mirror image); without it the same color keeps the move.
 */
function mirrorFen(fen: string, flipSide: boolean): string {
  const [placement, side, castling, ep, half, full] = fen.split(" ");
  const ranks = placement
    .split("/")
    .reverse()
    .map((r) => [...r].map((c) => (/\d/.test(c) ? c : swapCase(c))).join(""));
  const newCastling =
    castling === "-"
      ? "-"
      : [...castling]
          .map(swapCase)
          .sort((a, b) => "KQkq".indexOf(a) - "KQkq".indexOf(b))
          .join("");
  const newEp = ep === "-" ? "-" : ep[0] + String(9 - Number(ep[1]));
  const newSide = flipSide ? (side === "w" ? "b" : "w") : side;
  return [ranks.join("/"), newSide, newCastling, newEp, half, full].join(" ");
}

const ev = (fen: string) => evaluate(parseFen(fen));

describe("evaluate adversarial", () => {
  it("start position is 0 (white and black to move)", () => {
    expect(ev(START_FEN)).toBe(0);
    expect(ev(START_FEN.replace(" w ", " b "))).toBe(0);
  });

  // The evaluation is from the side to move's point of view, so the true mirror image
  // (colors, ranks and side to move all flipped) scores the same, and the mirror that
  // keeps the side to move scores the opposite (ticket: evaluate(pos) === -evaluate(mirror)).
  it("mirror keeping side to move negates, on perft fixtures", () => {
    for (const c of PERFT_CASES) {
      expect(ev(c.fen), c.name).toBe(0 - ev(mirrorFen(c.fen, false)));
    }
  });

  it("mirror keeping side to move negates, on random positions", () => {
    for (const p of randomPositions({ count: 300 })) {
      expect(ev(p.fen), p.fen).toBe(0 - ev(mirrorFen(p.fen, false)));
    }
  });

  it("full mirror (side flipped) preserves the score, on random positions", () => {
    for (const p of randomPositions({ count: 300, seed: 11 })) {
      expect(ev(p.fen), p.fen).toBe(ev(mirrorFen(p.fen, true)));
    }
  });

  it("same board with the other side to move negates the score", () => {
    for (const p of randomPositions({ count: 100, seed: 7 })) {
      const a = p.fen.split(" ");
      a[3] = "-";
      const b = [...a];
      b[1] = a[1] === "w" ? "b" : "w";
      expect(ev(b.join(" ")), p.fen).toBe(0 - ev(a.join(" ")));
    }
  });

  it("extra white queen, white to move: > 800", () => {
    expect(ev("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBeGreaterThan(800);
  });

  it("extra white queen, black to move: < -800", () => {
    expect(ev("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1")).toBeLessThan(-800);
  });

  it("extra black queen, white to move: < -800", () => {
    expect(ev("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1")).toBeLessThan(-800);
  });

  it("knight on d4 is worth more than knight on a1 (white)", () => {
    const d4 = ev("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1");
    const a1 = ev("4k3/8/8/8/8/8/8/N3K3 w - - 0 1");
    expect(d4).toBeGreaterThan(a1);
  });

  it("black knight on d5 is better for black than on a8 (rank mirrored)", () => {
    const d5 = ev("4k3/8/8/3n4/8/8/8/4K3 w - - 0 1");
    const a8 = ev("n3k3/8/8/8/8/8/8/4K3 w - - 0 1");
    // From white's view a good black knight is worse for white.
    expect(d5).toBeLessThan(a8);
  });

  it("black knight on d5 mirrors white knight on d4", () => {
    expect(ev("4k3/8/8/3n4/8/8/8/4K3 w - - 0 1")).toBe(0 - ev("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1"));
  });

  it("black pawn advancement is rewarded like white's (rank flip)", () => {
    const w2 = ev("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
    const w4 = ev("4k3/8/8/8/4P3/8/8/4K3 w - - 0 1");
    const b7 = ev("4k3/4p3/8/8/8/8/8/4K3 w - - 0 1");
    const b5 = ev("4k3/8/8/4p3/8/8/8/4K3 w - - 0 1");
    expect(w4).toBeGreaterThan(w2);
    expect(b5).toBeLessThan(b7);
    expect(w4 - w2).toBe(b7 - b5);
  });

  it("kings only: symmetric placement is 0 for either side to move", () => {
    expect(ev("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBe(0);
    expect(ev("4k3/8/8/8/8/8/8/4K3 b - - 0 1")).toBe(0);
  });

  it("kings only: color-mirrored placements negate (same side to move)", () => {
    const a = ev("4k3/8/8/8/8/8/8/6K1 w - - 0 1");
    const b = ev("6k1/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(a).toBe(-b);
    // castled-side king beats the centre per the middlegame king table
    expect(a).toBeGreaterThan(0);
  });

  it("king in the centre is worse than king on the back rank (middlegame table)", () => {
    const centre = ev("4k3/8/8/8/4K3/8/8/8 w - - 0 1");
    const home = ev("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(centre).toBeLessThan(home);
  });

  it("does not mutate the position", () => {
    for (const fen of [START_FEN, ...PERFT_CASES.map((c) => c.fen)]) {
      const pos = parseFen(fen);
      const board = Array.from(pos.board);
      evaluate(pos);
      evaluate(pos);
      expect(Array.from(pos.board)).toEqual(board);
      expect(toFen(pos)).toBe(fen);
      expect(pos.history).toHaveLength(0);
    }
  });

  it("is deterministic and returns integers", () => {
    for (const p of randomPositions({ count: 50, seed: 3 })) {
      const pos = parseFen(p.fen);
      const v = evaluate(pos);
      expect(Number.isInteger(v)).toBe(true);
      expect(evaluate(pos)).toBe(v);
    }
  });

  it("material dominates over piece-square tables", () => {
    const base = ev("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(ev("4k3/8/8/8/8/8/8/3QK3 w - - 0 1") - base).toBeGreaterThan(850);
    expect(ev("4k3/8/8/8/8/8/8/R3K3 w - - 0 1") - base).toBeGreaterThan(450);
  });
});
