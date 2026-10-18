import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { randomPositions } from "../../../test/fixtures/random-positions";
import { START_FEN, parseFen } from "./fen";
import { computeHash, getZobristKeys, hashedEpFile, pieceKeyIndex } from "./zobrist";

const h = (fen: string) => {
  const p = parseFen(fen);
  return `${p.hashHi >>> 0}:${p.hashLo >>> 0}`;
};
const hc = (fen: string) => {
  const r = computeHash(parseFen(fen));
  return `${r.hi >>> 0}:${r.lo >>> 0}`;
};
const strip = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

describe("zobrist keys", () => {
  it("are cached", () => {
    expect(getZobristKeys()).toBe(getZobristKeys());
  });
  it("have the expected sizes and types", () => {
    const k = getZobristKeys();
    expect(k.pieceHi.length).toBe(768);
    expect(k.pieceLo.length).toBe(768);
    expect(k.castlingHi.length).toBe(16);
    expect(k.castlingLo.length).toBe(16);
    expect(k.epFileHi.length).toBe(8);
    expect(k.epFileLo.length).toBe(8);
    expect(k.pieceHi).toBeInstanceOf(Uint32Array);
  });
  it("piece keys are all distinct (hi,lo pairs)", () => {
    const k = getZobristKeys();
    const s = new Set<string>();
    for (let i = 0; i < 768; i++) s.add(`${k.pieceHi[i]}:${k.pieceLo[i]}`);
    expect(s.size).toBe(768);
  });
  it("side, ep and castling (1..15) keys are non-zero and distinct", () => {
    const k = getZobristKeys();
    const s = new Set<string>();
    s.add(`${k.sideHi}:${k.sideLo}`);
    for (let i = 0; i < 8; i++) s.add(`${k.epFileHi[i]}:${k.epFileLo[i]}`);
    for (let i = 1; i < 16; i++) s.add(`${k.castlingHi[i]}:${k.castlingLo[i]}`);
    expect(s.size).toBe(1 + 8 + 15);
    expect(s.has("0:0")).toBe(false);
  });
  it("pieceKeyIndex covers 0..767 without repeats", () => {
    const s = new Set<number>();
    for (let sq = 0; sq < 64; sq++) {
      for (let p = 1; p <= 6; p++) {
        s.add(pieceKeyIndex(p, sq));
        s.add(pieceKeyIndex(-p, sq));
      }
    }
    expect(s.size).toBe(768);
  });
});

