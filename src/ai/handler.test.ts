import { describe, expect, it } from "vitest";
import { generateLegalMoves, moveToUci, parseFen, START_FEN } from "@/engine/core";
import { handleSearch } from "./handler";
import type { BestMoveResponse, SearchRequest } from "./protocol";

function request(overrides: Partial<SearchRequest> = {}): SearchRequest {
  return { type: "search", requestId: 1, initialFen: START_FEN, moves: [], level: 1, seed: 1, ...overrides };
}

function bestMove(response: ReturnType<typeof handleSearch>): BestMoveResponse {
  expect(response.type).toBe("bestmove");
  return response as BestMoveResponse;
}

describe("handleSearch", () => {
  it("returns a legal move for FEN + moves", () => {
    const moves = ["e2e4", "e7e5"];
    const response = bestMove(handleSearch(request({ moves })));
    expect(response.requestId).toBe(1);
    const position = parseFen("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2");
    const legal = generateLegalMoves(position).map(moveToUci);
    expect(legal).toContain(response.move);
  });

  it("echoes the requestId", () => {
    expect(handleSearch(request({ requestId: 42 })).requestId).toBe(42);
  });

  it("returns an error for an illegal move in the history", () => {
    const response = handleSearch(request({ requestId: 9, moves: ["e2e4", "e2e4"] }));
    expect(response.type).toBe("error");
    expect(response.requestId).toBe(9);
  });

  it("returns an error for a malformed move or FEN", () => {
    expect(handleSearch(request({ moves: ["zzzz"] })).type).toBe("error");
    expect(handleSearch(request({ initialFen: "not a fen" })).type).toBe("error");
  });

  it("returns a null move when there are no legal moves", () => {
    // Fool's mate, white is checkmated.
    const response = bestMove(
      handleSearch(request({ moves: ["f2f3", "e7e5", "g2g4", "d8h4"] })),
    );
    expect(response.move).toBeNull();
  });

  it("level 1 is deterministic for the same seed", () => {
    const a = bestMove(handleSearch(request({ seed: 123 }))).move;
    const b = bestMove(handleSearch(request({ seed: 123 }))).move;
    expect(a).toBe(b);
  });

  it("level 1 varies across seeds", () => {
    const moves = new Set<string | null>();
    for (let seed = 1; seed <= 30; seed++) moves.add(bestMove(handleSearch(request({ seed }))).move);
    expect(moves.size).toBeGreaterThan(1);
  });

  it("uses the history for repetition (draw score)", () => {
    const initialFen = "7k/8/8/8/8/Q7/8/6K1 b - - 0 1";
    const shuffle = ["h8g8", "a3a4", "g8h8", "a4a3"];
    const withoutHistory = bestMove(handleSearch(request({ initialFen })));
    const withHistory = bestMove(handleSearch(request({ initialFen, moves: [...shuffle, ...shuffle] })));
    expect(withoutHistory.score).toBeLessThan(-300);
    expect(withHistory.score).toBe(0);
  });

  it("level 2 and 3 return a move within their time budget", () => {
    const r2 = bestMove(handleSearch(request({ level: 2 })));
    expect(r2.move).not.toBeNull();
    expect(r2.timeMs).toBeLessThan(2000);
  });
});
