import { describe, expect, it } from "vitest";
import { parseSquare } from "./board";
import { START_FEN, parseFen } from "./fen";
import { makeMove, unmakeMove } from "./make-move";
import { encodeMove, MOVE_DOUBLE_PUSH } from "./move";
import type { Position } from "./position";
import { repetitionCount } from "./repetition";

function play(position: Position, from: string, to: string, flags = 0): void {
  makeMove(position, encodeMove(parseSquare(from), parseSquare(to), flags));
}

function knightCycle(position: Position): void {
  play(position, "g1", "f3");
  play(position, "g8", "f6");
  play(position, "f3", "g1");
  play(position, "f6", "g8");
}

describe("repetitionCount", () => {
  it("is 1 for a fresh position", () => {
    expect(repetitionCount(parseFen(START_FEN))).toBe(1);
  });

  it("counts 3 after two Nf3 Nf6 Ng1 Ng8 cycles", () => {
    const position = parseFen(START_FEN);
    knightCycle(position);
    expect(repetitionCount(position)).toBe(2);
    knightCycle(position);
    expect(repetitionCount(position)).toBe(3);
  });

  it("does not count positions with the other side to move", () => {
    const position = parseFen(START_FEN);
    play(position, "g1", "f3");
    play(position, "g8", "f6");
    play(position, "f3", "g1");
    expect(repetitionCount(position)).toBe(1);
  });

  it("a pawn move resets the count", () => {
    const position = parseFen(START_FEN);
    knightCycle(position);
    play(position, "e2", "e4", MOVE_DOUBLE_PUSH);
    play(position, "e7", "e5", MOVE_DOUBLE_PUSH);
    knightCycle(position);
    expect(repetitionCount(position)).toBe(2);
  });

  it("goes back down after unmakeMove", () => {
    const position = parseFen(START_FEN);
    knightCycle(position);
    unmakeMove(position);
    expect(repetitionCount(position)).toBe(1);
  });
});
