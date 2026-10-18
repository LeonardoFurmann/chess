import { describe, expect, it } from "vitest";
import { parseSquare } from "./board";
import { START_FEN, parseFen, toFen } from "./fen";
import { generateLegalMoves, inCheck, isCheckmate, isStalemate } from "./legal";
import { makeMove } from "./make-move";
import { hasFlag, moveFrom, moveTo, MOVE_CASTLE_KING, MOVE_CASTLE_QUEEN, MOVE_EN_PASSANT } from "./move";
import type { Move } from "./types";

function castles(fen: string, flag: number): Move[] {
  return generateLegalMoves(parseFen(fen)).filter((m) => hasFlag(m, flag));
}

describe("legal move generation", () => {
  it("has 20 moves at the start", () => {
    expect(generateLegalMoves(parseFen(START_FEN))).toHaveLength(20);
  });

  it("forbids en passant that exposes the king along the rank", () => {
    const moves = generateLegalMoves(parseFen("8/8/8/KPp4r/8/8/8/7k w - c6 0 1"));
    expect(moves.some((m) => hasFlag(m, MOVE_EN_PASSANT))).toBe(false);
  });

  it("allows castling both ways when safe", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(castles(fen, MOVE_CASTLE_KING)).toHaveLength(1);
    expect(castles(fen, MOVE_CASTLE_QUEEN)).toHaveLength(1);
  });

  it("forbids castling out of check", () => {
    const fen = "4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1";
    expect(castles(fen, MOVE_CASTLE_KING | MOVE_CASTLE_QUEEN)).toHaveLength(0);
  });

  it("forbids castling through an attacked square", () => {
    const fen = "5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1";
    expect(castles(fen, MOVE_CASTLE_KING)).toHaveLength(0);
    expect(castles(fen, MOVE_CASTLE_QUEEN)).toHaveLength(1);
  });

  it("forbids castling onto an attacked square", () => {
    expect(castles("6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1", MOVE_CASTLE_KING)).toHaveLength(0);
    expect(castles("2r4k/8/8/8/8/8/8/R3K2R w KQ - 0 1", MOVE_CASTLE_QUEEN)).toHaveLength(0);
  });

  it("allows long castling when only b1 is attacked", () => {
    expect(castles("1r5k/8/8/8/8/8/8/R3K3 w Q - 0 1", MOVE_CASTLE_QUEEN)).toHaveLength(1);
  });

  it("capturing a rook on its home square removes that castling right", () => {
    const position = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const rxh8 = generateLegalMoves(position).find(
      (m) => moveFrom(m) === parseSquare("h1") && moveTo(m) === parseSquare("h8"),
    );
    expect(rxh8).toBeDefined();
    makeMove(position, rxh8 as Move);
    expect(toFen(position).split(" ")[2]).toBe("Qq");
  });
});

describe("check, checkmate and stalemate", () => {
  it("detects the fool's mate", () => {
    const position = parseFen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
    expect(inCheck(position)).toBe(true);
    expect(isCheckmate(position)).toBe(true);
    expect(isStalemate(position)).toBe(false);
  });

  it("detects scholar's mate", () => {
    const position = parseFen("r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4");
    expect(isCheckmate(position)).toBe(true);
  });

  it("detects a classic stalemate", () => {
    const position = parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(inCheck(position)).toBe(false);
    expect(isStalemate(position)).toBe(true);
    expect(isCheckmate(position)).toBe(false);
  });

  it("is neither at the start", () => {
    const position = parseFen(START_FEN);
    expect(isCheckmate(position)).toBe(false);
    expect(isStalemate(position)).toBe(false);
  });
});
