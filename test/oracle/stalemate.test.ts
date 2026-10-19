import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { createGame, getStatus, play } from "@/engine";
import type { PromotionPiece, SquareName } from "@/engine";
import { compareLine } from "./oracle";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface Case {
  name: string;
  fen: string;
  line: string[];
}

const CASES: Case[] = [
  { name: "king and queen against king", fen: "7k/5K2/8/8/8/8/8/6Q1 w - - 0 1", line: ["g1g6"] },
  { name: "king and pawn against king", fen: "k7/8/PK6/8/8/8/8/8 w - - 0 1", line: ["a6a7"] },
  { name: "stalemate with a pinned piece", fen: "7k/7n/8/8/8/8/8/KR5R w - - 0 1", line: ["b1g1"] },
  {
    name: "stalemated side has the lone king against more material",
    fen: "r4q2/8/8/8/8/4k3/8/7K b - - 0 1",
    line: ["f8f2"],
  },
  {
    name: "middle of the board (Loyd's ten-move stalemate)",
    fen: START,
    line: [
      "e2e3", "a7a5", "d1h5", "a8a6", "h5a5", "h7h5", "h2h4", "a6h6", "a5c7", "f7f6",
      "c7d7", "e8f7", "d7b7", "d8d3", "b7b8", "d3h7", "b8c8", "f7g6", "c8e6",
    ],
  },
];

function playLine(fen: string, line: readonly string[]) {
  let game = createGame(fen);
  for (const uci of line) {
    game = play(game, {
      from: uci.slice(0, 2) as SquareName,
      to: uci.slice(2, 4) as SquareName,
      promotion: uci.length > 4 ? (uci[4] as PromotionPiece) : undefined,
    });
  }
  return game;
}

describe("scripted stalemates agree with chess.js", () => {
  it("has at least 5 cases", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(5);
  });

  for (const { name, fen, line } of CASES) {
    it(name, () => {
      expect(compareLine(fen, line).join("\n\n")).toBe("");

      const chess = new Chess(fen);
      for (const uci of line) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      expect(chess.isStalemate()).toBe(true);

      const game = playLine(fen, line);
      const status = getStatus(game);
      expect(status.kind).toBe("stalemate");
      expect(status.inCheck).toBe(false);
      expect(() => play(game, { from: "a1", to: "a2" })).toThrow();
    });
  }
});
