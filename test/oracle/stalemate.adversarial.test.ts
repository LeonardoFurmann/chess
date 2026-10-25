import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { createGame, getFen, getLegalMoves, getStatus, play } from "@/engine";
import type { PromotionPiece, SquareName } from "@/engine";

interface Case {
  name: string;
  fen: string;
  line: string[];
}

const CASES: Case[] = [
  {
    name: "stalemate right after promotion to queen",
    fen: "8/1P6/k7/8/1K6/8/8/8 w - - 0 1",
    line: ["b7b8q"],
  },
  {
    name: "stalemate right after under-promotion to bishop",
    fen: "8/6P1/8/8/8/8/2K5/k7 w - - 0 1",
    line: ["g7g8b"],
  },
  {
    name: "stalemate right after en passant (1)",
    fen: "k7/4p3/1Q6/5P2/8/8/1P1K4/8 b - - 0 1",
    line: ["e7e5", "f5e6"],
  },
  {
    name: "stalemate right after en passant (2)",
    fen: "6k1/6p1/7Q/3K1P2/8/8/8/8 b - - 0 1",
    line: ["g7g5", "f5g6"],
  },
  {
    name: "stalemate right after en passant (3)",
    fen: "5k2/3p4/6Q1/2K1P3/8/8/8/8 b - - 0 1",
    line: ["d7d5", "e5d6"],
  },
];

function toInput(uci: string) {
  return {
    from: uci.slice(0, 2) as SquareName,
    to: uci.slice(2, 4) as SquareName,
    ...(uci.length > 4 ? { promotion: uci[4] as PromotionPiece } : {}),
  };
}

describe("scripted stalemates vs chess.js", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const ref = new Chess(c.fen);
      let game = createGame(c.fen);
      for (const uci of c.line) {
        ref.move(
          uci.length > 4
            ? { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }
            : { from: uci.slice(0, 2), to: uci.slice(2, 4) },
        );
        game = play(game, toInput(uci));
        expect(getFen(game).split(" ").slice(0, 2).join(" ")).toBe(
          ref.fen().split(" ").slice(0, 2).join(" "),
        );
      }
      expect(ref.isStalemate()).toBe(true);
      expect(getStatus(game)).toEqual({ kind: "stalemate", inCheck: false });
      expect(getLegalMoves(game)).toHaveLength(0);
      expect(() => play(game, { from: "a1", to: "a2" })).toThrow();
      const any = ref.moves({ verbose: true });
      expect(any).toHaveLength(0);
    });
  }

  it("no intermediate position of a scripted line is reported as stalemate early", () => {
    for (const c of CASES) {
      let game = createGame(c.fen);
      for (const uci of c.line.slice(0, -1)) {
        expect(getStatus(game).kind).toBe("playing");
        game = play(game, toInput(uci));
      }
      expect(getStatus(game).kind).toBe("playing");
    }
  });

  it("a stalemate position given directly as FEN is stalemate (and king not in check)", () => {
    for (const fen of [
      "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
      "k7/8/1QK5/8/8/8/8/8 b - - 0 1",
    ]) {
      const ref = new Chess(fen);
      expect(ref.isStalemate()).toBe(true);
      expect(getStatus(createGame(fen))).toEqual({
        kind: "stalemate",
        inCheck: false,
      });
    }
  });

  it("the same position with the king in check is mate, not stalemate", () => {
    const fen = "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1";
    expect(new Chess(fen).isCheckmate()).toBe(true);
    expect(getStatus(createGame(fen)).kind).toBe("checkmate");
  });
});
