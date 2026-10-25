import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { createGame, getFen, getLegalMoves, getStatus, getUciMoves, play } from "@/engine";
import type { Game, GameStatus, MoveInput } from "@/engine";
import { PERFT_CASES } from "../fixtures/perft";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uciOf = (m: { from: string; to: string; promotion?: string }) => `${m.from}${m.to}${m.promotion ?? ""}`;

const toInput = (uci: string): MoveInput =>
  ({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(uci.length > 4 ? { promotion: uci[4] } : {}),
  }) as MoveInput;

const shuffle = (a: string, b: string, c: string, d: string, times: number): string[] =>
  Array.from({ length: times }, () => [a, b, c, d]).flat();

/** First 3 FEN fields; en passant is normalized away because conventions may differ. */
const fen3 = (fen: string) => fen.split(" ").slice(0, 3).join(" ");

/** Expected status derived from chess.js with the SPEC precedence. */
function expectedStatus(chess: Chess): string {
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (chess.isInsufficientMaterial()) return "draw:insufficient-material";
  if (chess.isThreefoldRepetition()) return "draw:threefold";
  if (Number(chess.fen().split(" ")[4]) >= 100) return "draw:fifty-move";
  return "playing";
}

function statusKey(s: GameStatus): string {
  return s.kind === "draw" ? `draw:${s.reason}` : s.kind;
}

/** Returns a reproducible diff message or null. */
function diff(game: Game, chess: Chess): string | null {
  const ctx = `FEN=${getFen(game)} start=${game.initialFen} moves=${getUciMoves(game).join(" ")}`;
  if (fen3(getFen(game)) !== fen3(chess.fen())) return `FEN mismatch ${getFen(game)} vs ${chess.fen()} | ${ctx}`;
  const a = getLegalMoves(game)
    .map((m) => `${m.uci}=${m.san}`)
    .sort();
  const b = chess
    .moves({ verbose: true })
    .map((m) => `${uciOf(m)}=${m.san}`)
    .sort();
  if (a.join(",") !== b.join(",")) {
    return `moves differ: only mine ${a.filter((x) => !b.includes(x))} only chess.js ${b.filter((x) => !a.includes(x))} | ${ctx}`;
  }
  const st = getStatus(game);
  if (statusKey(st) !== expectedStatus(chess)) return `status ${statusKey(st)} vs ${expectedStatus(chess)} | ${ctx}`;
  if (st.inCheck !== chess.inCheck()) return `inCheck ${st.inCheck} vs ${chess.inCheck()} | ${ctx}`;
  if (st.kind === "checkmate" && st.winner === chess.turn()) return `winner wrong | ${ctx}`;
  return null;
}

/** Plays the same UCI moves on both and checks every ply. Stops when the game is over. */
function playScript(fen: string, moves: readonly string[]): string | null {
  let game = createGame(fen);
  const chess = new Chess(fen);
  let d = diff(game, chess);
  if (d) return d;
  for (const uci of moves) {
    if (getStatus(game).kind !== "playing") return null;
    game = play(game, toInput(uci));
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    d = diff(game, chess);
    if (d) return d;
  }
  return null;
}

function randomGame(fen: string, rng: () => number, maxPlies: number): string | null {
  let game = createGame(fen);
  const chess = new Chess(fen);
  let d = diff(game, chess);
  if (d) return d;
  for (let i = 0; i < maxPlies && getStatus(game).kind === "playing"; i++) {
    const legal = chess.moves({ verbose: true });
    // Bias towards promotions, en passant and castling to hit edge cases.
    const special = legal.filter((m) => m.promotion || m.isEnPassant() || m.isKingsideCastle() || m.isQueensideCastle());
    const pool = special.length > 0 && rng() < 0.5 ? special : legal;
    const m = pool[Math.floor(rng() * pool.length)]!;
    game = play(game, toInput(uciOf(m)));
    chess.move(m.san);
    d = diff(game, chess);
    if (d) return d;
  }
  return null;
}

describe("adversarial oracle: random games from perft FENs", () => {
  PERFT_CASES.forEach((c, idx) => {
    it(`matches chess.js over 12 random games from ${c.name}`, () => {
      const rng = mulberry32(9000 + idx);
      for (let g = 0; g < 12; g++) {
        expect(randomGame(c.fen, rng, 120), `game ${g}`).toBeNull();
      }
    }, 180_000);
  });
});