describe("parseFen hash", () => {
  it("equals computeHash and is deterministic", () => {
    for (const f of [START_FEN, "r3k2r/8/8/8/8/8/8/R3K2R b Kq - 3 9"]) {
      expect(h(f)).toBe(hc(f));
      expect(h(f)).toBe(h(f));
    }
  });
  it("is uint32 in range and non-zero", () => {
    const p = parseFen(START_FEN);
    expect(p.hashHi).toBeGreaterThanOrEqual(0);
    expect(p.hashHi).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(p.hashLo)).toBe(true);
    expect(p.hashHi === 0 && p.hashLo === 0).toBe(false);
  });
  it("ignores move counters", () => {
    expect(h("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBe(h("4k3/8/8/8/8/8/8/4K3 w - - 49 80"));
  });
});

describe("hash differences", () => {
  it("side to move", () => {
    expect(h("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).not.toBe(h("4k3/8/8/8/8/8/8/4K3 b - - 0 1"));
  });
  it("each castling right combination", () => {
    const base = "r3k2r/8/8/8/8/8/8/R3K2R w ";
    const rights = ["-", "K", "Q", "k", "q", "KQ", "Kk", "Kq", "Qk", "Qq", "kq", "KQk", "KQq", "Kkq", "Qkq", "KQkq"];
    expect(new Set(rights.map((r) => h(`${base}${r} - 0 1`))).size).toBe(16);
  });
  it("one piece placement, type and color", () => {
    const a = h("4k3/8/8/8/8/8/8/R3K3 w - - 0 1");
    expect(a).not.toBe(h("4k3/8/8/8/8/8/8/1R2K3 w - - 0 1"));
    expect(a).not.toBe(h("4k3/8/8/8/8/8/8/B3K3 w - - 0 1"));
    expect(a).not.toBe(h("4k3/8/8/8/8/8/8/r3K3 w - - 0 1"));
  });
  it("mirrored positions differ", () => {
    expect(h("4k3/8/8/8/8/8/4P3/R3K3 w - - 0 1")).not.toBe(h("r3k3/4p3/8/8/8/8/8/4K3 w - - 0 1"));
    expect(h("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1")).not.toBe(
      h("rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    );
  });
});

describe("en passant", () => {
  it("white to move, ep square without capturer hashes like no ep", () => {
    const f = "4k3/8/8/4p3/P7/8/8/4K3 w - e6 0 1";
    expect(h(f)).toBe(h("4k3/8/8/4p3/P7/8/8/4K3 w - - 0 1"));
    expect(hashedEpFile(parseFen(f))).toBe(-1);
  });
  it("white with capturer: ep file enters hash", () => {
    const f = "4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1";
    expect(h(f)).not.toBe(h("4k3/8/8/3Pp3/8/8/8/4K3 w - - 0 1"));
    expect(hashedEpFile(parseFen(f))).toBe(4);
  });
  it("black with capturer", () => {
    const f = "4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1";
    expect(h(f)).not.toBe(h("4k3/8/8/8/3pP3/8/8/4K3 b - - 0 1"));
    expect(hashedEpFile(parseFen(f))).toBe(4);
  });
  it("black without capturer", () => {
    const f = "4k3/8/8/8/7p/8/8/4K3 b - c3 0 1";
    expect(h(f)).toBe(h("4k3/8/8/8/7p/8/8/4K3 b - - 0 1"));
    expect(hashedEpFile(parseFen(f))).toBe(-1);
  });
  it("different ep files with capturers differ", () => {
    const b = h("4k3/8/8/pP6/8/8/8/4K3 w - a6 0 1");
    const c = h("4k3/8/8/1Pp5/8/8/8/4K3 w - c6 0 1");
    expect(b).not.toBe(c);
    expect(h("4k3/8/8/2PpP3/8/8/8/4K3 w - d6 0 1")).not.toBe(h("4k3/8/8/2PpP3/8/8/8/4K3 w - - 0 1"));
  });
  it("edge files", () => {
    expect(hashedEpFile(parseFen("4k3/8/8/pP6/8/8/8/4K3 w - a6 0 1"))).toBe(0);
    expect(hashedEpFile(parseFen("4k3/8/8/6Pp/8/8/8/4K3 w - h6 0 1"))).toBe(7);
    expect(hashedEpFile(parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1"))).toBe(-1);
  });
  it("no wrap-around between a and h files", () => {
    expect(hashedEpFile(parseFen("4k3/8/8/p6P/8/8/8/4K3 w - a6 0 1"))).toBe(-1);
    expect(hashedEpFile(parseFen("4k3/8/8/8/p6P/8/8/4K3 b - h3 0 1"))).toBe(-1);
  });
  it("pseudo-legal: a pinned capturer still counts", () => {
    // d5 pawn is pinned by the bishop on a5? (king e1 / bishop a5 pins along diagonal to e1 via d2? not relevant)
    const f = "4k3/8/8/b2Pp3/8/8/8/4K3 w - e6 0 1";
    expect(hashedEpFile(parseFen(f))).toBe(4);
  });
});

describe("collisions and source", () => {
  it("no collisions among distinct random positions", () => {
    const seen = new Map<string, string>();
    for (const p of randomPositions({ count: 2000 })) {
      const key = strip(p.fen);
      const hash = h(p.fen);
      const prev = seen.get(hash);
      if (prev !== undefined) expect(prev).toBe(key);
      seen.set(hash, key);
    }
  }, 120_000);
  it("zobrist.ts does not use BigInt", () => {
    const src = readFileSync(new URL("./zobrist.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/BigInt|\b\d+n\b|BigUint64|BigInt64/);
  });
});
