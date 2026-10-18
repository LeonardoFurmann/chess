import { describe, expect, it } from "vitest";
// Fixtures and helpers live outside src, so the alias cannot reach them.
/* eslint-disable @typescript-eslint/no-restricted-imports */
import { MATE_IN_1, MATE_IN_2 } from "../../test/fixtures/mates";
import { PERFT_CASES } from "../../test/fixtures/perft";
/* eslint-enable @typescript-eslint/no-restricted-imports */
import {
  createRng,
  generateLegalMoves,
  makeMove,
  moveFrom,
  movePromotion,
  moveTo,
  parseFen,
  squareName,
  toFen,
} from "@/engine/core";
import type { Move, Position } from "@/engine/core";
import { MATE_SCORE, search } from "./search";

const PROMOTION_LETTERS: Record<number, string> = {
  2: "n",
  3: "b",
  4: "r",
  5: "q",
};

function uci(move: Move): string {
  return (
    squareName(moveFrom(move)) +
    squareName(moveTo(move)) +
    (PROMOTION_LETTERS[movePromotion(move)] ?? "")
  );
}

function legalByUci(position: Position, text: string): Move {
  const move = generateLegalMoves(position).find((m) => uci(m) === text);
  if (move === undefined) throw new Error(`illegal move ${text}`);
  return move;
}

describe("search: mates", () => {
  for (const puzzle of MATE_IN_1) {
    it(`mate in 1: ${puzzle.fen}`, () => {
      const position = parseFen(puzzle.fen);
      const result = search(position, { maxDepth: 2 });
      expect(result.move).not.toBeNull();
      expect(puzzle.solutions).toContain(uci(result.move as Move));
      expect(result.score).toBe(MATE_SCORE - 1);
    });
  }

  for (const puzzle of MATE_IN_2) {
    it(`mate in 2: ${puzzle.fen}`, () => {
      const position = parseFen(puzzle.fen);
      const result = search(position, { maxDepth: 4 });
      expect(result.move).not.toBeNull();
      expect(puzzle.solutions).toContain(uci(result.move as Move));
      expect(result.score).toBe(MATE_SCORE - 3);
    });
  }

  it("prefers the fastest mate when mate in 1 and mate in 2 are both available", () => {
    // Ra8# is mate in 1; Rb7 and others also win but slower.
    const position = parseFen("6k1/5ppp/8/8/8/8/1R3PPP/R5K1 w - - 0 1");
    const result = search(position, { maxDepth: 4 });
    expect(uci(result.move as Move)).toBe("a1a8");
    expect(result.score).toBe(MATE_SCORE - 1);
  });

  it("sees that capturing the queen leads to mate against", () => {
    // Rxd5?? loses to ...Re1#; the search must see it and play something else.
    const position = parseFen("4r1k1/8/8/3q4/8/8/5PPP/3R2K1 w - - 0 1");
    const result = search(position, { maxDepth: 3 });
    expect(uci(result.move as Move)).not.toBe("d1d5");
    expect(result.score).toBeGreaterThan(-MATE_SCORE + 100);
  });
});

describe("search: end of game", () => {
  it("returns a null move without throwing when there are no legal moves", () => {
    const mated = search(parseFen("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1"), {
      maxDepth: 3,
    });
    expect(mated.move).toBeNull();
    expect(mated.score).toBe(-MATE_SCORE);
    const stalemated = search(parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), {
      maxDepth: 3,
    });
    expect(stalemated.move).toBeNull();
    expect(stalemated.score).toBe(0);
  });

  it("returns the only legal move", () => {
    const position = parseFen("k7/8/2K5/8/8/8/8/R7 b - - 0 1");
    const legal = generateLegalMoves(position);
    expect(legal).toHaveLength(1);
    const result = search(position, { maxDepth: 3 });
    expect(result.move).toBe(legal[0]);
  });

  it("scores a third repetition counting the game history as a draw", () => {
    // Black is a queen down, but ...Ng8 would reach the start position for the third time.
    const position = parseFen("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    for (const text of ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1"]) {
      makeMove(position, legalByUci(position, text));
    }
    const withHistory = search(position, { maxDepth: 1 });
    expect(uci(withHistory.move as Move)).toBe("f6g8");
    expect(withHistory.score).toBe(0);

    const fresh = search(parseFen(toFen(position)), { maxDepth: 1 });
    expect(fresh.score).toBeLessThan(0);
  });

  it("gives mate precedence over the fifty-move rule", () => {
    // Halfmove clock is 99: Ra8# is mate in 1 and must still be found and scored as a mate.
    const position = parseFen("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 99 80");
    const result = search(position, { maxDepth: 2 });
    expect(uci(result.move as Move)).toBe("a1a8");
    expect(result.score).toBe(MATE_SCORE - 1);
  });

  it("scores the fifty-move draw as 0 beyond the clock limit", () => {
    const position = parseFen("4k3/8/8/8/8/8/4Q3/4K3 w - - 99 80");
    const result = search(position, { maxDepth: 2 });
    expect(Math.abs(result.score)).toBeLessThan(MATE_SCORE - 100);
    // After any quiet move the clock reaches 100, so every line is a draw (no mate in 1 exists).
    expect(result.score).toBe(0);
  });

  it("scores insufficient material as 0", () => {
    const result = search(parseFen("4k3/8/8/8/8/8/3N4/4K3 w - - 0 1"), {
      maxDepth: 3,
    });
    expect(result.score).toBe(0);
  });
});

