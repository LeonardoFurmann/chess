import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PERFT_CASES } from "../../../test/fixtures/perft";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { randomPositions } from "../../../test/fixtures/random-positions";
import { START_FEN, parseFen, toFen } from "./fen";
import { generateLegalMoves } from "./legal";
import { moveToSan, moveToUci, uciToMove } from "./notation";
import { computeHash } from "./zobrist";

function sanOf(fen: string, uci: string): string {
  const pos = parseFen(fen);
  const move = uciToMove(pos, uci);
  expect(move, `${uci} should be legal in ${fen}`).not.toBeNull();
  return moveToSan(pos, move as number);
}

function chessJsSan(fen: string, uci: string): string {
  const c = new Chess(fen);
  const m = c.moves({ verbose: true }).find((x) => x.lan === uci);
  expect(m, `chess.js lacks ${uci}`).toBeDefined();
  return (m as { san: string }).san;
}

function compareAll(fen: string): void {
  const pos = parseFen(fen);
  const legal = generateLegalMoves(pos);
  const oracle = new Chess(fen).moves({ verbose: true });
  expect(legal.length).toBe(oracle.length);
  for (const m of legal) {
    const uci = moveToUci(m);
    const o = oracle.find((x) => x.lan === uci);
    expect(o, `${uci} in ${fen}`).toBeDefined();
    expect(moveToSan(pos, m), `${uci} in ${fen}`).toBe(o!.san);
    expect(uciToMove(pos, uci), `roundtrip ${uci} in ${fen}`).toBe(m);
  }
}

