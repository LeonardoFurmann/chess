import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { MATE_IN_1, MATE_IN_2 } from "./mates";
import { PERFT_CASES, fastDepths } from "./perft";
import { randomPositions } from "./random-positions";

// Guards the fixtures themselves against chess.js, so engine tests can trust them.

function matingMoves(chess: Chess): string[] {
  return chess
    .moves({ verbose: true })
    .filter((move) => {
      chess.move(move);
      const mate = chess.isCheckmate();
      chess.undo();
      return mate;
    })
    .map((move) => move.lan);
}

describe("perft fixtures", () => {
  for (const perftCase of PERFT_CASES) {
    it(`${perftCase.name}: depths 1-2 match chess.js`, () => {
      const chess = new Chess(perftCase.fen);
      for (const depth of fastDepths(perftCase).filter((d) => d <= 2)) {
        expect(chess.perft(depth)).toBe(perftCase.counts[depth - 1]);
      }
    });
  }
});

describe("mate fixtures", () => {
  it("has at least 10 mates in 1 and 10 mates in 2", () => {
    expect(MATE_IN_1.length).toBeGreaterThanOrEqual(10);
    expect(MATE_IN_2.length).toBeGreaterThanOrEqual(10);
  });

  for (const puzzle of MATE_IN_1) {
    it(`mate in 1: ${puzzle.fen}`, () => {
      expect(matingMoves(new Chess(puzzle.fen)).sort()).toEqual([...puzzle.solutions].sort());
    });
  }

  for (const puzzle of MATE_IN_2) {
    it(`mate in 2: ${puzzle.fen}`, () => {
      const chess = new Chess(puzzle.fen);
      expect(matingMoves(chess)).toEqual([]);
      for (const key of puzzle.solutions) {
        chess.move(key);
        const replies = chess.moves({ verbose: true });
        expect(replies.length).toBeGreaterThan(0);
        for (const reply of replies) {
          chess.move(reply);
          expect(matingMoves(chess).length).toBeGreaterThan(0);
          chess.undo();
        }
        chess.undo();
      }
    });
  }
});

describe("randomPositions", () => {
  it("is deterministic and replayable", { timeout: 30_000 }, () => {
    const a = randomPositions({ count: 300, seed: 1 });
    const b = randomPositions({ count: 300, seed: 1 });
    expect(a).toEqual(b);
    expect(a).toHaveLength(300);
    for (const position of a.slice(0, 50)) {
      const chess = new Chess(position.startFen);
      for (const uci of position.uciMoves) chess.move(uci);
      expect(chess.fen()).toBe(position.fen);
    }
  });
});
