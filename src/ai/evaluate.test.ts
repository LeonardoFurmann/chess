import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
/* eslint-disable @typescript-eslint/no-restricted-imports */
import { PERFT_CASES } from "../../test/fixtures/perft";
import { randomPositions } from "../../test/fixtures/random-positions";
/* eslint-enable @typescript-eslint/no-restricted-imports */
import { START_FEN, clonePosition, parseFen, toFen } from "@/engine/core";
import type { Position } from "@/engine/core";
import { evaluate } from "./evaluate";

/** Swap piece colors and flip ranks, keeping the same side to move (so the score negates). */
function mirror(position: Position): Position {
  const result = clonePosition(position);
  for (let sq = 0; sq < 64; sq++) result.board[sq ^ 56] = -position.board[sq];
  return result;
}

/** Full color mirror: also hands the move to the other side (so the score is unchanged). */
function mirrorWithSide(position: Position): Position {
  const result = mirror(position);
  result.sideToMove = -position.sideToMove as Position["sideToMove"];
  return result;
}

describe("evaluate", () => {
  it("scores the initial position as 0", () => {
    expect(evaluate(parseFen(START_FEN))).toBe(0);
  });

  it("is antisymmetric under color mirroring for perft fixtures", () => {
    for (const c of PERFT_CASES) {
      const pos = parseFen(c.fen);
      expect(evaluate(pos), c.name).toBe(0 - evaluate(mirror(pos)));
    }
  });

  it("is antisymmetric under color mirroring for random positions", () => {
    for (const rp of randomPositions({ count: 300 })) {
      const pos = parseFen(rp.fen);
      expect(evaluate(pos), rp.fen).toBe(0 - evaluate(mirror(pos)));
    }
  });

  it("is unchanged when colors, ranks and side to move are all mirrored", () => {
    for (const rp of randomPositions({ count: 300 })) {
      const pos = parseFen(rp.fen);
      expect(evaluate(pos), rp.fen).toBe(evaluate(mirrorWithSide(pos)));
    }
  });

  it("handles kings-only positions with the right sign and mirroring", () => {
    expect(evaluate(parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1"))).toBe(0);
    expect(evaluate(parseFen("4k3/8/8/8/8/8/8/4K3 b - - 0 1"))).toBe(0);
    // A king tucked on g1 is better for white than a king in the center on e4.
    const safe = evaluate(parseFen("4k3/8/8/8/8/8/8/6K1 w - - 0 1"));
    const exposed = evaluate(parseFen("4k3/8/8/8/4K3/8/8/8 w - - 0 1"));
    expect(safe).toBeGreaterThan(exposed);
    // Mirrored for black: a king on g8 is better for black than one on e5.
    const blackSafe = evaluate(parseFen("6k1/8/8/8/8/8/8/4K3 b - - 0 1"));
    const blackExposed = evaluate(parseFen("8/8/8/4k3/8/8/8/4K3 b - - 0 1"));
    expect(blackSafe).toBeGreaterThan(blackExposed);
    expect(blackSafe).toBe(safe);
  });

  it("values an extra white queen above 800 with white to move", () => {
    const pos = parseFen("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(evaluate(pos)).toBeGreaterThan(800);
  });

  it("values a knight on d4 more than a knight on a1, for both colors", () => {
    const d4 = evaluate(parseFen("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1"));
    const a1 = evaluate(parseFen("4k3/8/8/8/8/8/8/N3K3 w - - 0 1"));
    expect(d4).toBeGreaterThan(a1);
    const d5 = evaluate(parseFen("4k3/8/8/3n4/8/8/8/4K3 b - - 0 1"));
    const a8 = evaluate(parseFen("n3k3/8/8/8/8/8/8/4K3 b - - 0 1"));
    expect(d5).toBeGreaterThan(a8);
  });

  it("does not modify the position", () => {
    for (const c of PERFT_CASES) {
      const pos = parseFen(c.fen);
      const fenBefore = toFen(pos);
      const boardBefore = Array.from(pos.board);
      evaluate(pos);
      expect(toFen(pos)).toBe(fenBefore);
      expect(Array.from(pos.board)).toEqual(boardBefore);
      expect(pos.history).toHaveLength(0);
    }
  });
});
