import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
/* eslint-disable @typescript-eslint/no-restricted-imports */
import { randomPositions } from "../../../test/fixtures/random-positions";
/* eslint-enable @typescript-eslint/no-restricted-imports */
import { parseSquare } from "./board";
import { parseFen, toFen } from "./fen";
import { generateLegalMoves } from "./legal";
import { makeMove, unmakeMove } from "./make-move";
import { hasFlag, moveFrom, movePromotion, moveTo, MOVE_CASTLE_KING } from "./move";
import type { Position } from "./position";
import { BLACK, QUEEN, WHITE } from "./types";
import type { Move } from "./types";
import { computeHash } from "./zobrist";

function snapshot(p: Position): string {
  return JSON.stringify({
    board: Array.from(p.board),
    side: p.sideToMove,
    castling: p.castling,
    ep: p.epSquare,
    half: p.halfmoveClock,
    full: p.fullmoveNumber,
    wk: p.whiteKing,
    bk: p.blackKing,
    hi: p.hashHi,
    lo: p.hashLo,
    history: p.history.length,
  });
}

function findMove(p: Position, from: string, to: string, promotion = 0): Move {
  const move = generateLegalMoves(p).find(
    (m) => moveFrom(m) === parseSquare(from) && moveTo(m) === parseSquare(to) && movePromotion(m) === promotion,
  );
  if (move === undefined) throw new Error(`no legal move ${from}${to}`);
  return move;
}

describe("makeMove / unmakeMove", () => {
  it("round-trips state and keeps the incremental hash exact on random positions", () => {
    const positions = randomPositions({ count: 600 });
    for (const { fen } of positions) {
      const position = parseFen(fen);
      const before = snapshot(position);
      for (const move of generateLegalMoves(position)) {
        makeMove(position, move);
        const hash = computeHash(position);
        if (hash.hi !== position.hashHi || hash.lo !== position.hashLo) {
          throw new Error(`hash mismatch after move ${move} from ${fen}`);
        }
        unmakeMove(position);
        if (snapshot(position) !== before) throw new Error(`unmake mismatch for move ${move} from ${fen}`);
      }
    }
  });

  it("handles castling, en passant and promotion on the board", () => {
    const castle = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const king = generateLegalMoves(castle).find((m) => hasFlag(m, MOVE_CASTLE_KING)) as Move;
    makeMove(castle, king);
    expect(toFen(castle)).toBe("r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1");

    const ep = parseFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2");
    makeMove(ep, findMove(ep, "e5", "d6"));
    expect(toFen(ep)).toBe("4k3/8/3P4/8/8/8/8/4K3 b - - 0 2");

    const promo = parseFen("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    const before = snapshot(promo);
    makeMove(promo, findMove(promo, "a7", "b8", QUEEN));
    expect(toFen(promo)).toBe("1Q2k3/8/8/8/8/8/8/4K3 b - - 0 1");
    unmakeMove(promo);
    expect(snapshot(promo)).toBe(before);
  });

  it("tracks king squares, clocks and side to move", () => {
    const position = parseFen("4k3/8/8/8/8/8/8/4K3 w - - 5 10");
    makeMove(position, findMove(position, "e1", "e2"));
    expect(position.whiteKing).toBe(parseSquare("e2"));
    expect(position.halfmoveClock).toBe(6);
    expect(position.sideToMove).toBe(BLACK);
    makeMove(position, findMove(position, "e8", "e7"));
    expect(position.fullmoveNumber).toBe(11);
    expect(position.sideToMove).toBe(WHITE);
    unmakeMove(position);
    unmakeMove(position);
    expect(toFen(position)).toBe("4k3/8/8/8/8/8/8/4K3 w - - 5 10");
    expect(position.whiteKing).toBe(parseSquare("e1"));
  });

  it("throws on unmake with empty history", () => {
    expect(() => {
      unmakeMove(parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1"));
    }).toThrow();
  });
});