describe("adversarial oracle: targeted positions", () => {
  const positions: [string, string][] = [
    ["en passant horizontal pin (white)", "8/8/8/KPp4r/8/8/8/7k w - c6 0 1"],
    ["en passant horizontal pin (black)", "7K/8/8/8/k1pP3R/8/8/8 b - d3 0 1"],
    ["en passant legal", "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"],
    ["en passant resolves check", "4k3/8/8/2pP4/3K4/8/8/8 w - c6 0 1"],
    ["en passant pinned diagonally", "4k3/8/b7/2pP4/8/8/8/5K2 w - c6 0 1"],
    ["promotion with check", "7k/4P3/8/8/8/8/8/K7 w - - 0 1"],
    ["promotion with mate", "6k1/5Ppp/8/8/8/8/8/K5R1 w - - 0 1"],
    ["underpromotion knight check", "7k/8/8/8/8/8/p2K4/1N6 b - - 0 1"],
    ["underpromotion knight fork", "8/3P4/8/8/8/8/k7/K3r2q w - - 0 1"],
    ["promotion by capture", "r3k3/1P6/8/8/8/8/8/4K3 w q - 0 1"],
    ["castling through attacked square", "r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1"],
    ["castling out of check", "r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1"],
    ["castling queenside b-file attacked (legal)", "r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1"],
    ["castling rook attacked (legal)", "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"],
    ["castling blocked", "r3k2r/8/8/8/8/8/8/RN2K1NR w KQkq - 0 1"],
    ["castling with check on landing", "5r1k/8/8/8/8/8/8/4K2R w K - 0 1"],
    ["castle gives check", "5k2/8/8/8/8/8/8/4K2R w K - 0 1"],
    ["SAN disambiguation file", "4k3/8/8/8/8/8/8/N3K2N w - - 0 1"],
    ["SAN disambiguation rank", "4k3/R7/8/8/8/8/R7/4K3 w - - 0 1"],
    ["SAN disambiguation both", "4k3/8/8/8/Q3Q3/8/8/Q3K3 w - - 0 1"],
    ["stalemate", "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"],
    ["checkmate", "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"],
    ["double check", "4k3/8/8/8/1b6/8/3n4/4K3 w - - 0 1"],
    ["K vs K", "4k3/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["KB vs K", "4k3/8/8/8/8/8/8/3BK3 w - - 0 1"],
    ["KN vs K", "4k3/8/8/8/8/8/8/3NK3 b - - 0 1"],
    ["KNN vs K", "4k3/8/8/8/8/8/8/2NNK3 w - - 0 1"],
    ["KB vs KB same colour", "4kb2/8/8/8/8/8/8/3BK3 w - - 0 1"],
    ["KB vs KB opposite colour", "3bk3/8/8/8/8/8/8/3BK3 w - - 0 1"],
    ["KB vs KN", "4kn2/8/8/8/8/8/8/3BK3 w - - 0 1"],
    ["KP vs K", "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"],
    ["KR vs K", "4k3/8/8/8/8/8/8/3RK3 w - - 0 1"],
    ["KBB same colour vs K", "4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1"],
    ["KBB opposite colour vs K", "4k3/8/8/8/8/8/8/3BKB2 w - - 0 1"],
    ["KBB vs KB", "4kb2/8/8/8/8/8/8/2B1KB2 w - - 0 1"],
  ];
  for (const [name, fen] of positions) {
    it(`${name}: all legal moves, SANs and status match`, () => {
      expect(playScript(fen, [])).toBeNull();
      // And every legal move then keeps matching one ply deeper.
      for (const m of new Chess(fen).moves({ verbose: true })) {
        expect(playScript(fen, [uciOf(m)]), `after ${uciOf(m)}`).toBeNull();
      }
    });
  }

  it("all four promotion choices are offered", () => {
    const moves = getLegalMoves(createGame("7k/4P3/8/8/8/8/8/K7 w - - 0 1")).filter((m) => m.from === "e7");
    expect(moves.map((m) => m.uci).sort()).toEqual(["e7e8b", "e7e8n", "e7e8q", "e7e8r"]);
  });
});

describe("adversarial oracle: repetition", () => {
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  function playAll(fen: string, moves: readonly string[]): Game {
    let g = createGame(fen);
    for (const u of moves) g = play(g, toInput(u));
    return g;
  }

  it("plain threefold from the initial position", () => {
    expect(playScript(START, shuffle("g1f3", "g8f6", "f3g1", "f6g8", 3))).toBeNull();
    const s = getStatus(playAll(START, shuffle("g1f3", "g8f6", "f3g1", "f6g8", 2)));
    expect(s.kind).toBe("draw");
    expect(s.kind === "draw" && s.reason).toBe("threefold");
  });

  it("not a repetition after twice only", () => {
    expect(getStatus(playAll(START, shuffle("g1f3", "g8f6", "f3g1", "f6g8", 1))).kind).toBe("playing");
  });

  it("different castling rights are not the same position", () => {
    const fen = "r3k3/8/8/8/8/8/8/R3K3 w Qq - 0 1";
    expect(playScript(fen, shuffle("a1b1", "a8b8", "b1a1", "b8a8", 4))).toBeNull();
    // Rights are lost after the first cycle, so the start position does not count again.
    expect(getStatus(playAll(fen, shuffle("a1b1", "a8b8", "b1a1", "b8a8", 2))).kind).toBe("playing");
  });

  it("king moves losing castling rights then shuffling", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(playScript(fen, shuffle("e1e2", "e8e7", "e2e1", "e7e8", 4))).toBeNull();
  });

  it("en passant capturable on first occurrence only", () => {
    const fen = "4k1n1/8/8/8/3p4/8/4P3/4K1N1 w - - 0 1";
    expect(playScript(fen, ["e2e4", ...shuffle("g8f6", "g1f3", "f6g8", "f3g1", 4)])).toBeNull();
  });

  it("en passant square set but not capturable", () => {
    const fen = "4k1n1/8/8/8/8/8/4P3/4K1N1 w - - 0 1";
    expect(playScript(fen, ["e2e4", ...shuffle("g8f6", "g1f3", "f6g8", "f3g1", 4)])).toBeNull();
  });

  it("repetition around a pinned en passant pawn", () => {
    const fen = "8/8/8/KPp4r/8/8/8/7k w - c6 0 1";
    expect(playScript(fen, shuffle("a5a4", "h1g1", "a4a5", "g1h1", 4))).toBeNull();
  });

  it("repetition starting after an irreversible move", () => {
    const fen = "4k3/pp6/8/8/8/8/PP6/4K3 w - - 0 1";
    expect(playScript(fen, ["a2a3", "a7a6", ...shuffle("e1e2", "e8e7", "e2e1", "e7e8", 4)])).toBeNull();
  });
});

