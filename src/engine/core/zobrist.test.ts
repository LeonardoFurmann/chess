import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { randomPositions } from "../../../test/fixtures/random-positions";
import { START_FEN, parseFen } from "./fen";
import { computeHash, getZobristKeys, hashedEpFile, pieceKeyIndex } from "./zobrist";

const hashOf = (fen: string): string => {
  const h = computeHash(parseFen(fen));
  return `${h.hi}:${h.lo}`;
};

describe("zobrist keys", () => {
  it("are cached and deterministic", () => {
    expect(getZobristKeys()).toBe(getZobristKeys());
    const keys = getZobristKeys();
    expect(keys.pieceHi).toHaveLength(768);
    expect(keys.epFileLo).toHaveLength(8);
  });

  it("piece keys are all distinct", () => {
    const keys = getZobristKeys();
    const seen = new Set<string>();
    for (let i = 0; i < 768; i++) seen.add(`${keys.pieceHi[i]}:${keys.pieceLo[i]}`);
    expect(seen.size).toBe(768);
    expect(pieceKeyIndex(1, 0)).toBe(0);
    expect(pieceKeyIndex(-6, 63)).toBe(11 * 64 + 63);
  });
});

describe("computeHash", () => {
  it("is deterministic and stored by parseFen", () => {
    const a = parseFen(START_FEN);
    const b = parseFen(START_FEN);
    expect(a.hashHi).toBe(b.hashHi);
    expect(a.hashLo).toBe(b.hashLo);
    expect(computeHash(a)).toEqual({ hi: a.hashHi, lo: a.hashLo });
    expect(a.hashHi).toBeGreaterThanOrEqual(0);
  });

  it("ignores the move counters", () => {
    expect(hashOf("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBe(hashOf("4k3/8/8/8/8/8/8/4K3 w - - 40 77"));
  });

  it("differs by side to move", () => {
    expect(hashOf("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).not.toBe(hashOf("4k3/8/8/8/8/8/8/4K3 b - - 0 1"));
  });

  it("differs by a single castling right", () => {
    const fens = ["KQkq", "KQk", "KQq", "Kkq", "Qkq", "Kq", "-"].map(
      (c) => `r3k2r/8/8/8/8/8/8/R3K2R w ${c} - 0 1`,
    );
    expect(new Set(fens.map(hashOf)).size).toBe(fens.length);
  });

  it("differs by piece placement", () => {
    const base = hashOf("4k3/8/8/8/8/8/8/3QK3 w - - 0 1");
    expect(base).not.toBe(hashOf("4k3/8/8/8/8/8/8/2Q1K3 w - - 0 1"));
    expect(base).not.toBe(hashOf("4k3/8/8/8/8/8/8/3RK3 w - - 0 1"));
    expect(base).not.toBe(hashOf("4k3/8/8/8/8/8/8/3qK3 w - - 0 1"));
  });

  it("differs between mirrored positions", () => {
    expect(hashOf("4k3/p7/8/8/8/8/P7/4K3 w - - 0 1")).not.toBe(hashOf("4k3/p7/8/8/8/8/P7/4K3 b - - 0 1"));
    expect(hashOf("4k3/p7/8/8/8/8/7P/4K3 w - - 0 1")).not.toBe(hashOf("4k3/7p/8/8/8/8/P7/4K3 w - - 0 1"));
  });
});

describe("en passant in the hash", () => {
  it("is ignored when no pawn can capture (white double push)", () => {
    const withEp = "4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1";
    const without = "4k3/8/8/8/4P3/8/8/4K3 b - - 0 1";
    expect(hashOf(withEp)).toBe(hashOf(without));
    expect(hashedEpFile(parseFen(withEp))).toBe(-1);
  });

  it("is ignored when no pawn can capture (black double push)", () => {
    expect(hashOf("4k3/4p3/8/8/8/8/8/4K3 w - e6 0 1")).toBe(hashOf("4k3/4p3/8/8/8/8/8/4K3 w - - 0 1"));
  });

  it("counts when a black pawn can capture", () => {
    const withEp = "4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1";
    expect(hashedEpFile(parseFen(withEp))).toBe(4);
    expect(hashOf(withEp)).not.toBe(hashOf("4k3/8/8/8/3pP3/8/8/4K3 b - - 0 1"));
  });

  it("counts when a white pawn can capture, from either side", () => {
    const left = "4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1";
    const right = "4k3/8/8/4pP2/8/8/8/4K3 w - e6 0 1";
    expect(hashedEpFile(parseFen(left))).toBe(4);
    expect(hashedEpFile(parseFen(right))).toBe(4);
    expect(hashOf(left)).not.toBe(hashOf("4k3/8/8/3Pp3/8/8/8/4K3 w - - 0 1"));
  });

  it("differs by en passant file", () => {
    const a = "4k3/8/8/8/1pP1pP2/8/8/4K3 b - c3 0 1";
    const b = "4k3/8/8/8/1pP1pP2/8/8/4K3 b - f3 0 1";
    expect(hashOf(a)).not.toBe(hashOf(b));
  });

  it("does not count a pawn of the wrong color or on the wrong rank", () => {
    expect(hashedEpFile(parseFen("4k3/8/8/8/3PP3/8/8/4K3 b - e3 0 1"))).toBe(-1);
    expect(hashedEpFile(parseFen("4k3/8/8/8/4P3/3p4/8/4K3 b - e3 0 1"))).toBe(-1);
  });
});

describe("collisions", () => {
  it("has none among distinct random positions", () => {
    const byHash = new Map<string, string>();
    for (const { fen } of randomPositions({ count: 5000 })) {
      const key = fen.split(" ").slice(0, 4).join(" ");
      const h = hashOf(fen);
      const previous = byHash.get(h);
      if (previous !== undefined) expect(previous).toBe(key);
      byHash.set(h, key);
    }
    expect(byHash.size).toBeGreaterThan(1000);
  });
});
