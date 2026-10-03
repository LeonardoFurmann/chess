import { describe, expect, it } from "vitest";
import {
  MOVE_CAPTURE,
  MOVE_CASTLE_QUEEN,
  MOVE_DOUBLE_PUSH,
  MOVE_EN_PASSANT,
  MOVE_PROMOTION,
  encodeMove,
  hasFlag,
  moveFlags,
  moveFrom,
  movePromotion,
  moveTo,
} from "./move";
import { KNIGHT, QUEEN } from "./types";

describe("move encoding", () => {
  it("round-trips every from/to pair", () => {
    for (let from = 0; from < 64; from++) {
      for (let to = 0; to < 64; to++) {
        const move = encodeMove(from, to);
        expect(moveFrom(move)).toBe(from);
        expect(moveTo(move)).toBe(to);
        expect(movePromotion(move)).toBe(0);
        expect(moveFlags(move)).toBe(0);
      }
    }
  });

  it("stores flags and promotion independently", () => {
    const move = encodeMove(52, 61, MOVE_CAPTURE, KNIGHT);
    expect(moveFrom(move)).toBe(52);
    expect(moveTo(move)).toBe(61);
    expect(movePromotion(move)).toBe(KNIGHT);
    expect(hasFlag(move, MOVE_CAPTURE)).toBe(true);
    expect(hasFlag(move, MOVE_PROMOTION)).toBe(true);
    expect(hasFlag(move, MOVE_EN_PASSANT)).toBe(false);
  });

  it("sets the promotion flag only when a promotion kind is given", () => {
    expect(hasFlag(encodeMove(48, 56, 0, QUEEN), MOVE_PROMOTION)).toBe(true);
    expect(hasFlag(encodeMove(8, 24, MOVE_DOUBLE_PUSH), MOVE_PROMOTION)).toBe(false);
  });

  it("keeps all flags", () => {
    const all = MOVE_CAPTURE | MOVE_DOUBLE_PUSH | MOVE_EN_PASSANT | MOVE_CASTLE_QUEEN;
    expect(moveFlags(encodeMove(4, 2, all))).toBe(all);
  });

  it("produces non-negative numbers", () => {
    expect(encodeMove(63, 63, 63, QUEEN)).toBeGreaterThanOrEqual(0);
  });
});
