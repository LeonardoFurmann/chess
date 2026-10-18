import { describe, expect, it } from "vitest";
import { parseFen } from "./fen";
import { clonePosition, createEmptyPosition } from "./position";
import { NO_SQUARE, WHITE } from "./types";

describe("createEmptyPosition", () => {
  it("returns the documented defaults", () => {
    const p = createEmptyPosition();
    expect(p.board).toHaveLength(64);
    expect(p.board.every((v) => v === 0)).toBe(true);
    expect(p.sideToMove).toBe(WHITE);
    expect(p.castling).toBe(0);
    expect(p.epSquare).toBe(NO_SQUARE);
    expect(p.halfmoveClock).toBe(0);
    expect(p.fullmoveNumber).toBe(1);
    expect(p.whiteKing).toBe(NO_SQUARE);
    expect(p.blackKing).toBe(NO_SQUARE);
    expect(p.history).toEqual([]);
  });
});

describe("clonePosition", () => {
  it("produces an independent copy", () => {
    const original = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    original.history.push({
      move: 1,
      captured: 0,
      castling: 15,
      epSquare: NO_SQUARE,
      halfmoveClock: 0,
      hashHi: 1,
      hashLo: 2,
    });
    const copy = clonePosition(original);
    expect(copy).toEqual(original);

    copy.board[0] = 0;
    copy.castling = 0;
    copy.sideToMove = -1;
    copy.history[0].captured = 5;
    copy.history.push(copy.history[0]);

    expect(original.board[0]).toBe(4);
    expect(original.castling).toBe(15);
    expect(original.sideToMove).toBe(WHITE);
    expect(original.history).toHaveLength(1);
    expect(original.history[0].captured).toBe(0);
  });
});
