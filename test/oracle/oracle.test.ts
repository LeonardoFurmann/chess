import { describe, expect, it } from "vitest";
import { compareLine, emptyStats, runOracle } from "./oracle";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("oracle: engine vs chess.js (public API)", () => {
  it("agrees on 2,000+ positions from seeded random games", { timeout: 120_000 }, () => {
    const started = Date.now();
    const { stats, divergences } = runOracle(2_000);
    const seconds = (Date.now() - started) / 1000;
    console.info(`oracle fast: ${stats.positions} positions in ${seconds.toFixed(1)} s`, stats);

    expect(divergences.join("\n\n")).toBe("");
    expect(stats.positions).toBeGreaterThanOrEqual(2_000);
    expect(stats.checks).toBeGreaterThan(0);
    expect(stats.checkmates).toBeGreaterThan(0);
    expect(seconds).toBeLessThan(60);
  });

  it("agrees on threefold repetition along a knight shuffle", () => {
    const stats = emptyStats();
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    expect(compareLine(START, [...shuffle, ...shuffle, ...shuffle], stats).join("\n\n")).toBe("");
    expect(stats.threefold).toBeGreaterThan(0);
  });

  it("agrees on the fifty-move rule along a rook shuffle", () => {
    const stats = emptyStats();
    const fen = "4k3/8/8/8/8/8/8/R3K3 w - - 94 80";
    const line = ["a1a2", "e8d8", "a2a1", "d8e8", "a1a2", "e8d8", "a2a1", "d8e8"];
    expect(compareLine(fen, line, stats).join("\n\n")).toBe("");
    expect(stats.fiftyMove).toBeGreaterThan(0);
  });

  it("agrees on en passant, castling and promotion lines", () => {
    const line = ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6", "g8f6", "g1f3", "e7e6", "f1e2", "f8e7", "e1g1", "e8g8"];
    expect(compareLine(START, line).join("\n\n")).toBe("");
    const promo = ["a7a8q", "e8d7", "a8a7", "d7e8"];
    expect(compareLine("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", promo).join("\n\n")).toBe("");
  });
});
