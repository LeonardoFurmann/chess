import { describe, expect, it } from "vitest";
import { levelOptions } from "./levels";

describe("levelOptions", () => {
  it("level 1 is shallow and randomized", () => {
    const options = levelOptions(1, 7);
    expect(options.maxDepth).toBe(2);
    expect(options.randomMarginCp).toBe(150);
    expect(options.rng).toBeDefined();
    expect(options.timeLimitMs).toBeUndefined();
  });

  it("level 1 rng is determined by the seed", () => {
    const a = levelOptions(1, 5).rng!;
    const b = levelOptions(1, 5).rng!;
    const c = levelOptions(1, 6).rng!;
    expect(a.nextUint32()).toBe(b.nextUint32());
    expect(a.nextUint32()).toBe(b.nextUint32());
    expect(levelOptions(1, 5).rng!.nextUint32()).not.toBe(c.nextUint32());
  });

  it("levels 2 and 3 use time limits", () => {
    expect(levelOptions(2).timeLimitMs).toBe(500);
    expect(levelOptions(3).timeLimitMs).toBe(2000);
    expect(levelOptions(2).randomMarginCp).toBeUndefined();
    expect(levelOptions(3).maxDepth).toBeUndefined();
  });
});
