import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
/* eslint-disable @typescript-eslint/no-restricted-imports */
import { PERFT_CASES } from "../../../test/fixtures/perft";
import { randomPositions } from "../../../test/fixtures/random-positions";
/* eslint-enable @typescript-eslint/no-restricted-imports */
import { parseSquare, squareName } from "./board";
import { START_FEN, parseFen } from "./fen";
import {
  MOVE_CAPTURE,
  MOVE_CASTLE_KING,
  MOVE_CASTLE_QUEEN,
  MOVE_DOUBLE_PUSH,
  MOVE_EN_PASSANT,
  MOVE_PROMOTION,
  hasFlag,
  moveFrom,
  movePromotion,
  moveTo,
} from "./move";
import { generatePseudoLegalMoves } from "./movegen";
import { BISHOP, KING, KNIGHT, QUEEN, ROOK } from "./types";
import type { Move } from "./types";

const PROMO_LETTER: Record<number, string> = { [KNIGHT]: "n", [BISHOP]: "b", [ROOK]: "r", [QUEEN]: "q" };

function uci(move: Move): string {
  const promo = movePromotion(move);
  return squareName(moveFrom(move)) + squareName(moveTo(move)) + (promo ? PROMO_LETTER[promo] : "");
}

function gen(fen: string): Move[] {
  return generatePseudoLegalMoves(parseFen(fen));
}

function ucis(fen: string): string[] {
  return gen(fen).map(uci).sort();
}

function find(moves: Move[], text: string): Move | undefined {
  return moves.find((m) => uci(m) === text);
}

