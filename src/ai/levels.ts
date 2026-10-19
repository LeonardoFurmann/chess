import { createRng } from "@/engine/core";
import type { Level } from "./protocol";
import type { SearchOptions } from "./search";

/** Search options for each level (docs/SPEC.md §5.2). `seed` feeds the easy level's randomness. */
export function levelOptions(level: Level, seed?: number): SearchOptions {
  switch (level) {
    case 1:
      return {
        maxDepth: 2,
        randomMarginCp: 150,
        rng: createRng(seed ?? Math.floor(Math.random() * 0x1_0000_0000)),
      };
    case 2:
      return { timeLimitMs: 500 };
    case 3:
      return { timeLimitMs: 2000 };
    default:
      throw new Error(`Unknown level: ${String(level)}`);
  }
}
