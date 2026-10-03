/** Deterministic pseudo-random generator (mulberry32). Same seed, same sequence. */
export interface Rng {
  /** Unsigned 32-bit integer. */
  nextUint32(): number;
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  return {
    nextUint32,
    next: () => nextUint32() / 4294967296,
    nextInt: (maxExclusive) => Math.floor((nextUint32() / 4294967296) * maxExclusive),
  };
}
