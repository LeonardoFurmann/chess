import { describe, expect, it } from "vitest";
import { START_FEN, parseFen } from "./fen";
import { perft } from "./perft";

describe("perft(5) timing", () => {
  it("initial position perft(5) is 4865609 in under 15 s", () => {
    const pos = parseFen(START_FEN);
    const t0 = performance.now();
    const n = perft(pos, 5);
    const ms = performance.now() - t0;
    console.log(`PERFT5_MS=${Math.round(ms)}`);
    expect(n).toBe(4865609);
    expect(ms).toBeLessThan(15000);
  }, 60000);
});
