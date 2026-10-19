import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { MATE_IN_1 } from "../../test/fixtures/mates";
import { handleSearch } from "@/ai/handler";
import { levelOptions } from "@/ai/levels";
import type { BestMoveResponse, Level, SearchRequest } from "@/ai/protocol";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function req(over: Partial<SearchRequest> = {}): SearchRequest {
  return { type: "search", requestId: 7, initialFen: START, moves: [], level: 1, seed: 1, ...over };
}

function best(r: ReturnType<typeof handleSearch>): BestMoveResponse {
  expect(r.type).toBe("bestmove");
  return r as BestMoveResponse;
}

function legalUci(chess: Chess): string[] {
  return chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
}

describe("levelOptions (SPEC 5.2)", () => {
  it("level 1: depth 2, margin 150, rng", () => {
    const o = levelOptions(1, 5);
    expect(o.maxDepth).toBe(2);
    expect(o.randomMarginCp).toBe(150);
    expect(o.rng).toBeDefined();
  });
  it("level 2 is 500 ms, level 3 is 2000 ms", () => {
    expect(levelOptions(2).timeLimitMs).toBe(500);
    expect(levelOptions(3).timeLimitMs).toBe(2000);
  });
  it("levels 2/3 have no random margin", () => {
    expect(levelOptions(2).randomMarginCp ?? 0).toBe(0);
    expect(levelOptions(3).randomMarginCp ?? 0).toBe(0);
  });
});

describe("handleSearch", () => {
  it("echoes requestId and returns a legal move (chess.js oracle)", () => {
    const r = best(handleSearch(req({ requestId: 42 })));
    expect(r.requestId).toBe(42);
    expect(legalUci(new Chess(START))).toContain(r.move);
    expect(r.nodes).toBeGreaterThan(0);
    expect(r.depth).toBeGreaterThanOrEqual(1);
  });

  it("applies the move history (white to move after 1.e4 e5)", () => {
    const r = best(handleSearch(req({ moves: ["e2e4", "e7e5"] })));
    const chess = new Chess();
    chess.move("e4");
    chess.move("e5");
    expect(legalUci(chess)).toContain(r.move);
  });

  it("black to move after one UCI move", () => {
    const r = best(handleSearch(req({ moves: ["e2e4"] })));
    const chess = new Chess();
    chess.move("e4");
    expect(legalUci(chess)).toContain(r.move);
  });

  it("invalid UCI move in history -> error response, no throw", () => {
    const r = handleSearch(req({ requestId: 3, moves: ["e2e4", "zzzz"] }));
    expect(r.type).toBe("error");
    expect(r.requestId).toBe(3);
    if (r.type === "error") expect(r.message.length).toBeGreaterThan(0);
  });

  it("illegal UCI move in history -> error", () => {
    expect(handleSearch(req({ moves: ["e2e5"] })).type).toBe("error");
    expect(handleSearch(req({ moves: ["e2e4", "e2e4"] })).type).toBe("error");
    expect(handleSearch(req({ moves: [""] })).type).toBe("error");
  });

  it("invalid FEN -> error", () => {
    for (const initialFen of ["", "garbage", "8/8/8/8/8/8/8/8 w - - 0 1 extra junk x"]) {
      const r = handleSearch(req({ initialFen, requestId: 9 }));
      expect(r.type).toBe("error");
      expect(r.requestId).toBe(9);
    }
  });

  it("no legal moves: bestmove with move null (stalemate and checkmate)", () => {
    for (const initialFen of ["7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1"]) {
      for (const level of [1, 2, 3] as Level[]) {
        const r = best(handleSearch(req({ initialFen, level })));
        expect(r.move).toBeNull();
      }
    }
  });

  it("level 1 is deterministic with the same seed", () => {
    for (const seed of [0, 1, 2, 12345, 987654321]) {
      const a = best(handleSearch(req({ seed })));
      const b = best(handleSearch(req({ seed })));
      expect(b.move).toBe(a.move);
    }
  });

  it("level 1 sequence of moves is reproducible per seed", () => {
    const play = (seed: number) => {
      const moves: string[] = [];
      for (let i = 0; i < 6; i++) {
        const r = best(handleSearch(req({ moves, seed: seed + i })));
        if (!r.move) break;
        moves.push(r.move);
      }
      return moves;
    };
    expect(play(3)).toEqual(play(3));
  });

  it("level 1 with different seeds: always legal, and varies", () => {
    const legal = new Set(legalUci(new Chess(START)));
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const r = best(handleSearch(req({ seed })));
      expect(legal.has(r.move!)).toBe(true);
      seen.add(r.move!);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("level 1 returns legal moves on mate-in-1 fixtures", () => {
    for (const p of MATE_IN_1.slice(0, 6)) {
      const r = best(handleSearch(req({ initialFen: p.fen, level: 1, seed: 1 })));
      expect(legalUci(new Chess(p.fen))).toContain(r.move);
    }
  });

  it("uses the history for repetition: available repetition is scored as a draw", () => {
    // White is a queen down; shuffling Ka1/Kb1 vs Qg3/Qg2 repeats the position.
    const fen = "7k/8/8/8/8/6q1/8/K7 w - - 0 1";
    const moves = ["a1b1", "g3g2", "b1a1", "g2g3", "a1b1", "g3g2", "b1a1", "g2g3"];
    const noHist = best(handleSearch(req({ initialFen: fen, moves: [], level: 1, seed: 1 })));
    const hist = best(handleSearch(req({ initialFen: fen, moves, level: 1, seed: 1 })));
    expect(noHist.score).toBeLessThan(-300);
    expect(hist.score).toBeGreaterThan(noHist.score);
    expect(hist.score).toBe(0);
  });
});
