import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import * as publicApi from "@/engine";
import {
  createGame,
  getBoard,
  getFen,
  getHistory,
  getInitialFen,
  getLastMove,
  getLegalMoves,
  getLegalMovesFrom,
  getStatus,
  getTurn,
  getUciMoves,
  play,
  undo,
} from "@/engine";
import type { Game, MoveInput, SquareName } from "@/engine";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { MATE_IN_1 } from "../../test/fixtures/mates";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const KK = "8/8/4k3/8/8/3K4/8/8 w - - 0 1";

function uciToInput(uci: string): MoveInput {
  const from = uci.slice(0, 2) as SquareName;
  const to = uci.slice(2, 4) as SquareName;
  const p = uci[4];
  return p ? { from, to, promotion: p as "q" | "r" | "b" | "n" } : { from, to };
}

function playAll(game: Game, ucis: string[]): Game {
  return ucis.reduce((g, u) => play(g, uciToInput(u)), game);
}

const SHEPHERD = ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"];
const SHUFFLE = ["g1f3", "g8f6", "f3g1", "f6g8"];

describe("createGame", () => {
  it("defaults to the initial position", () => {
    const g = createGame();
    expect(getFen(g)).toBe(START);
    expect(getInitialFen(g)).toBe(START);
    expect(getUciMoves(g)).toEqual([]);
    expect(getHistory(g)).toEqual([]);
    expect(getLastMove(g)).toBeNull();
    expect(getTurn(g)).toBe("w");
    expect(getStatus(g)).toEqual({ kind: "playing", inCheck: false });
  });

  it.each([
    "",
    "garbage",
    "8/8/8/8/8/8/8 w - - 0 1",
    "8/8/8/8/8/8/8/8 w - - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0",
    "rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQQBNR w KQkq - 0 1",
  ])("throws on invalid FEN %j", (fen) => {
    expect(() => createGame(fen)).toThrow();
  });

  it("starts from a FEN with black to move", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const g = createGame(fen);
    expect(getTurn(g)).toBe("b");
    expect(getInitialFen(g)).toBe(fen);
    const g2 = play(g, { from: "e7", to: "e5" });
    expect(getFen(g2)).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2");
    const m = getHistory(g2)[0]!;
    expect(m).toMatchObject({ color: "b", piece: "p", san: "e5", uci: "e7e5", captured: false });
    expect(getInitialFen(g2)).toBe(fen);
  });
});

