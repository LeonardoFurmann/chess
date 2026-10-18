import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PERFT_CASES } from "../../../test/fixtures/perft";
import { parseFen } from "./fen";
import { perft } from "./perft";

describe("perft (slow suite)", () => {
  for (const c of PERFT_CASES) {
    c.counts.forEach((expected, i) => {
      const depth = i + 1;
      it(`${c.name} depth ${depth} = ${expected}`, () => {
        expect(perft(parseFen(c.fen), depth)).toBe(expected);
      });
    });
  }

  it("initial position perft(5) takes less than 15 s", () => {
    const position = parseFen(PERFT_CASES[0].fen);
    const start = performance.now();
    const nodes = perft(position, 5);
    const elapsed = performance.now() - start;
    console.log(`perft(5) initial: ${nodes} nodes in ${Math.round(elapsed)} ms`);
    expect(nodes).toBe(4_865_609);
    expect(elapsed).toBeLessThan(15_000);
  });
});
