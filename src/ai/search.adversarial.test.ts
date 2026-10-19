import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
/* eslint-disable @typescript-eslint/no-restricted-imports */
import { MATE_IN_1, MATE_IN_2 } from "../../test/fixtures/mates";
import { PERFT_CASES } from "../../test/fixtures/perft";
import { randomPositions } from "../../test/fixtures/random-positions";
/* eslint-enable @typescript-eslint/no-restricted-imports */
import {
  BLACK,
  START_FEN,
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

const PROMO_LETTER: Record<number, string> = { 2: "n", 3: "b", 4: "r", 5: "q" };

function uci(move: Move): string {
  const promo = movePromotion(move);
  return squareName(moveFrom(move)) + squareName(moveTo(move)) + (promo ? PROMO_LETTER[promo] : "");
}

/** Position reached from `startFen` by replaying UCI moves (so position.history is filled). */
function replay(startFen: string, uciMoves: readonly string[]): Position {
  const position = parseFen(startFen);
  for (const text of uciMoves) {
    const move = generateLegalMoves(position).find((m) => uci(m) === text);
    if (move === undefined) throw new Error(`illegal move in test setup: ${text}`);
    makeMove(position, move);
  }
  return position;
}

function snapshot(position: Position) {
  return {
    fen: toFen(position),
    hashHi: position.hashHi,
    hashLo: position.hashLo,
    historyLength: position.history.length,
    board: Array.from(position.board),
  };
}

const KIWIPETE = PERFT_CASES.find((c) => c.name === "kiwipete")!.fen;
const MIDGAME_FENS = [KIWIPETE, PERFT_CASES.find((c) => c.name === "position 6")!.fen];

describe("search: mates (SPEC 5.5)", () => {
  for (const puzzle of MATE_IN_1) {
    it(`mate in 1 at maxDepth 2: ${puzzle.fen}`, () => {
      const position = parseFen(puzzle.fen);
      const result = search(position, { maxDepth: 2 });
      expect(result.move).not.toBeNull();
      expect(puzzle.solutions).toContain(uci(result.move as Move));
      // Mate delivered at ply 1: -(MATE - 1) for the mated side, so MATE - 1 at the root.
      expect(result.score).toBe(MATE_SCORE - 1);
      expect(result.depth).toBe(2);
    });
  }

  for (const puzzle of MATE_IN_2) {
    it(`mate in 2 at maxDepth 4: ${puzzle.fen}`, () => {
      const position = parseFen(puzzle.fen);
      const result = search(position, { maxDepth: 4 });
      expect(result.move).not.toBeNull();
      expect(puzzle.solutions).toContain(uci(result.move as Move));
      expect(result.score).toBe(MATE_SCORE - 3);
    });
  }

  it("prefers the fastest mate when mates in 1 and in 2 are both available", () => {
    for (const [fen, fast] of [
      ["k7/8/1K6/8/8/8/8/7R w - - 0 1", "h1h8"],
      ["7k/8/6K1/8/8/8/8/5Q2 w - - 0 1", "f1f8"],
      ["6k1/8/6K1/8/8/8/8/R7 w - - 0 1", "a1a8"],
    ] as const) {
      for (const depth of [2, 4, 5]) {
        const result = search(parseFen(fen), { maxDepth: depth });
        expect(uci(result.move as Move), `${fen} depth ${depth}`).toBe(fast);
        expect(result.score).toBe(MATE_SCORE - 1);
      }
    }
  });

  it("keeps the mate score stable when searching deeper than needed", () => {
    for (const puzzle of MATE_IN_2.slice(0, 4)) {
      const shallow = search(parseFen(puzzle.fen), { maxDepth: 4 });
      const deep = search(parseFen(puzzle.fen), { maxDepth: 5 });
      expect(deep.score).toBe(shallow.score);
      expect(puzzle.solutions).toContain(uci(deep.move as Move));
    }
  });
});

describe("search: tactical traps", () => {
  // Rxc2 wins the queen but Rd1# follows (back-rank mate): the mate is at ply 2, so it is seen
  // from maxDepth 3 on (same convention as "mate in 1 needs maxDepth 2").
  const POISONED_QUEEN = "3r2k1/5ppp/8/8/8/8/2q2PPP/2R3K1 w - - 0 1";

  it("does not capture a queen when that allows mate in 1 against", () => {
    for (const depth of [3, 4]) {
      const position = parseFen(POISONED_QUEEN);
      const result = search(position, { maxDepth: depth });
      expect(result.move).not.toBeNull();
      expect(uci(result.move as Move), `depth ${depth}`).not.toBe("c1c2");
      expect(result.score).toBeGreaterThan(-MATE_SCORE + 1000);
    }
  });

  it("scores the poisoned capture as being mated, if it were forced", () => {
    // After Rxc2 the same position with black to move has a mate in 1: Rd1#.
    const afterCapture = parseFen("3r2k1/5ppp/8/8/8/8/2R2PPP/6K1 b - - 0 1");
    const result = search(afterCapture, { maxDepth: 2 });
    expect(uci(result.move as Move)).toBe("d8d1");
    expect(result.score).toBe(MATE_SCORE - 1);
  });

  it("returns the only legal move", () => {
    const position = parseFen("8/8/8/8/8/1q5P/8/K6k w - - 0 1");
    expect(generateLegalMoves(position)).toHaveLength(1);
    for (const options of [{ maxDepth: 1 }, { maxDepth: 4 }, { timeLimitMs: 50 }]) {
      const result = search(parseFen("8/8/8/8/8/1q5P/8/K6k w - - 0 1"), options);
      expect(result.move).not.toBeNull();
      expect(uci(result.move as Move)).toBe("h3h4");
    }
  });

  it("looks for a stalemate when it is the only way out of a lost position", () => {
    // Black king h1 is boxed in by Qg3 and the black queen hangs to Kc1. Qc2+ Kxc2 leaves black
    // stalemated (draw, score 0); every other move loses the queen or gets mated.
    const fen = "8/8/8/8/8/6Q1/8/1qK4k b - - 0 1";
    for (const depth of [3, 4]) {
      const position = parseFen(fen);
      const result = search(position, { maxDepth: depth });
      expect(result.score, `depth ${depth}`).toBe(0);
      expect(uci(result.move as Move)).toBe("b1c2");
    }
  });

  it("escapes a lost position by repetition, using the game history", () => {
    // White has queen and king against a bare king. The shuffle below brings the position
    // after Kg8-h8 to its third occurrence, which is a draw: score 0. Every other black move
    // stays lost (about a queen down).
    const moves = ["d1d2", "h8g8", "d2d1", "g8h8", "d1d2", "h8g8", "d2d1"];
    const position = replay("7k/8/8/8/8/8/8/3QK3 w - - 0 1", moves);
    expect(position.sideToMove).toBe(BLACK);
    const before = snapshot(position);
    const result = search(position, { maxDepth: 3 });
    expect(result.move).not.toBeNull();
    expect(uci(result.move as Move)).toBe("g8h8");
    expect(result.score).toBe(0);
    expect(snapshot(position)).toEqual(before);
  });

  it("without the repeating history the same position is just lost", () => {
    const position = parseFen("6k1/8/8/8/8/8/8/3QK3 b - - 0 1");
    const result = search(position, { maxDepth: 3 });
    expect(result.score).toBeLessThan(-300);
  });

  it("does not repeat a position (draw) when it is clearly winning", () => {
    // White (to move) is up a queen; Qd1-d2 would reach the third occurrence of a position.
    // Winning side must pick another move with a positive score.
    const moves = ["d1d2", "h8g8", "d2d1", "g8h8", "d1d2", "h8g8", "d2d1", "g8h8", "d1d2", "h8g8"];
    const position = replay("7k/8/8/8/8/8/8/3QK3 w - - 0 1", moves);
    // White to move; d2d1 would recreate a position seen twice already (third occurrence).
    const result = search(position, { maxDepth: 3 });
    expect(result.score).toBeGreaterThan(300);
    expect(uci(result.move as Move)).not.toBe("d2d1");
  });
});

describe("search: degenerate positions", () => {
  it("returns a null move without throwing when the side to move is checkmated", () => {
    const position = parseFen("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1");
    expect(generateLegalMoves(position)).toHaveLength(0);
    const before = snapshot(position);
    const result = search(position, { maxDepth: 3 });
    expect(result.move).toBeNull();
    expect(result.score).toBe(-MATE_SCORE);
    expect(snapshot(position)).toEqual(before);
  });

  it("returns a null move with score 0 when the side to move is stalemated", () => {
    const position = parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(generateLegalMoves(position)).toHaveLength(0);
    const result = search(position, { maxDepth: 3 });
    expect(result.move).toBeNull();
    expect(result.score).toBe(0);
  });

  it("handles no-move positions with time limit and shouldStop options", () => {
    const mated = parseFen("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1");
    expect(search(mated, { timeLimitMs: 100 }).move).toBeNull();
    expect(search(mated, { shouldStop: () => true }).move).toBeNull();
  });
});

describe("search: stopping", () => {
  it("shouldStop returning true from the start still completes depth 1", () => {
    for (const fen of [START_FEN, ...MIDGAME_FENS]) {
      const position = parseFen(fen);
      const legal = generateLegalMoves(position).map(uci);
      const result = search(position, { maxDepth: 6, shouldStop: () => true });
      expect(result.move).not.toBeNull();
      expect(legal).toContain(uci(result.move as Move));
      expect(result.depth).toBe(1);
      expect(result.nodes).toBeGreaterThan(0);
    }
  });

  it("shouldStop returning true later keeps the last completed depth and a legal move", () => {
    const position = parseFen(KIWIPETE);
    const legal = generateLegalMoves(position).map(uci);
    const before = snapshot(position);
    let calls = 0;
    const result = search(position, {
      maxDepth: 8,
      shouldStop: () => ++calls > 2000,
    });
    expect(calls).toBeGreaterThan(0);
    expect(result.move).not.toBeNull();
    expect(legal).toContain(uci(result.move as Move));
    expect(result.depth).toBeGreaterThanOrEqual(1);
    expect(result.depth).toBeLessThan(8);
    expect(snapshot(position)).toEqual(before);
  }, 120_000);

  it("a stopped search returns the move of the last complete iteration", () => {
    // Stopping mid-iteration must discard it: with a mate in 1 found at depth 2, a stop that
    // arrives during depth 3+ cannot change the answer.
    const puzzle = MATE_IN_1[0];
    let calls = 0;
    const result = search(parseFen(puzzle.fen), { maxDepth: 10, shouldStop: () => ++calls > 400 });
    expect(puzzle.solutions).toContain(uci(result.move as Move));
    expect(result.score).toBe(MATE_SCORE - 1);
  });

  it("respects maxDepth and reports the completed depth", () => {
    for (const depth of [1, 2, 3]) {
      const result = search(parseFen(START_FEN), { maxDepth: depth });
      expect(result.depth).toBe(depth);
      expect(result.nodes).toBeGreaterThan(0);
      expect(result.timeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("searches more nodes at greater depth", () => {
    const a = search(parseFen(KIWIPETE), { maxDepth: 2 });
    const b = search(parseFen(KIWIPETE), { maxDepth: 3 });
    expect(b.nodes).toBeGreaterThan(a.nodes);
  });

  it("with only a tiny time limit still completes depth 1 and returns a legal move", () => {
    const position = parseFen(KIWIPETE);
    const legal = generateLegalMoves(position).map(uci);
    const result = search(position, { timeLimitMs: 1 });
    expect(result.depth).toBeGreaterThanOrEqual(1);
    expect(legal).toContain(uci(result.move as Move));
  });
});

describe("search: time limit (limit + 10%)", () => {
  for (const limit of [500, 2000]) {
    it(`returns within ${limit} ms + 10% on mid-game fixtures`, () => {
      for (const fen of MIDGAME_FENS) {
        const position = parseFen(fen);
        const legal = generateLegalMoves(position).map(uci);
        const start = performance.now();
        const result = search(position, { timeLimitMs: limit });
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThanOrEqual(limit * 1.1);
        expect(result.timeMs).toBeLessThanOrEqual(limit * 1.1);
        expect(result.depth).toBeGreaterThanOrEqual(1);
        expect(legal).toContain(uci(result.move as Move));
      }
    }, 20_000);
  }
});

describe("search: position is left untouched", () => {
  it("restores hash, FEN, board and history after searches of every kind", () => {
    const histories: Position[] = [
      parseFen(START_FEN),
      parseFen(KIWIPETE),
      replay(START_FEN, ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "g8f6"]),
      parseFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1"),
    ];
    const optionSets = [
      { maxDepth: 3 },
      { maxDepth: 4, shouldStop: () => false },
      { timeLimitMs: 30 },
      { maxDepth: 3, shouldStop: () => true },
      { maxDepth: 3, randomMarginCp: 100, rng: createRng(5) },
    ];
    for (const position of histories) {
      for (const options of optionSets) {
        const before = snapshot(position);
        search(position, options);
        expect(snapshot(position)).toEqual(before);
      }
    }
  }, 120_000);

  it("restores random positions (castling, en passant, promotions in play)", () => {
    for (const rp of randomPositions({ count: 60, seed: 4242 })) {
      const position = replay(rp.startFen, rp.uciMoves);
      const before = snapshot(position);
      const legal = generateLegalMoves(position).map(uci);
      const result = search(position, { maxDepth: 2 });
      expect(snapshot(position)).toEqual(before);
      if (legal.length === 0) {
        expect(result.move).toBeNull();
      } else {
        expect(legal).toContain(uci(result.move as Move));
      }
    }
  }, 120_000);
});

describe("search: consistency of alpha-beta with its own subtrees", () => {
  /** Shifts a child's mate score by one ply when seen from its parent. */
  function fromParent(childScore: number): number {
    const negated = -childScore + 0;
    if (negated > MATE_SCORE - 1000) return negated - 1;
    if (negated < -(MATE_SCORE - 1000)) return negated + 1;
    return negated;
  }

  it("root score equals the best of the children's scores (depth 2)", () => {
    const sample = randomPositions({ count: 120, seed: 777 }).filter((_, i) => i % 3 === 0);
    for (const rp of sample) {
      const root = replay(rp.startFen, rp.uciMoves);
      const moves = generateLegalMoves(root);
      if (moves.length === 0) continue;
      let best = -Infinity;
      for (const move of moves) {
        const child = replay(rp.startFen, rp.uciMoves);
        makeMove(child, move);
        best = Math.max(best, fromParent(search(child, { maxDepth: 1 }).score));
      }
      const result = search(root, { maxDepth: 2 });
      expect(result.score, rp.fen).toBe(best);
    }
  }, 120_000);

  it("root score equals the best of the children's scores (depth 3, kiwipete and start)", () => {
    for (const fen of [START_FEN, KIWIPETE]) {
      const root = parseFen(fen);
      let best = -Infinity;
      for (const move of generateLegalMoves(root)) {
        const child = parseFen(fen);
        makeMove(child, move);
        best = Math.max(best, fromParent(search(child, { maxDepth: 2 }).score));
      }
      expect(search(root, { maxDepth: 3 }).score, fen).toBe(best);
    }
  });
});

describe("search: randomMarginCp and determinism", () => {
  function runSequence(seed: number, fens: readonly string[], margin: number): string[] {
    const rng = createRng(seed);
    return fens.map((fen) => {
      const result = search(parseFen(fen), { maxDepth: 2, randomMarginCp: margin, rng });
      return uci(result.move as Move);
    });
  }

  const FENS = [START_FEN, KIWIPETE, ...MIDGAME_FENS, ...PERFT_CASES.slice(2, 5).map((c) => c.fen)];

  it("same seed and margin give the same sequence of moves", () => {
    const a = runSequence(99, FENS, 150);
    const b = runSequence(99, FENS, 150);
    expect(b).toEqual(a);
  });

  it("different seeds eventually pick different moves with a wide margin", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      seen.add(runSequence(seed, [START_FEN], 150)[0]);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("chosen move is always legal and within the margin of the best score", () => {
    const margin = 150;
    for (const fen of FENS) {
      const root = parseFen(fen);
      const legal = generateLegalMoves(root);
      const scores = new Map<string, number>();
      for (const move of legal) {
        const child = parseFen(fen);
        makeMove(child, move);
        const s = search(child, { maxDepth: 1 }).score;
        const negated = -s;
        const adjusted =
          negated > MATE_SCORE - 1000 ? negated - 1 : negated < -(MATE_SCORE - 1000) ? negated + 1 : negated;
        scores.set(uci(move), adjusted);
      }
      const best = Math.max(...scores.values());
      for (let seed = 1; seed <= 15; seed++) {
        const rng = createRng(seed);
        const result = search(parseFen(fen), { maxDepth: 2, randomMarginCp: margin, rng });
        const chosen = uci(result.move as Move);
        expect(scores.has(chosen), `${fen}: ${chosen} legal`).toBe(true);
        expect(scores.get(chosen)!, `${fen}: ${chosen} within margin`).toBeGreaterThanOrEqual(best - margin);
      }
    }
  });

  it("margin 0 always picks a move with the best score", () => {
    const fen = KIWIPETE;
    const best = search(parseFen(fen), { maxDepth: 2 }).score;
    for (let seed = 1; seed <= 10; seed++) {
      const result = search(parseFen(fen), { maxDepth: 2, randomMarginCp: 0, rng: createRng(seed) });
      expect(result.score).toBe(best);
    }
  });

  it("never throws away a forced mate in 1 even with a wide margin", () => {
    // Moves scoring below best - margin are excluded; a mate in 1 is ~100000 above the rest.
    for (const puzzle of MATE_IN_1) {
      for (let seed = 1; seed <= 3; seed++) {
        const result = search(parseFen(puzzle.fen), {
          maxDepth: 2,
          randomMarginCp: 150,
          rng: createRng(seed),
        });
        expect(puzzle.solutions).toContain(uci(result.move as Move));
      }
    }
  });

  it("without randomMarginCp the search is deterministic", () => {
    const a = search(parseFen(KIWIPETE), { maxDepth: 3 });
    const b = search(parseFen(KIWIPETE), { maxDepth: 3 });
    expect(b.move).toBe(a.move);
    expect(b.score).toBe(a.score);
    expect(b.nodes).toBe(a.nodes);
  });
});

describe("search: draws inside the search", () => {
  it("treats a position at the fifty-move limit as a draw (score 0)", () => {
    // White is a queen up but the half-move clock is already 100 after black's reply.
    const position = parseFen("7k/8/8/8/8/8/8/3QK3 w - - 99 80");
    const result = search(position, { maxDepth: 2 });
    // Any white move reaches halfmove clock 100 -> draw by the fifty-move rule, unless it is
    // a capture/pawn move (none exists), so every line is 0.
    expect(result.score).toBe(0);
  });
});