describe("play", () => {
  it("does not alter the received game and returns a frozen game", () => {
    const g0 = createGame();
    const g1 = play(g0, { from: "e2", to: "e4" });
    const snapshot = structuredClone(g1);
    const g2 = play(g1, { from: "e7", to: "e5" });
    expect(g1).toEqual(snapshot);
    expect(getFen(g1)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    expect(getUciMoves(g1)).toEqual(["e2e4"]);
    expect(getUciMoves(g0)).toEqual([]);
    expect(getFen(g0)).toBe(START);
    expect(g2).not.toBe(g1);
    expect(Object.isFrozen(g1)).toBe(true);
    expect(Object.isFrozen(g2)).toBe(true);
    expect(Object.isFrozen(g2.uciMoves)).toBe(true);
    expect(Object.isFrozen(g0)).toBe(true);
  });

  it("keeps the same game valid for branching after a later play", () => {
    const base = playAll(createGame(), ["e2e4"]);
    const a = play(base, { from: "e7", to: "e5" });
    const b = play(base, { from: "c7", to: "c5" });
    expect(getUciMoves(a)).toEqual(["e2e4", "e7e5"]);
    expect(getUciMoves(b)).toEqual(["e2e4", "c7c5"]);
    expect(getFen(a)).not.toBe(getFen(b));
    expect(getFen(base)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
  });

  it.each<[string, MoveInput]>([
    ["pawn three squares", { from: "e2", to: "e5" }],
    ["opponent piece", { from: "e7", to: "e5" }],
    ["empty origin", { from: "e4", to: "e5" }],
    ["same square", { from: "e2", to: "e2" }],
    ["knight like a bishop", { from: "g1", to: "e3" }],
    ["capture own piece", { from: "d1", to: "d2" }],
    ["bishop through pawns", { from: "c1", to: "e3" }],
    ["promotion on an ordinary move", { from: "e2", to: "e4", promotion: "q" }],
    ["invalid square", { from: "z9" as SquareName, to: "e4" }],
  ])("throws on illegal move: %s", (_n, move) => {
    const g = createGame();
    expect(() => play(g, move)).toThrow();
    expect(getUciMoves(g)).toEqual([]);
  });

  it("throws when a pawn reaches the last rank without a promotion piece", () => {
    const g = createGame("7k/4P3/8/8/8/8/8/K7 w - - 0 1");
    expect(() => play(g, { from: "e7", to: "e8" })).toThrow();
    const g2 = play(g, { from: "e7", to: "e8", promotion: "q" });
    expect(getBoard(g2)[60]).toEqual({ color: "w", type: "q" });
  });

  it("throws on moves that leave the king in check", () => {
    const pinned = createGame("4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1");
    expect(() => play(pinned, { from: "e2", to: "c3" })).toThrow();
    const check = createGame("4k3/8/8/8/8/8/3r4/4K3 w - - 0 1");
    expect(() => play(check, { from: "e1", to: "e2" })).toThrow();
    expect(() => play(check, { from: "e1", to: "d2" })).not.toThrow();
    const check2 = createGame("4k3/8/8/8/8/8/8/R3K2r w - - 0 1");
    expect(() => play(check2, { from: "a1", to: "a2" })).toThrow();
  });

  it("does not accept castling expressed as king-takes-rook", () => {
    const g = createGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(() => play(g, { from: "e1", to: "h1" })).toThrow();
  });

  it("throws on any move after checkmate (scholar's mate)", () => {
    const g = playAll(createGame(), SHEPHERD);
    expect(getStatus(g)).toEqual({ kind: "checkmate", winner: "w", inCheck: true });
    expect(getLastMove(g)).toMatchObject({ san: "Qxf7#", uci: "h5f7", captured: true, piece: "q" });
    expect(() => play(g, { from: "e8", to: "e7" })).toThrow();
    expect(() => play(g, { from: "a7", to: "a6" })).toThrow();
    expect(getLegalMoves(g)).toEqual([]);
    expect(getLegalMovesFrom(g, "e8")).toEqual([]);
  });

  it("throws on any move after stalemate", () => {
    const g = createGame("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(getStatus(g)).toEqual({ kind: "stalemate", inCheck: false });
    expect(() => play(g, { from: "h8", to: "g8" })).toThrow();
    expect(getLegalMoves(g)).toEqual([]);
  });

  it("throws on any move after an automatic draw", () => {
    const rep = playAll(createGame(), [...SHUFFLE, ...SHUFFLE]);
    expect(getStatus(rep)).toMatchObject({ kind: "draw", reason: "threefold" });
    expect(() => play(rep, { from: "e2", to: "e4" })).toThrow();
    const fifty = createGame("7k/8/5K2/8/8/8/8/6Q1 w - - 100 80");
    expect(() => play(fifty, { from: "g1", to: "a1" })).toThrow();
    const ins = createGame(KK);
    expect(() => play(ins, { from: "d3", to: "d2" })).toThrow();
  });
});

describe("status", () => {
  it("detects threefold repetition after Nf3 Nf6 Ng1 Ng8 twice, not before", () => {
    const once = playAll(createGame(), SHUFFLE);
    expect(getStatus(once)).toEqual({ kind: "playing", inCheck: false });
    const almost = playAll(createGame(), [...SHUFFLE, "g1f3", "g8f6", "f3g1"]);
    expect(getStatus(almost).kind).toBe("playing");
    const twice = playAll(createGame(), [...SHUFFLE, ...SHUFFLE]);
    expect(getStatus(twice)).toEqual({ kind: "draw", reason: "threefold", inCheck: false });
  });

  it("repetition counts positions with different castling rights as different", () => {
    const g = playAll(createGame("r3k3/8/8/8/8/8/8/R3K3 w Qq - 0 1"), [
      "a1b1",
      "a8b8",
      "b1a1",
      "b8a8",
      "a1b1",
      "a8b8",
      "b1a1",
      "b8a8",
    ]);
    // The initial position had castling rights; later ones do not, so only 2 equal positions.
    expect(getStatus(g)).toEqual({ kind: "playing", inCheck: false });
  });

  it("reports mate over the fifty-move counter at 99", () => {
    const g = createGame("7k/8/5K2/8/8/8/8/6Q1 w - - 99 80");
    expect(getStatus(g)).toEqual({ kind: "playing", inCheck: false });
    const mate = play(g, { from: "g1", to: "g7" });
    expect(getStatus(mate)).toEqual({ kind: "checkmate", winner: "w", inCheck: true });
    const quiet = play(g, { from: "g1", to: "a1" });
    expect(getStatus(quiet)).toEqual({ kind: "draw", reason: "fifty-move", inCheck: false });
  });

  it("flags fifty-move draw when the counter starts at 100", () => {
    expect(getStatus(createGame("7k/8/5K2/8/8/8/8/6Q1 w - - 100 80"))).toEqual({
      kind: "draw",
      reason: "fifty-move",
      inCheck: false,
    });
  });

  it("stalemate wins over the fifty-move counter", () => {
    expect(getStatus(createGame("7k/5Q2/6K1/8/8/8/8/8 b - - 100 80"))).toEqual({
      kind: "stalemate",
      inCheck: false,
    });
  });

  it("insufficient material wins over fifty-move and over threefold", () => {
    expect(getStatus(createGame("8/8/4k3/8/8/3K4/8/8 w - - 100 80"))).toEqual({
      kind: "draw",
      reason: "insufficient-material",
      inCheck: false,
    });
    const g = createGame(KK);
    expect(getStatus(g)).toMatchObject({ kind: "draw", reason: "insufficient-material" });
  });

  it("insufficient material cases per SPEC", () => {
    const reason = (fen: string) => {
      const s = getStatus(createGame(fen));
      return s.kind === "draw" ? s.reason : s.kind;
    };
    expect(reason(KK)).toBe("insufficient-material");
    expect(reason("8/8/4k3/8/8/3K4/8/6N1 w - - 0 1")).toBe("insufficient-material");
    expect(reason("8/8/4k3/8/8/3K4/8/6B1 w - - 0 1")).toBe("insufficient-material");
    expect(reason("8/8/4k3/8/8/3K4/8/6b1 w - - 0 1")).toBe("insufficient-material");
    // KB v KB, same colour (c1 dark, f8 dark)
    expect(reason("5b2/8/4k3/8/8/3K4/8/2B5 w - - 0 1")).toBe("insufficient-material");
    // KB v KB, opposite colours (c1 dark, c8 light)
    expect(reason("2b5/8/4k3/8/8/3K4/8/2B5 w - - 0 1")).toBe("playing");
    expect(reason("8/8/4k3/8/8/3K4/4B3/2B5 w - - 0 1")).toBe("playing");
    expect(reason("8/8/4k3/8/8/3K4/8/6R1 w - - 0 1")).toBe("playing");
    expect(reason("8/8/4k3/8/8/3K4/P7/8 w - - 0 1")).toBe("playing");
    expect(reason("8/8/4k3/8/8/3K4/8/5QN1 w - - 0 1")).toBe("playing");
  });

  it("reports inCheck when playing", () => {
    const g = playAll(createGame(), ["e2e4", "f7f5", "d1h5"]);
    expect(getStatus(g)).toEqual({ kind: "playing", inCheck: true });
    expect(getLastMove(g)!.san).toBe("Qh5+");
  });

  it("mate-in-1 fixtures end in checkmate with the right winner and # in SAN", () => {
    for (const puzzle of MATE_IN_1) {
      const turn = puzzle.fen.split(" ")[1] as "w" | "b";
      for (const sol of puzzle.solutions) {
        const g = play(createGame(puzzle.fen), uciToInput(sol));
        expect(getStatus(g)).toEqual({ kind: "checkmate", winner: turn, inCheck: true });
        expect(getLastMove(g)!.san.endsWith("#")).toBe(true);
        expect(getLastMove(g)!.uci).toBe(sol);
      }
    }
  });
});

describe("undo", () => {
  it("on an empty game returns an equivalent game without throwing", () => {
    const g = createGame();
    const u = undo(g);
    expect(u).toEqual(g);
    expect(getFen(u)).toBe(START);
    expect(getUciMoves(u)).toEqual([]);
    expect(Object.isFrozen(u)).toBe(true);
    const fen = "4k3/8/8/8/8/8/8/4K2R w K - 0 1";
    expect(getFen(undo(createGame(fen)))).toBe(fen);
  });

  it("after 3 moves equals createGame plus the first 2 moves", () => {
    const three = playAll(createGame(), ["e2e4", "e7e5", "g1f3"]);
    const snap = structuredClone(three);
    const u = undo(three);
    const ref = playAll(createGame(), ["e2e4", "e7e5"]);
    expect(getFen(u)).toBe(getFen(ref));
    expect(getHistory(u)).toEqual(getHistory(ref));
    expect(getUciMoves(u)).toEqual(getUciMoves(ref));
    expect(getInitialFen(u)).toBe(getInitialFen(ref));
    expect(getStatus(u)).toEqual(getStatus(ref));
    expect(getLastMove(u)).toEqual(getLastMove(ref));
    expect(three).toEqual(snap);
    expect(getUciMoves(three)).toHaveLength(3);
  });

  it("can be applied until empty and then keeps being a no-op", () => {
    let g = playAll(createGame(), ["e2e4", "e7e5"]);
    g = undo(undo(undo(undo(g))));
    expect(getFen(g)).toBe(START);
    expect(getUciMoves(g)).toEqual([]);
  });

  it("reopens a game finished by checkmate and by repetition", () => {
    const mate = undo(playAll(createGame(), SHEPHERD));
    expect(getStatus(mate)).toEqual({ kind: "playing", inCheck: false });
    expect(() => play(mate, { from: "h5", to: "f7" })).not.toThrow();
    const rep = undo(playAll(createGame(), [...SHUFFLE, ...SHUFFLE]));
    expect(getStatus(rep).kind).toBe("playing");
  });

  it("restores en passant and castling state", () => {
    const g = playAll(createGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"), ["e1g1"]);
    expect(getFen(g)).toBe("r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1");
    expect(getFen(undo(g))).toBe("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const ep = playAll(createGame(), ["e2e4", "a7a6", "e4e5", "d7d5"]);
    expect(getFen(ep)).toContain(" d6 ");
    expect(getFen(undo(ep))).toBe("rnbqkbnr/1ppppppp/p7/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2");
  });
});

describe("special moves in history", () => {
  it("en passant has the right SAN, UCI and board", () => {
    const g = playAll(createGame(), ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]);
    expect(getLastMove(g)).toEqual({
      from: "e5",
      to: "d6",
      color: "w",
      piece: "p",
      captured: true,
      san: "exd6",
      uci: "e5d6",
    });
    const b = getBoard(g);
    expect(b[43]).toEqual({ color: "w", type: "p" }); // d6
    expect(b[35]).toBeNull(); // d5
    expect(b[36]).toBeNull(); // e5
  });

  it("castling is O-O / O-O-O with king-move UCI", () => {
    const start = createGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const ks = play(start, { from: "e1", to: "g1" });
    expect(getLastMove(ks)).toMatchObject({
      san: "O-O",
      uci: "e1g1",
      piece: "k",
      captured: false,
      color: "w",
    });
    expect(getBoard(ks)[5]).toEqual({ color: "w", type: "r" });
    expect(getBoard(ks)[6]).toEqual({ color: "w", type: "k" });
    expect(getBoard(ks)[7]).toBeNull();
    expect(getBoard(ks)[4]).toBeNull();
    const qs = play(start, { from: "e1", to: "c1" });
    expect(getLastMove(qs)).toMatchObject({ san: "O-O-O", uci: "e1c1" });
    expect(getBoard(qs)[3]).toEqual({ color: "w", type: "r" });
    expect(getBoard(qs)[2]).toEqual({ color: "w", type: "k" });
    // After white O-O the f1 rook covers f8, so black can only castle long; and vice versa.
    const bq = play(ks, { from: "e8", to: "c8" });
    expect(getLastMove(bq)).toMatchObject({ san: "O-O-O", uci: "e8c8", color: "b" });
    expect(getBoard(bq)[59]).toEqual({ color: "b", type: "r" });
    expect(getBoard(bq)[58]).toEqual({ color: "b", type: "k" });
    const bk = play(qs, { from: "e8", to: "g8" });
    expect(getLastMove(bk)).toMatchObject({ san: "O-O", uci: "e8g8", color: "b" });
    expect(getUciMoves(bk)).toEqual(["e1c1", "e8g8"]);
  });

  it("castling is illegal through or out of check, and after the king moved", () => {
    const attacked = createGame("r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1");
    expect(() => play(attacked, { from: "e1", to: "g1" })).toThrow();
    const inCheck = createGame("r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1");
    expect(() => play(inCheck, { from: "e1", to: "g1" })).toThrow();
    expect(() => play(inCheck, { from: "e1", to: "c1" })).toThrow();
    const moved = playAll(createGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"), [
      "e1d1",
      "a8a7",
      "d1e1",
      "a7a8",
    ]);
    expect(() => play(moved, { from: "e1", to: "g1" })).toThrow();
  });

  it("promotion: legal moves from e7, SAN and UCI for each piece", () => {
    const g = createGame("7k/4P3/8/8/8/8/8/K7 w - - 0 1");
    const moves = getLegalMovesFrom(g, "e7");
    expect(moves).toHaveLength(4);
    expect(moves.map((m) => m.promotion).sort()).toEqual(["b", "n", "q", "r"]);
    expect(moves.map((m) => m.uci).sort()).toEqual(["e7e8b", "e7e8n", "e7e8q", "e7e8r"]);
    const sans = Object.fromEntries(moves.map((m) => [m.promotion, m.san]));
    expect(sans).toEqual({ q: "e8=Q+", r: "e8=R+", b: "e8=B", n: "e8=N" });
    for (const m of moves) {
      expect(m).toMatchObject({ from: "e7", to: "e8", piece: "p", color: "w", captured: false });
      expect(Object.isFrozen(m)).toBe(true);
    }
    const n = play(g, { from: "e7", to: "e8", promotion: "n" });
    expect(getBoard(n)[60]).toEqual({ color: "w", type: "n" });
    expect(getBoard(n)[52]).toBeNull();
    expect(getFen(n)).toBe("4N2k/8/8/8/8/8/8/K7 b - - 0 1");
  });

  it("promotion with capture and black promotion", () => {
    const g = createGame("3r3k/4P3/8/8/8/8/p7/2K5 w - - 0 1");
    const cap = play(g, { from: "e7", to: "d8", promotion: "q" });
    expect(getLastMove(cap)).toMatchObject({ san: "exd8=Q+", uci: "e7d8q", captured: true });
    const b = createGame("7k/8/8/8/8/8/p7/2K5 b - - 0 1");
    const pr = play(b, { from: "a2", to: "a1", promotion: "r" });
    expect(getLastMove(pr)).toMatchObject({ uci: "a2a1r", color: "b", piece: "p" });
    expect(getBoard(pr)[0]).toEqual({ color: "b", type: "r" });
  });

  it("getLegalMovesFrom returns [] for empty squares and for the opponent's pieces", () => {
    const g = createGame();
    expect(getLegalMovesFrom(g, "e4")).toEqual([]);
    expect(getLegalMovesFrom(g, "e7")).toEqual([]);
    expect(getLegalMovesFrom(g, "e2").map((m) => m.uci).sort()).toEqual(["e2e3", "e2e4"]);
    expect(getLegalMovesFrom(g, "g1").map((m) => m.san).sort()).toEqual(["Nf3", "Nh3"]);
  });
});

describe("queries", () => {
  it("getBoard has 64 squares with a1 = 0", () => {
    const b = getBoard(createGame());
    expect(b).toHaveLength(64);
    expect(b[0]).toEqual({ color: "w", type: "r" });
    expect(b[4]).toEqual({ color: "w", type: "k" });
    expect(b[3]).toEqual({ color: "w", type: "q" });
    expect(b[7]).toEqual({ color: "w", type: "r" });
    expect(b[8]).toEqual({ color: "w", type: "p" });
    expect(b[16]).toBeNull();
    expect(b[48]).toEqual({ color: "b", type: "p" });
    expect(b[56]).toEqual({ color: "b", type: "r" });
    expect(b[59]).toEqual({ color: "b", type: "q" });
    expect(b[60]).toEqual({ color: "b", type: "k" });
    expect(b[63]).toEqual({ color: "b", type: "r" });
    expect(b.filter((p) => p !== null)).toHaveLength(32);
  });

  it("getLegalMoves from the start: 20 frozen moves with SAN/UCI", () => {
    const moves = getLegalMoves(createGame());
    expect(moves).toHaveLength(20);
    expect(moves.map((m) => m.uci)).toContain("e2e4");
    expect(moves.find((m) => m.uci === "g1f3")!.san).toBe("Nf3");
    expect(Object.isFrozen(moves)).toBe(true);
    for (const m of moves) expect(Object.isFrozen(m)).toBe(true);
  });

  it("getTurn alternates", () => {
    let g = createGame();
    expect(getTurn(g)).toBe("w");
    g = play(g, { from: "e2", to: "e4" });
    expect(getTurn(g)).toBe("b");
    g = undo(g);
    expect(getTurn(g)).toBe("w");
  });

  it("getHistory, getLastMove and getUciMoves agree", () => {
    const g = playAll(createGame(), ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]);
    const h = getHistory(g);
    expect(h.map((m) => m.san)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    expect(h.map((m) => m.uci)).toEqual(getUciMoves(g));
    expect(getLastMove(g)).toEqual(h[4]);
    expect(h.map((m) => m.color)).toEqual(["w", "b", "w", "b", "w"]);
  });

  it("works with a plain Game object (persistence round-trip)", () => {
    const g = playAll(createGame(), ["e2e4", "e7e5", "g1f3"]);
    const copy = JSON.parse(JSON.stringify(g)) as Game;
    expect(getFen(copy)).toBe(getFen(g));
    expect(getHistory(copy)).toEqual(getHistory(g));
    const manual: Game = { initialFen: START, uciMoves: ["e2e4", "e7e5"] };
    expect(getTurn(manual)).toBe("w");
    expect(getUciMoves(play(manual, { from: "g1", to: "f3" }))).toEqual(["e2e4", "e7e5", "g1f3"]);
    expect(manual.uciMoves).toEqual(["e2e4", "e7e5"]);
  });

  it("Game exposes only initialFen and uciMoves", () => {
    const g = playAll(createGame(), ["e2e4"]);
    expect(Object.keys(g).sort()).toEqual(["initialFen", "uciMoves"]);
    expect(Object.getOwnPropertySymbols(g)).toEqual([]);
  });
});

describe("immutability", () => {
  const g = playAll(createGame(), ["e2e4", "e7e5", "g1f3"]);

  it("getHistory array and its moves are frozen", () => {
    const h = getHistory(g) as unknown as unknown[];
    expect(() => h.push({})).toThrow();
    expect(() => h.pop()).toThrow();
    expect(() => {
      h[0] = null;
    }).toThrow();
    expect(Object.isFrozen(h)).toBe(true);
    const m = getHistory(g)[0] as unknown as { san: string; uci: string };
    expect(Object.isFrozen(m)).toBe(true);
    expect(() => {
      m.san = "zzz";
    }).toThrow();
    expect(() => {
      m.uci = "zzzz";
    }).toThrow();
    expect(getHistory(g)[0]!.san).toBe("e4");
    expect(getLastMove(g)).toEqual(getHistory(g)[2]);
    expect(Object.isFrozen(getLastMove(g))).toBe(true);
  });

  it("getBoard array and pieces are frozen; mutation has no effect", () => {
    const b = getBoard(g) as unknown as ({ type: string } | null)[];
    expect(Object.isFrozen(b)).toBe(true);
    expect(() => {
      b[0] = null;
    }).toThrow();
    const piece = b.find((p) => p !== null)!;
    expect(Object.isFrozen(piece)).toBe(true);
    expect(() => {
      piece.type = "q";
    }).toThrow();
    expect(getBoard(g)[0]).toEqual({ color: "w", type: "r" });
    expect(getFen(g)).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2");
  });

  it("getUciMoves, legal moves and status are frozen", () => {
    const u = getUciMoves(g) as unknown as string[];
    expect(() => u.push("a2a3")).toThrow();
    const lm = getLegalMoves(g) as unknown as unknown[];
    expect(() => lm.push({})).toThrow();
    const lf = getLegalMovesFrom(g, "b8") as unknown as unknown[];
    expect(() => lf.push({})).toThrow();
    const s = getStatus(g) as unknown as { kind: string };
    expect(Object.isFrozen(s)).toBe(true);
    expect(() => {
      s.kind = "checkmate";
    }).toThrow();
    expect(getStatus(g).kind).toBe("playing");
    expect(getUciMoves(g)).toEqual(["e2e4", "e7e5", "g1f3"]);
  });

  it("mutating a returned array does not affect later queries", () => {
    try {
      (getHistory(g) as unknown as unknown[]).push({});
    } catch {
      /* expected */
    }
    expect(getHistory(g)).toHaveLength(3);
    expect(getUciMoves(g)).toHaveLength(3);
  });
});

describe("public index", () => {
  it("exports only the Game API, nothing from core", () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        "createGame",
        "getBoard",
        "getFen",
        "getHistory",
        "getInitialFen",
        "getLastMove",
        "getLegalMoves",
        "getLegalMovesFrom",
        "getStatus",
        "getTurn",
        "getUciMoves",
        "play",
        "undo",
      ].sort(),
    );
  });
});

