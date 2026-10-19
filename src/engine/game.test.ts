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

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function playUci(game: Game, ...ucis: string[]): Game {
  let current = game;
  for (const uci of ucis) {
    const input: MoveInput = {
      from: uci.slice(0, 2) as SquareName,
      to: uci.slice(2, 4) as SquareName,
      ...(uci.length === 5 ? { promotion: uci[4] as "q" | "r" | "b" | "n" } : {}),
    };
    current = play(current, input);
  }
  return current;
}

describe("createGame", () => {
  it("starts from the initial position by default", () => {
    const game = createGame();
    expect(getFen(game)).toBe(START_FEN);
    expect(getInitialFen(game)).toBe(START_FEN);
    expect(getTurn(game)).toBe("w");
    expect(getHistory(game)).toEqual([]);
    expect(getLastMove(game)).toBeNull();
    expect(getUciMoves(game)).toEqual([]);
    expect(getStatus(game)).toEqual({ kind: "playing", inCheck: false });
    expect(getLegalMoves(game)).toHaveLength(20);
  });

  it("throws on an invalid FEN", () => {
    expect(() => createGame("not a fen")).toThrow();
    expect(() => createGame("")).toThrow();
  });

  it("freezes the game", () => {
    const game = createGame();
    expect(Object.isFrozen(game)).toBe(true);
    expect(Object.isFrozen(game.uciMoves)).toBe(true);
  });
});

describe("getBoard", () => {
  it("has 64 squares with a1 = 0 and frozen pieces", () => {
    const board = getBoard(createGame());
    expect(board).toHaveLength(64);
    expect(board[0]).toEqual({ color: "w", type: "r" });
    expect(board[4]).toEqual({ color: "w", type: "k" });
    expect(board[63]).toEqual({ color: "b", type: "r" });
    expect(board[27]).toBeNull();
    expect(Object.isFrozen(board)).toBe(true);
    expect(Object.isFrozen(board[0])).toBe(true);
    expect(() => (board as unknown[]).push(null)).toThrow();
  });
});

describe("play", () => {
  it("does not change the received game and returns a frozen game", () => {
    const game = createGame();
    const snapshot = structuredClone(game);
    const next = play(game, { from: "e2", to: "e4" });
    expect(game).toEqual(snapshot);
    expect(getFen(game)).toBe(START_FEN);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.uciMoves)).toBe(true);
    expect(getUciMoves(next)).toEqual(["e2e4"]);
    expect(getTurn(next)).toBe("b");
    expect(getFen(next)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
  });

  it("throws on illegal moves", () => {
    const game = createGame();
    expect(() => play(game, { from: "e2", to: "e5" })).toThrow();
    expect(() => play(game, { from: "e7", to: "e5" })).toThrow();
    expect(() => play(game, { from: "e4", to: "e5" })).toThrow();
    expect(() => play(game, { from: "zz" as SquareName, to: "e4" })).toThrow();
  });

  it("requires a promotion piece and rejects a spurious one", () => {
    const game = createGame("k7/4P3/8/8/8/8/8/K7 w - - 0 1");
    expect(() => play(game, { from: "e7", to: "e8" })).toThrow();
    expect(getFen(play(game, { from: "e7", to: "e8", promotion: "q" }))).toBe("k3Q3/8/8/8/8/8/8/K7 b - - 0 1");
    const start = createGame();
    expect(() => play(start, { from: "e2", to: "e4", promotion: "q" })).toThrow();
  });

  it("records SAN, UCI, piece, color and capture in the history", () => {
    const game = playUci(createGame(), "e2e4", "d7d5", "e4d5");
    const history = getHistory(game);
    expect(history.map((move) => move.san)).toEqual(["e4", "d5", "exd5"]);
    expect(history.map((move) => move.uci)).toEqual(["e2e4", "d7d5", "e4d5"]);
    expect(history[2]).toEqual({
      from: "e4",
      to: "d5",
      color: "w",
      piece: "p",
      captured: true,
      san: "exd5",
      uci: "e4d5",
    });
    expect(getLastMove(game)).toEqual(history[2]);
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history[0])).toBe(true);
    expect(() => (history as unknown[]).push(1)).toThrow();
  });

  it("handles castling as the king move, en passant and promotion with capture", () => {
    const castle = playUci(createGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"), "e1g1");
    expect(getFen(castle)).toBe("r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1");
    expect(getLastMove(castle)?.san).toBe("O-O");
    const ep = playUci(createGame("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"), "e5d6");
    expect(getLastMove(ep)).toMatchObject({ captured: true, san: "exd6" });
    expect(getBoard(ep)[35]).toBeNull();
    const promo = playUci(createGame("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1"), "a7b8n");
    expect(getLastMove(promo)).toMatchObject({ promotion: "n", captured: true, san: "axb8=N" });
  });
});

