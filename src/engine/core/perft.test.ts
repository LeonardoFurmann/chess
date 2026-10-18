import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
/* eslint-disable @typescript-eslint/no-restricted-imports */
import { PERFT_CASES, fastDepths } from "../../../test/fixtures/perft";
/* eslint-enable @typescript-eslint/no-restricted-imports */
import { parseFen } from "./fen";
import { perft, perftDivide } from "./perft";

// Fast-suite depths required by T1.6 (the node budget alone would allow deeper ones).
const MAX_DEPTH: Record<string, number> = {
  initial: 4,
  kiwipete: 3,
  "position 3": 4,
  "position 4": 4,
  "position 5": 3,
  "position 6": 3,
};

describe("perft (fast suite)", () => {
  for (const c of PERFT_CASES) {
    for (const depth of fastDepths(c)) {
      if (depth > (MAX_DEPTH[c.name] ?? 3)) continue;
      it(`${c.name} depth ${depth} = ${c.counts[depth - 1]}`, () => {
        const position = parseFen(c.fen);
        expect(perft(position, depth)).toBe(c.counts[depth - 1]);
        expect(position.history).toHaveLength(0);
      });
    }
  }

  it("perft(0) is 1", () => {
    expect(perft(parseFen(PERFT_CASES[0].fen), 0)).toBe(1);
  });

  it("perftDivide sums to perft", () => {
    const position = parseFen(PERFT_CASES[1].fen);
    const divide = perftDivide(position, 2);
    expect(divide).toHaveLength(48);
    expect(divide.reduce((sum, d) => sum + d.nodes, 0)).toBe(2039);
  });
});