describe("search: iterative deepening, time and state", () => {
  const middlegame = PERFT_CASES.find((c) => c.name === "kiwipete")?.fen as string;

  it("reports the completed depth and node count", () => {
    const result = search(parseFen(middlegame), { maxDepth: 3 });
    expect(result.depth).toBe(3);
    expect(result.nodes).toBeGreaterThan(0);
    expect(result.move).not.toBeNull();
  });

  for (const limit of [500, 2000]) {
    it(`returns within ${limit} ms + 10%`, () => {
      const position = parseFen(middlegame);
      const result = search(position, { timeLimitMs: limit });
      expect(result.timeMs).toBeLessThanOrEqual(limit * 1.1);
      expect(result.depth).toBeGreaterThanOrEqual(1);
      expect(result.move).not.toBeNull();
    });
  }

  it("always completes depth 1, even with an expired budget", () => {
    const result = search(parseFen(middlegame), { timeLimitMs: 0 });
    expect(result.depth).toBe(1);
    expect(result.move).not.toBeNull();
  });

  it("stops when shouldStop returns true and keeps the last completed depth", () => {
    let calls = 0;
    const result = search(parseFen(middlegame), {
      maxDepth: 20,
      shouldStop: () => ++calls > 3,
    });
    expect(result.depth).toBeGreaterThanOrEqual(1);
    expect(result.depth).toBeLessThan(20);
    expect(result.move).not.toBeNull();
  });

  it("leaves the position identical (hash, FEN and history)", () => {
    for (const options of [
      { maxDepth: 3 },
      { timeLimitMs: 100 },
      { maxDepth: 6, shouldStop: () => true },
    ]) {
      const position = parseFen(middlegame);
      const fen = toFen(position);
      const { hashHi, hashLo } = position;
      search(position, options);
      expect(toFen(position)).toBe(fen);
      expect(position.hashHi).toBe(hashHi);
      expect(position.hashLo).toBe(hashLo);
      expect(position.history).toHaveLength(0);
    }
  });
});

describe("search: random margin", () => {
  const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";

  it("is deterministic for a given seed", () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      return Array.from(
        { length: 5 },
        () => search(parseFen(fen), { maxDepth: 2, randomMarginCp: 150, rng }).move,
      );
    };
    expect(run(7)).toEqual(run(7));
  });

  it("only picks moves within the margin and varies across seeds", () => {
    const base = search(parseFen(fen), { maxDepth: 2 });
    const rng = createRng(11);
    const picked = new Set<Move>();
    for (let i = 0; i < 40; i++) {
      const r = search(parseFen(fen), {
        maxDepth: 2,
        randomMarginCp: 150,
        rng,
      });
      expect(r.score).toBeGreaterThanOrEqual(base.score - 150);
      picked.add(r.move as Move);
    }
    expect(picked.size).toBeGreaterThan(1);
  });

  it("with margin 0 always plays the best move", () => {
    const rng = createRng(3);
    const base = search(parseFen(fen), { maxDepth: 2 });
    for (let i = 0; i < 5; i++) {
      const r = search(parseFen(fen), { maxDepth: 2, randomMarginCp: 0, rng });
      expect(r.score).toBe(base.score);
    }
  });
});