describe("notation adversarial", () => {
  it("SAN and UCI round trip match chess.js on perft fixtures", () => {
    for (const c of PERFT_CASES) compareAll(c.fen);
  });

  it("SAN matches chess.js on 2000+ random positions", () => {
    for (const p of randomPositions({ count: 2200, seed: 424242 })) compareAll(p.fen);
  }, 180_000);

  it("moveToSan does not change the position", () => {
    for (const p of randomPositions({ count: 150, seed: 99 })) {
      const pos = parseFen(p.fen);
      const fenBefore = toFen(pos);
      const hashBefore = computeHash(pos);
      const histLen = pos.history.length;
      for (const m of generateLegalMoves(pos)) {
        moveToSan(pos, m);
        uciToMove(pos, moveToUci(m));
      }
      expect(toFen(pos)).toBe(fenBefore);
      expect(computeHash(pos)).toEqual(hashBefore);
      expect(pos.history.length).toBe(histLen);
    }
  });

  describe("explicit cases", () => {
    it("basic moves from the start position", () => {
      expect(sanOf(START_FEN, "e2e4")).toBe("e4");
      expect(sanOf(START_FEN, "g1f3")).toBe("Nf3");
    });

    it("file disambiguation Nbd2", () => {
      expect(sanOf("4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1", "b1d2")).toBe("Nbd2");
      expect(sanOf("4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1", "f3d2")).toBe("Nfd2");
    });

    it("rank disambiguation R1e2", () => {
      const f2 = "3k4/8/8/8/4R3/8/8/4R1K1 w - - 0 1";
      expect(sanOf(f2, "e1e2")).toBe("R1e2");
      expect(sanOf(f2, "e4e2")).toBe("R4e2");
      compareAll(f2);
    });

    it("three queens need both file and rank: Qh4e1", () => {
      const fen = "1k6/8/8/8/4Q2Q/8/8/K6Q w - - 0 1";
      expect(sanOf(fen, "h4e1")).toBe("Qh4e1");
      expect(sanOf(fen, "e4e1")).toBe("Qee1");
      expect(sanOf(fen, "h1e1")).toBe("Q1e1");
      compareAll(fen);
    });

    it("pinned piece does not count for disambiguation", () => {
      const fen = "4r1k1/8/8/8/8/4N1N1/8/4K3 w - - 0 1";
      expect(sanOf(fen, "g3f5")).toBe("Nf5");
      expect(chessJsSan(fen, "g3f5")).toBe("Nf5");
      compareAll(fen);
    });

    it("en passant", () => {
      const fen = "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3";
      expect(sanOf(fen, "e5d6")).toBe("exd6");
    });

    it("en passant giving discovered check", () => {
      const fen = "4k3/8/8/3pP3/8/8/8/4R1K1 w - d6 0 1";
      expect(sanOf(fen, "e5d6")).toBe("exd6+");
      compareAll(fen);
    });

    it("en passant illegal by discovered check on own king is not found", () => {
      const fen = "8/8/8/K2pP2r/8/8/8/7k w - d6 0 1";
      expect(uciToMove(parseFen(fen), "e5d6")).toBeNull();
      compareAll(fen);
    });

    it("promotions with check suffixes", () => {
      const fen = "7k/4P3/8/8/8/8/8/6K1 w - - 0 1";
      expect(sanOf(fen, "e7e8q")).toBe("e8=Q+");
      expect(sanOf(fen, "e7e8r")).toBe("e8=R+");
      expect(sanOf(fen, "e7e8b")).toBe("e8=B");
      expect(sanOf(fen, "e7e8n")).toBe("e8=N");
      compareAll(fen);
    });

    it("underpromotion to a knight with check", () => {
      const fen = "8/4P1k1/8/8/8/8/8/4K3 w - - 0 1";
      expect(sanOf(fen, "e7e8n")).toBe("e8=N+");
      compareAll(fen);
    });

    it("promotion with capture", () => {
      const fen = "3r2k1/4P3/8/8/8/8/8/6K1 w - - 0 1";
      expect(sanOf(fen, "e7d8q")).toBe("exd8=Q+");
      compareAll(fen);
    });

    it("promotion giving mate", () => {
      const fen = "7k/5P2/6K1/8/8/8/8/8 w - - 0 1";
      expect(sanOf(fen, "f7f8q")).toBe("f8=Q#");
      const mate = "7k/5K2/6P1/8/8/8/8/8 w - - 0 1";
      compareAll(mate);
      const back = "6k1/5ppp/8/8/8/8/4P3/R3K3 w - - 0 1";
      compareAll(back);
      const pm = "5rk1/4P1pp/8/8/8/8/8/6K1 w - - 0 1";
      compareAll(pm);
    });

    it("castling kingside with check", () => {
      const fen = "5k2/8/8/8/8/8/8/4K2R w K - 0 1";
      expect(sanOf(fen, "e1g1")).toBe("O-O+");
    });

    it("castling queenside with mate", () => {
      const fen = "2rkr3/2p1p3/8/8/8/8/8/R3K3 w Q - 0 1";
      expect(sanOf(fen, "e1c1")).toBe("O-O-O#");
    });

    it("plain castling and black castling", () => {
      const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
      expect(sanOf(fen, "e1g1")).toBe("O-O");
      expect(sanOf(fen, "e1c1")).toBe("O-O-O");
      const b = "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1";
      expect(sanOf(b, "e8g8")).toBe("O-O");
      expect(sanOf(b, "e8c8")).toBe("O-O-O");
    });

    it("checkmate suffix on ordinary move", () => {
      const fen = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2";
      expect(sanOf(fen, "d8h4")).toBe("Qh4#");
    });
  });

  describe("moveToUci", () => {
    it("formats moves, promotions and castling", () => {
      const pos = parseFen("r3k2r/1P6/8/8/8/8/8/R3K2R w KQkq - 0 1");
      const ucis = generateLegalMoves(pos).map(moveToUci);
      expect(ucis).toContain("e1g1");
      expect(ucis).toContain("e1c1");
      expect(ucis).toContain("b7b8q");
      expect(ucis).toContain("b7b8n");
      expect(ucis).toContain("b7a8q");
      expect(ucis).not.toContain("e1h1");
    });
  });

  describe("uciToMove", () => {
    const start = () => parseFen(START_FEN);
    it("returns null for illegal and malformed strings", () => {
      const bad = ["e2e5", "zz99", "", "e2", "e2e", "e2e4qq", "e2e4q", "e2e4 ", " e2e4", "E2E4", "e2E4", "e7e5", "a1a1", "e2e4e5", "e2-e4", "0000"];
      for (const s of bad) expect(uciToMove(start(), s), JSON.stringify(s)).toBeNull();
    });

    it("promotion handling", () => {
      const p = parseFen("k7/4P3/8/8/8/8/8/4K3 w - - 0 1");
      expect(uciToMove(p, "e7e8")).toBeNull();
      expect(uciToMove(p, "e7e8k")).toBeNull();
      expect(uciToMove(p, "e7e8p")).toBeNull();
      expect(uciToMove(p, "e7e8x")).toBeNull();
      expect(uciToMove(p, "e7e8qq")).toBeNull();
      for (const c of ["q", "r", "b", "n"]) expect(uciToMove(p, "e7e8" + c)).not.toBeNull();
      expect(moveToUci(uciToMove(p, "e7e8q") as number)).toBe("e7e8q");
    });

    it("promotion letter on a non-promotion move is rejected", () => {
      const p = parseFen("k7/4P3/8/8/8/8/4N3/4K3 w - - 0 1");
      expect(uciToMove(p, "e2c3q")).toBeNull();
      expect(uciToMove(p, "e1d1q")).toBeNull();
      expect(uciToMove(start(), "e2e4q")).toBeNull();
    });

    it("rejects moves of the wrong side and moves leaving the king in check", () => {
      expect(uciToMove(start(), "e7e5")).toBeNull();
      const pinned = parseFen("4r1k1/8/8/8/8/4N1N1/8/4K3 w - - 0 1");
      expect(uciToMove(pinned, "e3f5")).toBeNull();
      expect(uciToMove(pinned, "g3f5")).not.toBeNull();
    });

    it("castling is accepted only as king move and only if legal", () => {
      const ok = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
      expect(uciToMove(ok, "e1g1")).not.toBeNull();
      expect(uciToMove(ok, "e1h1")).toBeNull();
      const attacked = parseFen("r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1");
      expect(uciToMove(attacked, "e1g1")).toBeNull();
      const noRights = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1");
      expect(uciToMove(noRights, "e1g1")).toBeNull();
    });

    it("returns a move that is in generateLegalMoves (flags included)", () => {
      const p = parseFen("4k3/8/8/3pP3/8/8/8/4R1K1 w - d6 0 1");
      expect(generateLegalMoves(p)).toContain(uciToMove(p, "e5d6"));
    });
  });
});
