import { describe, expect, it } from "vitest";
import { runOracle } from "./oracle";

describe("oracle (slow): engine vs chess.js (public API)", () => {
  it("agrees on 20,000+ positions from seeded random games", { timeout: 30 * 60_000 }, () => {
    const started = Date.now();
    const { stats, divergences } = runOracle(20_000);
    const seconds = (Date.now() - started) / 1000;
    console.info(`oracle slow: ${stats.positions} positions in ${seconds.toFixed(1)} s`, stats);

    expect(divergences.join("\n\n")).toBe("");
    expect(stats.positions).toBeGreaterThanOrEqual(20_000);
  });
});
