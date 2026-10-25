import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PERFT_CASES } from "../../../test/fixtures/perft";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { randomPositions } from "../../../test/fixtures/random-positions";
import { parseFen, toFen } from "./fen";
import { generateLegalMoves } from "./legal";
import { makeMove, unmakeMove } from "./make-move";
import { moveToUci } from "./notation";
import { createRng } from "./rng";
import { computeHash } from "./zobrist";
import type { Position } from "./position";

function snapshot(p: Position) {
  return {
    board: Array.from(p.board),
    side: p.sideToMove,
    castling: p.castling,
    ep: p.epSquare,
    half: p.halfmoveClock,
    full: p.fullmoveNumber,
    wk: p.whiteKing,
    bk: p.blackKing,
    hi: p.hashHi >>> 0,
    lo: p.hashLo >>> 0,
    hist: p.history.length,
  };
}

function checkChain(fen: string, seed: number, maxDepth: number): void {
  const rng = createRng(seed);
  const p = parseFen(fen);
  const initial = snapshot(p);
  const played: string[] = [];
  for (let depth = 0; depth < maxDepth; depth++) {
    const moves = generateLegalMoves(p);
    if (moves.length === 0) break;
    const mv = moves[rng.nextInt(moves.length)];
    const before = snapshot(p);
    makeMove(p, mv);
    played.push(moveToUci(mv));
    const ctx = `${fen} after ${played.join(" ")}`;
    const h = computeHash(p);
    expect({ hi: p.hashHi >>> 0, lo: p.hashLo >>> 0 }, ctx).toEqual(h);
    expect(p.history.length, ctx).toBe(depth + 1);
    // The hash depends on the position only: reparsing the FEN gives the same one.
    expect(computeHash(parseFen(toFen(p))), `${ctx} (reparse)`).toEqual(h);
    // Single make/unmake of this step restores the previous state exactly.
    unmakeMove(p);
    expect(snapshot(p), ctx).toEqual(before);
    makeMove(p, mv);
  }
  for (let i = played.length; i > 0; i--) unmakeMove(p);
  expect(snapshot(p), `${fen} after unwinding ${played.join(" ")}`).toEqual(
    initial,
  );
  expect(toFen(p)).toBe(fen);
}

describe("chained make/unmake (depth 2-3) and incremental hash", () => {
  const sample = randomPositions({ count: 2000, seed: 20261003 }).filter(
    (_, i) => i % 5 === 0,
  );

  it("works on a sample of oracle positions", { timeout: 60_000 }, () => {
    sample.forEach((pos, i) => checkChain(pos.fen, 1000 + i, 2 + (i % 2)));
  });

  for (const c of PERFT_CASES) {
    it(`works on perft position "${c.name}" with several random chains`, () => {
      for (let s = 0; s < 40; s++) checkChain(c.fen, 77 + s, 3);
    });
  }
});