describe("generatePseudoLegalMoves", () => {
  it("generates 20 moves from the initial position", () => {
    expect(gen(START_FEN)).toHaveLength(20);
  });

  it("flags double pushes", () => {
    const moves = gen(START_FEN);
    expect(moves.filter((m) => hasFlag(m, MOVE_DOUBLE_PUSH))).toHaveLength(8);
    expect(hasFlag(find(moves, "e2e3")!, MOVE_DOUBLE_PUSH)).toBe(false);
  });

  it("generates 12 promotion moves for a pawn with a free square and two captures", () => {
    const moves = gen("r1b1k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
    const promos = moves.filter((m) => hasFlag(m, MOVE_PROMOTION));
    expect(promos).toHaveLength(12);
    expect(promos.filter((m) => hasFlag(m, MOVE_CAPTURE))).toHaveLength(8);
    const kinds = new Set(promos.filter((m) => moveTo(m) === parseSquare("b8")).map(movePromotion));
    expect(kinds).toEqual(new Set([QUEEN, ROOK, BISHOP, KNIGHT]));
  });

  it("generates black promotions in the right direction", () => {
    const moves = gen("4k3/8/8/8/8/8/1p6/R1B1K3 b - - 0 1");
    expect(moves.filter((m) => hasFlag(m, MOVE_PROMOTION))).toHaveLength(12);
  });

  describe("en passant", () => {
    it("is generated with an ep square and an adjacent pawn", () => {
      const moves = gen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
      const ep = find(moves, "e5d6")!;
      expect(hasFlag(ep, MOVE_EN_PASSANT)).toBe(true);
      expect(hasFlag(ep, MOVE_CAPTURE)).toBe(true);
    });

    it("is not generated without an ep square", () => {
      const moves = gen("4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1");
      expect(find(moves, "e5d6")).toBeUndefined();
    });

    it("is not generated when the pawn is not adjacent or on the wrong rank", () => {
      expect(find(gen("4k3/8/8/3p4/8/4P3/8/4K3 w - d6 0 1"), "e3d6")).toBeUndefined();
      expect(find(gen("4k3/8/8/3p4/4P3/8/8/4K3 w - d6 0 1"), "e4d6")).toBeUndefined();
    });

    it("works on the a and h files", () => {
      expect(hasFlag(find(gen("4k3/8/8/Pp6/8/8/8/4K3 w - b6 0 1"), "a5b6")!, MOVE_EN_PASSANT)).toBe(true);
      expect(hasFlag(find(gen("4k3/8/8/6pP/8/8/8/4K3 w - g6 0 1"), "h5g6")!, MOVE_EN_PASSANT)).toBe(true);
    });

    it("works for black", () => {
      const moves = gen("4k3/8/8/8/pP6/8/8/4K3 b - b3 0 1");
      expect(hasFlag(find(moves, "a4b3")!, MOVE_EN_PASSANT)).toBe(true);
    });

    it("does not wrap around the board edge", () => {
      expect(find(gen("4k3/8/8/7P/8/8/8/4K3 w - a6 0 1"), "h5a6")).toBeUndefined();
    });
  });

  describe("double push", () => {
    it("is blocked by a piece on the intermediate square", () => {
      const moves = ucis("4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1");
      expect(moves).not.toContain("e2e3");
      expect(moves).not.toContain("e2e4");
    });

    it("is blocked by a piece on the final square", () => {
      const moves = ucis("4k3/8/8/8/4n3/8/4P3/4K3 w - - 0 1");
      expect(moves).toContain("e2e3");
      expect(moves).not.toContain("e2e4");
    });

    it("works for black", () => {
      const moves = gen("4k3/4p3/8/8/8/8/8/4K3 b - - 0 1");
      expect(hasFlag(find(moves, "e7e5")!, MOVE_DOUBLE_PUSH)).toBe(true);
    });
  });

  describe("castling", () => {
    it("generates both castles for white in Kiwipete", () => {
      const moves = gen(PERFT_CASES.find((c) => c.name === "kiwipete")!.fen);
      expect(hasFlag(find(moves, "e1g1")!, MOVE_CASTLE_KING)).toBe(true);
      expect(hasFlag(find(moves, "e1c1")!, MOVE_CASTLE_QUEEN)).toBe(true);
    });

    it("generates black castles", () => {
      const moves = gen("r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1");
      expect(find(moves, "e8g8")).toBeDefined();
      expect(find(moves, "e8c8")).toBeDefined();
    });

    it("respects missing rights", () => {
      const moves = ucis("r3k2r/8/8/8/8/8/8/R3K2R w Kq - 0 1");
      expect(moves).toContain("e1g1");
      expect(moves).not.toContain("e1c1");
      const black = ucis("r3k2r/8/8/8/8/8/8/R3K2R b Kq - 0 1");
      expect(black).toContain("e8c8");
      expect(black).not.toContain("e8g8");
    });

    it("is blocked by a piece between king and rook", () => {
      expect(ucis("4k3/8/8/8/8/8/8/R3K1NR w KQ - 0 1")).not.toContain("e1g1");
      expect(ucis("4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1")).not.toContain("e1c1");
      expect(ucis("4k3/8/8/8/8/8/8/R1B1K2R w KQ - 0 1")).not.toContain("e1c1");
      expect(ucis("4k3/8/8/8/8/8/8/R2QK2R w KQ - 0 1")).not.toContain("e1c1");
      expect(ucis("4k3/8/8/8/8/8/8/R3KB1R w KQ - 0 1")).not.toContain("e1g1");
    });

    it("is not generated when the rook is missing", () => {
      const moves = ucis("4k3/8/8/8/8/8/8/4K2R w KQ - 0 1");
      expect(moves).toContain("e1g1");
      expect(moves).not.toContain("e1c1");
    });
  });

  it("generates sliding moves from the edges", () => {
    const moves = gen("4k3/8/8/8/8/8/8/Q3K3 w - - 0 1");
    // File a up (7) and rank 1 to the east up to the king (3: b1, c1, d1) and diagonal (7).
    expect(moves.filter((m) => moveFrom(m) === parseSquare("a1"))).toHaveLength(7 + 3 + 7);
  });

  it("flags captures and never captures own pieces", () => {
    const moves = gen("4k3/8/8/8/3n4/8/8/R2QK3 w - - 0 1");
    expect(find(moves, "a1d1")).toBeUndefined();
    expect(hasFlag(find(moves, "d1d4")!, MOVE_CAPTURE)).toBe(true);
    expect(find(moves, "d1d5")).toBeUndefined();
  });

  it("does not generate own-piece or king captures in fixture positions", () => {
    for (const c of PERFT_CASES) {
      const pos = parseFen(c.fen);
      const enemyKing = -pos.sideToMove * KING;
      for (const m of generatePseudoLegalMoves(pos)) {
        const target = pos.board[moveTo(m)];
        expect(target).not.toBe(enemyKing);
        expect(target * pos.sideToMove).toBeLessThanOrEqual(0);
      }
    }
  });

  it("is a superset of the chess.js legal moves on random positions", () => {
    for (const rp of randomPositions({ count: 200 })) {
      const mine = new Set(ucis(rp.fen));
      for (const m of new Chess(rp.fen).moves({ verbose: true })) {
        const text = m.from + m.to + (m.promotion ?? "");
        expect(mine.has(text), `${text} missing in ${rp.fen}`).toBe(true);
      }
    }
  }, 60_000);
});
