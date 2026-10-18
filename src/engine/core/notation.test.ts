import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
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
  if (move === null) throw new Error(`illegal ${uci} in ${fen}`);
  return moveToSan(pos, move);
}

describe("moveToSan explicit cases", () => {
  it("disambiguates by file (Nbd2)", () => {
    expect(sanOf("4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1", "b1d2")).toBe("Nbd2");
  });

  it("disambiguates by rank (R1e2)", () => {
    expect(sanOf("7k/8/8/8/4R3/8/8/4RK2 w - - 0 1", "e1e2")).toBe("R1e2");
  });

  it("uses the full square with three queens (Qh4e1)", () => {
    expect(sanOf("6k1/8/8/8/4Q2Q/K7/8/7Q w - - 0 1", "h4e1")).toBe("Qh4e1");
  });

  it("en passant includes the origin file (exd6)", () => {
    expect(sanOf("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5d6")).toBe("exd6");
  });

  it("promotion with check (e8=Q+)", () => {
    expect(sanOf("8/4P3/8/8/8/8/8/k3K3 w - - 0 1", "e7e8q")).toBe("e8=Q");
    expect(sanOf("7k/4P3/8/8/8/8/8/4K3 w - - 0 1", "e7e8q")).toBe("e8=Q+");
  });

  it("promotion to knight with check", () => {
    expect(sanOf("7k/4P3/8/8/8/8/8/4K3 w - - 0 1", "e7e8n")).toBe("e8=N");
    expect(sanOf("8/4P1k1/8/8/8/8/8/4K3 w - - 0 1", "e7e8n")).toBe("e8=N+");
  });

  it("castling gives check", () => {
    expect(sanOf("5k2/8/8/8/8/8/8/4K2R w K - 0 1", "e1g1")).toBe("O-O+");
    expect(sanOf("2k5/8/8/8/8/8/8/R3K3 w Q - 0 1", "e1c1")).toBe("O-O-O");
    expect(sanOf("3k4/8/8/8/8/8/8/R3K3 w Q - 0 1", "e1c1")).toBe("O-O-O+");
  });

  it("checkmate suffix", () => {
    expect(sanOf("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", "d8h4")).toBe("Qh4#");
  });

  it("castling with mate (O-O-O#)", () => {
    expect(sanOf("2rk4/2p1p3/6B1/8/8/8/8/R3K3 w Q - 0 1", "e1c1")).toBe("O-O-O#");
  });

  it("ignores a pinned piece when disambiguating", () => {
    // Nc3 is pinned along the c-file by the rook on c8; only Ng1 can reach e2.
    expect(sanOf("2r1k3/8/8/8/8/2N5/8/2K3N1 w - - 0 1", "g1e2")).toBe("Ne2");
  });
});

describe("UCI", () => {
  it("formats moves", () => {
    const pos = parseFen("r6k/4P3/8/8/8/8/8/4K2R w K - 0 1");
    const ucis = generateLegalMoves(pos).map(moveToUci);
    expect(ucis).toContain("e1g1");
    expect(ucis).toContain("e7e8q");
    expect(ucis).toContain("e7e8n");
  });

  it("rejects illegal and malformed strings", () => {
    const pos = parseFen(START_FEN);
    expect(uciToMove(pos, "e2e5")).toBeNull();
    expect(uciToMove(pos, "zz99")).toBeNull();
    expect(uciToMove(pos, "")).toBeNull();
    expect(uciToMove(pos, "e2e4x")).toBeNull();
    expect(uciToMove(pos, "e2e4q")).toBeNull();
    expect(uciToMove(parseFen("7k/4P3/8/8/8/8/8/4K3 w - - 0 1"), "e7e8")).toBeNull();
  });
});

describe("against chess.js", () => {
  const fens = [...PERFT_CASES.map((c) => c.fen), ...randomPositions({ count: 2000 }).map((p) => p.fen)];

  it("SAN matches for all legal moves, UCI round-trips, position is unchanged", { timeout: 300_000 }, () => {
    for (const fen of fens) {
      const pos = parseFen(fen);
      const hash = computeHash(pos);
      const expected = new Chess(fen).moves({ verbose: true });
      const moves = generateLegalMoves(pos);
      expect(moves.length).toBe(expected.length);
      const sanByLan = new Map(expected.map((m) => [m.lan, m.san]));
      for (const move of moves) {
        const uci = moveToUci(move);
        expect(uciToMove(pos, uci)).toBe(move);
        expect(moveToSan(pos, move), `${fen} ${uci}`).toBe(sanByLan.get(uci));
      }
      expect(toFen(pos)).toBe(fen);
      expect(computeHash(pos)).toEqual(hash);
      expect(pos.history.length).toBe(0);
    }
  });
});