describe("getStatus", () => {
  it("detects fool's mate and refuses further moves", () => {
    const game = playUci(createGame(), "f2f3", "e7e5", "g2g4", "d8h4");
    expect(getStatus(game)).toEqual({ kind: "checkmate", winner: "b", inCheck: true });
    expect(getLastMove(game)?.san).toBe("Qh4#");
    expect(() => play(game, { from: "a2", to: "a3" })).toThrow();
    expect(getLegalMoves(game)).toEqual([]);
  });

  it("detects scholar's mate with white as winner", () => {
    const game = playUci(createGame(), "e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7");
    expect(getStatus(game)).toEqual({ kind: "checkmate", winner: "w", inCheck: true });
    expect(() => play(game, { from: "a7", to: "a6" })).toThrow();
  });

  it("detects check", () => {
    const game = playUci(createGame(), "e2e4", "f7f6", "d1h5");
    expect(getStatus(game)).toEqual({ kind: "playing", inCheck: true });
  });

  it("detects stalemate", () => {
    const game = createGame("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(getStatus(game)).toEqual({ kind: "stalemate", inCheck: false });
    expect(() => play(game, { from: "h8", to: "g8" })).toThrow();
  });

  it("detects insufficient material", () => {
    const game = createGame("8/8/4k3/8/8/3K4/8/8 w - - 0 1");
    expect(getStatus(game)).toEqual({ kind: "draw", reason: "insufficient-material", inCheck: false });
  });

  it("detects threefold repetition after Nf3 Nf6 Ng1 Ng8 twice", () => {
    const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    const once = playUci(createGame(), ...cycle);
    expect(getStatus(once)).toEqual({ kind: "playing", inCheck: false });
    const twice = playUci(once, ...cycle);
    expect(getStatus(twice)).toEqual({ kind: "draw", reason: "threefold", inCheck: false });
    expect(() => play(twice, { from: "a2", to: "a3" })).toThrow();
  });

  it("sees repetitions after undo (the whole game is replayed)", () => {
    const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    const game = undo(playUci(createGame(), ...cycle, ...cycle));
    expect(getStatus(game).kind).toBe("playing");
    expect(getStatus(playUci(game, "f6g8")).kind).toBe("draw");
  });

  it("detects the fifty-move rule", () => {
    const game = createGame("4k3/8/8/8/8/8/8/R3K3 w - - 100 80");
    expect(getStatus(game)).toEqual({ kind: "draw", reason: "fifty-move", inCheck: false });
    expect(() => play(game, { from: "a1", to: "a2" })).toThrow();
  });

  it("prefers checkmate over the fifty-move rule", () => {
    const game = playUci(createGame("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 99 60"), "a1a8");
    expect(getStatus(game)).toEqual({ kind: "checkmate", winner: "w", inCheck: true });
  });

  it("prefers insufficient material over the fifty-move rule", () => {
    const game = createGame("8/8/4k3/8/8/3K4/8/8 w - - 100 80");
    expect(getStatus(game)).toMatchObject({ kind: "draw", reason: "insufficient-material" });
  });

  it("returns frozen statuses", () => {
    expect(Object.isFrozen(getStatus(createGame()))).toBe(true);
  });
});

describe("undo", () => {
  it("equals createGame plus the first moves", () => {
    const three = playUci(createGame(), "e2e4", "e7e5", "g1f3");
    const undone = undo(three);
    const expected = playUci(createGame(), "e2e4", "e7e5");
    expect(getFen(undone)).toBe(getFen(expected));
    expect(getHistory(undone)).toEqual(getHistory(expected));
    expect(undone).toEqual(expected);
    expect(getUciMoves(three)).toHaveLength(3);
  });

  it("on an empty game returns an equivalent game", () => {
    const game = createGame();
    const same = undo(game);
    expect(same).toEqual(game);
    expect(getFen(same)).toBe(START_FEN);
    expect(Object.isFrozen(same)).toBe(true);
  });

  it("reopens a finished game", () => {
    const mate = playUci(createGame(), "f2f3", "e7e5", "g2g4", "d8h4");
    expect(getStatus(undo(mate)).kind).toBe("playing");
  });
});

describe("legal move queries", () => {
  it("returns moves from a square with SAN and UCI", () => {
    const moves = getLegalMovesFrom(createGame(), "e2");
    expect(moves.map((move) => move.uci).sort()).toEqual(["e2e3", "e2e4"]);
    expect(moves.map((move) => move.san).sort()).toEqual(["e3", "e4"]);
    expect(Object.isFrozen(moves)).toBe(true);
    expect(Object.isFrozen(moves[0])).toBe(true);
    expect(getLegalMovesFrom(createGame(), "e4")).toEqual([]);
    expect(getLegalMovesFrom(createGame(), "e7")).toEqual([]);
  });

  it("fills the promotion field for a pawn about to promote", () => {
    const game = createGame("k7/4P3/8/8/8/8/8/K7 w - - 0 1");
    const moves = getLegalMovesFrom(game, "e7");
    expect(moves.map((move) => move.promotion).sort()).toEqual(["b", "n", "q", "r"]);
    expect(moves.map((move) => move.uci).sort()).toEqual(["e7e8b", "e7e8n", "e7e8q", "e7e8r"]);
  });

  it("does not disturb the game state", () => {
    const game = playUci(createGame(), "e2e4", "e7e5");
    const fen = getFen(game);
    getLegalMoves(game);
    getHistory(game);
    getLegalMovesFrom(game, "g1");
    expect(getFen(game)).toBe(fen);
    expect(getLegalMoves(game)).toHaveLength(29);
  });
});

describe("public exports", () => {
  it("does not leak anything from the core layer", () => {
    const names = Object.keys(publicApi).sort();
    expect(names).toEqual(
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
    for (const leaked of ["Position", "makeMove", "unmakeMove", "parseFen", "toFen", "generateLegalMoves", "START_FEN"]) {
      expect(names).not.toContain(leaked);
    }
  });
});