describe("adversarial oracle: fifty-move counter", () => {
  const fenAt = (n: number) => `4k3/8/8/8/8/8/R7/4K3 w - - ${n} 60`;
  const walk = ["a2a3", "e8d8", "a3a4", "d8e8", "a4a5", "e8d8", "a5a6", "d8e8", "a6a7", "e8d8", "a7b7", "d8e8"];

  for (const start of [0, 90, 94, 95, 96, 97, 98, 99]) {
    it(`halfmove clock starting at ${start} matches chess.js`, () => {
      expect(playScript(fenAt(start), walk)).toBeNull();
    });
  }

  it("draws exactly when the clock reaches 100", () => {
    let g = play(createGame(fenAt(98)), toInput("a2a3"));
    expect(getStatus(g).kind).toBe("playing"); // clock 99
    g = play(g, toInput("e8d8"));
    const s = getStatus(g); // clock 100
    expect(s.kind).toBe("draw");
    expect(s.kind === "draw" && s.reason).toBe("fifty-move");
  });

  it("a pawn move at clock 99 resets it", () => {
    expect(playScript("4k3/p7/8/8/8/8/R7/4K3 b - - 99 60", ["a7a6", "a2b2", "a6a5", "b2c2"])).toBeNull();
  });

  it("a capture at clock 99 resets it", () => {
    expect(playScript("4k3/r7/8/8/8/8/R7/4K3 w - - 99 60", ["a2a7"])).toBeNull();
  });

  it("checkmate on the 100th halfmove wins over the fifty-move draw", () => {
    const fen = "6k1/5ppp/8/8/8/8/8/R3K3 w - - 99 60";
    expect(playScript(fen, ["a1a8"])).toBeNull();
    expect(getStatus(play(createGame(fen), toInput("a1a8"))).kind).toBe("checkmate");
  });
});
