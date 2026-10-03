import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it("differs across seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.nextUint32());
    const seqB = Array.from({ length: 10 }, () => b.nextUint32());
    expect(seqA).not.toEqual(seqB);
  });

  it("keeps values in range", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const u = rng.nextUint32();
      expect(Number.isInteger(u) && u >= 0 && u < 2 ** 32).toBe(true);
      const f = rng.next();
      expect(f >= 0 && f < 1).toBe(true);
      const n = rng.nextInt(6);
      expect(Number.isInteger(n) && n >= 0 && n < 6).toBe(true);
    }
  });
});
