import type { Level } from "./protocol";
import type { SearchOptions } from "./search";

/** Search options for each level (docs/SPEC.md §5.2). `seed` feeds the easy level's randomness. */
export function levelOptions(level: Level, seed?: number): SearchOptions {
  throw new Error("not implemented");
}