describe("chess.js oracle over random games", () => {
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const STARTS = [
    START,
    "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
  ];

  function expectedStatus(c: Chess) {
    if (c.isCheckmate()) return "checkmate";
    if (c.isStalemate()) return "stalemate";
    if (c.isInsufficientMaterial()) return "insufficient-material";
    if (c.isThreefoldRepetition()) return "threefold";
    if (c.isDrawByFiftyMoves()) return "fifty-move";
    return "playing";
  }

  const key = (m: { from: string; to: string; promotion?: string }) =>
    m.from + m.to + (m.promotion ?? "");

  it("agrees on legal moves, SAN, UCI, status and board", () => {
    const rand = rng(12345);
    let checked = 0;
    for (let gi = 0; gi < 8; gi++) {
      const startFen = STARTS[gi % STARTS.length]!;
      const c = new Chess(startFen);
      let game = createGame(startFen);
      for (let ply = 0; ply < 60; ply++) {
        const verbose = c.moves({ verbose: true });
        const mine = getLegalMoves(game);
        expect(mine.map((m) => m.uci).sort()).toEqual(verbose.map(key).sort());
        for (const v of verbose) {
          const m = mine.find((x) => key(x) === key(v))!;
          expect(m.san).toBe(v.san);
          expect(m.captured).toBe(v.isCapture() || v.isEnPassant());
          expect(m.piece).toBe(v.piece);
          expect(m.color).toBe(v.color);
        }
        const st = getStatus(game);
        const exp = expectedStatus(c);
        const got = st.kind === "draw" ? st.reason : st.kind;
        expect(got).toBe(exp);
        expect(st.inCheck).toBe(c.inCheck());
        if (st.kind === "checkmate") expect(st.winner).toBe(c.turn() === "w" ? "b" : "w");
        expect(getTurn(game)).toBe(c.turn());
        expect(getFen(game).split(" ").slice(0, 3)).toEqual(c.fen().split(" ").slice(0, 3));
        const board = getBoard(game);
        for (const row of c.board()) {
          for (const sq of row) {
            if (!sq) continue;
            const file = sq.square.charCodeAt(0) - 97;
            const rank = Number(sq.square[1]) - 1;
            expect(board[rank * 8 + file]).toEqual({ color: sq.color, type: sq.type });
          }
        }
        checked++;
        if (exp !== "playing" || verbose.length === 0) {
          expect(() => play(game, uciToInput(verbose[0] ? key(verbose[0]) : "a1a1"))).toThrow();
          break;
        }
        const pick = verbose[Math.floor(rand() * verbose.length)]!;
        c.move(pick.san);
        game = play(game, uciToInput(key(pick)));
        expect(getLastMove(game)!.san).toBe(pick.san);
      }
      expect(getHistory(game).map((m) => m.san)).toEqual(c.history());
      let back = game;
      const n = getUciMoves(game).length;
      for (let i = 0; i < n; i++) back = undo(back);
      expect(getFen(back)).toBe(getFen(createGame(startFen)));
    }
    expect(checked).toBeGreaterThan(300);
  });
});
