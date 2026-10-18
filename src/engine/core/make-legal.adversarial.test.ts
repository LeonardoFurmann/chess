import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PERFT_CASES } from "../../../test/fixtures/perft";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { randomPositions } from "../../../test/fixtures/random-positions";
import { parseSquare, squareName } from "./board";
import { START_FEN, parseFen, toFen } from "./fen";
import { generateLegalMoves, inCheck, isCheckmate, isStalemate } from "./legal";
import { makeMove, unmakeMove } from "./make-move";
import { moveFrom, movePromotion, moveTo } from "./move";
import { perft, perftDivide } from "./perft";
import type { Position } from "./position";
import { repetitionCount } from "./repetition";
import {
  BLACK,
  CASTLE_BLACK_KING,
  CASTLE_BLACK_QUEEN,
  CASTLE_WHITE_KING,
  CASTLE_WHITE_QUEEN,
  NO_SQUARE,
} from "./types";
import type { Move } from "./types";
import { computeHash } from "./zobrist";

const PROMO_LETTER: Record<number, string> = { 2: "n", 3: "b", 4: "r", 5: "q" };

function uci(move: Move): string {
  const promo = movePromotion(move);
  return squareName(moveFrom(move)) + squareName(moveTo(move)) + (promo ? PROMO_LETTER[promo] : "");
}

function legalUci(pos: Position): string[] {
  return generateLegalMoves(pos).map(uci).sort();
}

function find(pos: Position, text: string): Move {
  const m = generateLegalMoves(pos).find((x) => uci(x) === text);
  if (m === undefined) throw new Error(`move ${text} not legal in ${toFen(pos)}`);
  return m;
}

function play(pos: Position, ...moves: string[]): void {
  for (const m of moves) makeMove(pos, find(pos, m));
}

function snapshot(pos: Position) {
  return {
    fen: toFen(pos),
    board: Array.from(pos.board),
    side: pos.sideToMove,
    castling: pos.castling,
    ep: pos.epSquare,
    half: pos.halfmoveClock,
    full: pos.fullmoveNumber,
    wk: pos.whiteKing,
    bk: pos.blackKing,
    hi: pos.hashHi,
    lo: pos.hashLo,
    hist: pos.history.length,
  };
}

function expectHashConsistent(pos: Position): void {
  const h = computeHash(pos);
  expect({ hi: pos.hashHi >>> 0, lo: pos.hashLo >>> 0 }).toEqual(h);
}

describe("legality edge cases", () => {
  it("rejects en passant that exposes the king along the rank", () => {
    const pos = parseFen("8/8/8/KPp4r/8/8/8/7k w - c6 0 1");
    const moves = legalUci(pos);
    expect(moves).not.toContain("b5c6");
    expect(moves).toContain("b5b6");
  });

  it("rejects en passant that exposes the black king along the rank", () => {
    const pos = parseFen("8/8/8/8/kpP4R/8/8/7K b - c3 0 1");
    expect(legalUci(pos)).not.toContain("b4c3");
  });

  it("allows en passant when the rank is not exposed", () => {
    const pos = parseFen("8/8/8/1Pp5/8/8/8/K6k w - c6 0 1");
    expect(legalUci(pos)).toContain("b5c6");
  });

  it("forbids castling out of check", () => {
    const moves = legalUci(parseFen("4k3/8/8/8/8/4r3/8/R3K2R w KQ - 0 1"));
    expect(moves).not.toContain("e1g1");
    expect(moves).not.toContain("e1c1");
  });

  it("forbids castling through an attacked square", () => {
    const moves = legalUci(parseFen("4k3/8/8/8/8/5r2/8/R3K2R w KQ - 0 1"));
    expect(moves).not.toContain("e1g1");
    expect(moves).toContain("e1c1");
  });

  it("forbids castling into an attacked square", () => {
    const moves = legalUci(parseFen("4k3/8/8/8/8/6r1/8/R3K2R w KQ - 0 1"));
    expect(moves).not.toContain("e1g1");
    expect(moves).toContain("e1c1");
  });

  it("forbids queenside castling when d1 or c1 is attacked", () => {
    expect(legalUci(parseFen("4k3/8/8/8/8/3r4/8/R3K2R w KQ - 0 1"))).not.toContain("e1c1");
    expect(legalUci(parseFen("4k3/8/8/8/8/2r5/8/R3K2R w KQ - 0 1"))).not.toContain("e1c1");
  });

  it("allows queenside castling when only b1 is attacked", () => {
    const moves = legalUci(parseFen("1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1"));
    expect(moves).toContain("e1c1");
    expect(moves).toContain("e1g1");
  });

  it("allows castling when only the rook is attacked", () => {
    const moves = legalUci(parseFen("4k2r/8/8/8/8/8/8/R3K2R w KQk - 0 1"));
    expect(moves).toContain("e1g1");
  });

  it("black castling mirrors white", () => {
    const moves = legalUci(parseFen("r3k2r/8/8/8/8/8/8/1R2K2R b kq - 0 1"));
    expect(moves).toContain("e8c8");
    expect(moves).toContain("e8g8");
    const blocked = legalUci(parseFen("r3k2r/8/8/8/8/8/8/3RK1R1 b kq - 0 1"));
    expect(blocked).not.toContain("e8c8");
  });

  it("does not castle when pieces are in between", () => {
    const moves = legalUci(parseFen("4k3/8/8/8/8/8/8/RN2K1NR w KQ - 0 1"));
    expect(moves).not.toContain("e1c1");
    expect(moves).not.toContain("e1g1");
  });
});

describe("makeMove / unmakeMove state", () => {
  it("moves the rook when castling and updates king square and rights", () => {
    const pos = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const before = snapshot(pos);
    makeMove(pos, find(pos, "e1g1"));
    expect(toFen(pos)).toBe("r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1");
    expect(pos.whiteKing).toBe(parseSquare("g1"));
    expectHashConsistent(pos);
    makeMove(pos, find(pos, "e8c8"));
    expect(toFen(pos)).toBe("2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2");
    expect(pos.blackKing).toBe(parseSquare("c8"));
    expectHashConsistent(pos);
    unmakeMove(pos);
    unmakeMove(pos);
    expect(snapshot(pos)).toEqual(before);
  });

  it("capturing a rook on its home square removes the opponent's right", () => {
    const pos = parseFen("r3k2r/8/8/4B3/8/8/8/R3K2R w KQkq - 0 1");
    const before = snapshot(pos);
    makeMove(pos, find(pos, "e5h8"));
    expect(pos.castling).toBe(CASTLE_WHITE_KING | CASTLE_WHITE_QUEEN | CASTLE_BLACK_QUEEN);
    expectHashConsistent(pos);
    unmakeMove(pos);
    expect(snapshot(pos)).toEqual(before);
  });

  it("black capturing the a1 rook removes white queenside right", () => {
    const pos = parseFen("r3k2r/8/8/4b3/8/8/8/R3K2R b KQkq - 0 1");
    makeMove(pos, find(pos, "e5a1"));
    expect(pos.castling & CASTLE_WHITE_QUEEN).toBe(0);
    expect(pos.castling & CASTLE_WHITE_KING).not.toBe(0);
    expect(pos.castling & CASTLE_BLACK_KING).not.toBe(0);
    expect(pos.castling & CASTLE_BLACK_QUEEN).not.toBe(0);
    expectHashConsistent(pos);
  });

  it("moving a rook or the king removes the matching rights only", () => {
    const pos = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    makeMove(pos, find(pos, "a1a2"));
    expect(pos.castling).toBe(CASTLE_WHITE_KING | CASTLE_BLACK_KING | CASTLE_BLACK_QUEEN);
    makeMove(pos, find(pos, "h8h7"));
    expect(pos.castling).toBe(CASTLE_WHITE_KING | CASTLE_BLACK_QUEEN);
    makeMove(pos, find(pos, "e1e2"));
    expect(pos.castling).toBe(CASTLE_BLACK_QUEEN);
    makeMove(pos, find(pos, "e8e7"));
    expect(pos.castling).toBe(0);
    expectHashConsistent(pos);
  });

  it("promotion with capture then unmake restores everything", () => {
    for (const promo of ["q", "r", "b", "n"]) {
      const pos = parseFen("r3k3/1P6/8/8/8/8/8/4K3 w q - 0 1");
      const before = snapshot(pos);
      makeMove(pos, find(pos, `b7a8${promo}`));
      expect(toFen(pos).split(" ")[0].startsWith(`${promo.toUpperCase()}3k3`)).toBe(true);
      expect(pos.castling).toBe(0);
      expect(pos.halfmoveClock).toBe(0);
      expectHashConsistent(pos);
      unmakeMove(pos);
      expect(snapshot(pos)).toEqual(before);
    }
  });

  it("black quiet promotion", () => {
    const pos = parseFen("4k3/8/8/8/8/8/1p6/4K2R b K - 0 1");
    const before = snapshot(pos);
    makeMove(pos, find(pos, "b2b1n"));
    expect(toFen(pos)).toBe("4k3/8/8/8/8/8/8/1n2K2R w K - 0 2");
    expectHashConsistent(pos);
    unmakeMove(pos);
    expect(snapshot(pos)).toEqual(before);
  });

  it("double push sets the en passant square, any other move clears it", () => {
    const pos = parseFen(START_FEN);
    makeMove(pos, find(pos, "e2e4"));
    expect(pos.epSquare).toBe(parseSquare("e3"));
    expect(pos.sideToMove).toBe(BLACK);
    expectHashConsistent(pos);
    makeMove(pos, find(pos, "g8f6"));
    expect(pos.epSquare).toBe(NO_SQUARE);
    expect(pos.halfmoveClock).toBe(1);
    expect(pos.fullmoveNumber).toBe(2);
    expectHashConsistent(pos);
    unmakeMove(pos);
    expect(pos.epSquare).toBe(parseSquare("e3"));
    unmakeMove(pos);
    expect(pos.epSquare).toBe(NO_SQUARE);
    expect(toFen(pos)).toBe(START_FEN);
  });

  it("en passant capture removes the pawn and restores on unmake; hash stays consistent", () => {
    const pos = parseFen(START_FEN);
    play(pos, "e2e4", "a7a6", "e4e5", "d7d5");
    expect(pos.epSquare).toBe(parseSquare("d6"));
    expectHashConsistent(pos);
    const before = snapshot(pos);
    makeMove(pos, find(pos, "e5d6"));
    expect(pos.board[parseSquare("d5")]).toBe(0);
    expect(pos.board[parseSquare("d6")]).toBe(1);
    expect(pos.halfmoveClock).toBe(0);
    expectHashConsistent(pos);
    unmakeMove(pos);
    expect(snapshot(pos)).toEqual(before);
    expect(pos.board[parseSquare("d5")]).toBe(-1);
  });

  it("halfmove clock resets on capture and pawn move, increments otherwise", () => {
    const pos = parseFen("4k3/8/8/3p4/8/8/3P4/R3K3 w - - 7 20");
    makeMove(pos, find(pos, "a1a5"));
    expect(pos.halfmoveClock).toBe(8);
    makeMove(pos, find(pos, "e8e7"));
    expect(pos.halfmoveClock).toBe(9);
    expect(pos.fullmoveNumber).toBe(21);
    makeMove(pos, find(pos, "a5d5"));
    expect(pos.halfmoveClock).toBe(0);
    makeMove(pos, find(pos, "e7e8"));
    makeMove(pos, find(pos, "d2d3"));
    expect(pos.halfmoveClock).toBe(0);
  });

  it("history length tracks makeMove/unmakeMove", () => {
    const pos = parseFen(START_FEN);
    play(pos, "e2e4", "e7e5");
    expect(pos.history.length).toBe(2);
    unmakeMove(pos);
    expect(pos.history.length).toBe(1);
  });
});

describe("random positions", () => {
  const positions = randomPositions({ count: 400, seed: 777 });

  it("legal moves match chess.js, and make/unmake restores everything", () => {
    for (const rp of positions) {
      const pos = parseFen(rp.fen);
      const oracle = new Chess(rp.fen)
        .moves({ verbose: true })
        .map((m) => m.lan)
        .sort();
      expect(legalUci(pos)).toEqual(oracle);
      const before = snapshot(pos);
      for (const move of generateLegalMoves(pos)) {
        makeMove(pos, move);
        const text = uci(move);
        const c = new Chess(rp.fen);
        c.move({ from: text.slice(0, 2), to: text.slice(2, 4), promotion: text[4] });
        const ours = toFen(pos).split(" ");
        const theirs = c.fen().split(" ");
        expect(ours.slice(0, 3)).toEqual(theirs.slice(0, 3));
        expectHashConsistent(pos);
        unmakeMove(pos);
        expect(snapshot(pos)).toEqual(before);
      }
    }
  }, 120000);

  it("inCheck / mate / stalemate agree with chess.js", () => {
    for (const rp of positions) {
      const pos = parseFen(rp.fen);
      const c = new Chess(rp.fen);
      expect(inCheck(pos)).toBe(c.inCheck());
      expect(isCheckmate(pos)).toBe(c.isCheckmate());
      expect(isStalemate(pos)).toBe(c.isStalemate());
    }
  });

  it("incremental hash matches computeHash along long random games", () => {
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return (seed >>> 8) % n;
    };
    for (let g = 0; g < 12; g++) {
      const pos = parseFen(PERFT_CASES[g % PERFT_CASES.length].fen);
      const start = snapshot(pos);
      let plies = 0;
      for (; plies < 150; plies++) {
        const moves = generateLegalMoves(pos);
        if (moves.length === 0) break;
        makeMove(pos, moves[rnd(moves.length)]);
        expectHashConsistent(pos);
      }
      for (let i = 0; i < plies; i++) {
        unmakeMove(pos);
        expectHashConsistent(pos);
      }
      expect(snapshot(pos)).toEqual(start);
    }
  });
});

describe("check, checkmate, stalemate", () => {
  it("detects scholar's mate", () => {
    const pos = parseFen(START_FEN);
    play(pos, "e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7");
    expect(inCheck(pos)).toBe(true);
    expect(isCheckmate(pos)).toBe(true);
    expect(isStalemate(pos)).toBe(false);
    expect(generateLegalMoves(pos)).toHaveLength(0);
  });

  it("detects fool's mate", () => {
    const pos = parseFen(START_FEN);
    play(pos, "f2f3", "e7e5", "g2g4", "d8h4");
    expect(isCheckmate(pos)).toBe(true);
  });

  it("detects the classic stalemate", () => {
    const pos = parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(inCheck(pos)).toBe(false);
    expect(isStalemate(pos)).toBe(true);
    expect(isCheckmate(pos)).toBe(false);
  });

  it("a check with escapes is neither mate nor stalemate", () => {
    const pos = parseFen("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1");
    expect(inCheck(pos)).toBe(true);
    expect(isCheckmate(pos)).toBe(false);
    expect(isStalemate(pos)).toBe(false);
  });

  it("start position is quiet", () => {
    const pos = parseFen(START_FEN);
    expect(inCheck(pos)).toBe(false);
    expect(isCheckmate(pos)).toBe(false);
    expect(isStalemate(pos)).toBe(false);
    expect(generateLegalMoves(pos)).toHaveLength(20);
  });
});

describe("repetitionCount", () => {
  const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];

  it("is 1 for a fresh position", () => {
    expect(repetitionCount(parseFen(START_FEN))).toBe(1);
  });

  it("counts 3 on the initial position after two knight cycles", () => {
    const pos = parseFen(START_FEN);
    play(pos, ...cycle);
    expect(repetitionCount(pos)).toBe(2);
    play(pos, ...cycle);
    expect(repetitionCount(pos)).toBe(3);
  });

  it("decreases after unmakeMove", () => {
    const pos = parseFen(START_FEN);
    play(pos, ...cycle, ...cycle);
    unmakeMove(pos);
    // 7 plies: same position as after 3 plies (black to move, knight back on g1).
    expect(repetitionCount(pos)).toBe(2);
    unmakeMove(pos);
    unmakeMove(pos);
    unmakeMove(pos);
    expect(repetitionCount(pos)).toBe(2);
  });

  it("an intermediate pawn move resets the count", () => {
    const pos = parseFen(START_FEN);
    play(pos, ...cycle, "e2e4", "e7e5");
    expect(repetitionCount(pos)).toBe(1);
    play(pos, ...cycle);
    expect(repetitionCount(pos)).toBe(2);
  });

  it("a pawn move between two occurrences keeps the old position out of the count", () => {
    const pos = parseFen(START_FEN);
    play(pos, "g1f3", "g8f6", "e2e4", "e7e5", "f3g1", "f6g8");
    // Same piece placement as the start except the pawns moved: never a repeat of the start.
    expect(repetitionCount(pos)).toBe(1);
  });

  it("does not match across an irreversible capture", () => {
    const pos = parseFen("4k3/8/8/3p4/8/8/8/R3K3 w - - 0 1");
    play(pos, "a1a5", "e8e7", "a5d5", "e7e8", "d5a5", "e8e7", "a5d5", "e7e8");
    expect(repetitionCount(pos)).toBe(2);
  });

  it("a lost castling right yields a different position, not a repetition", () => {
    const pos = parseFen("r3k3/8/8/8/8/8/8/R3K3 w Qq - 0 1");
    play(pos, "a1a2", "a8a7", "a2a1", "a7a8");
    expect(toFen(pos).split(" ")[0]).toBe("r3k3/8/8/8/8/8/8/R3K3");
    expect(repetitionCount(pos)).toBe(1);
  });

  it("king shuffle repeats", () => {
    const pos = parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    play(pos, "e1e2", "e8e7", "e2e1", "e7e8", "e1e2", "e8e7", "e2e1", "e7e8");
    expect(repetitionCount(pos)).toBe(3);
  });
});

describe("perft", () => {
  it("depth 0 is 1 and perft does not mutate the position", () => {
    const pos = parseFen(PERFT_CASES[1].fen);
    const before = snapshot(pos);
    expect(perft(pos, 0)).toBe(1);
    expect(perft(pos, 2)).toBe(PERFT_CASES[1].counts[1]);
    expect(snapshot(pos)).toEqual(before);
  });

  it("perft(1) equals the number of legal moves", () => {
    for (const c of PERFT_CASES) {
      const pos = parseFen(c.fen);
      expect(perft(pos, 1)).toBe(generateLegalMoves(pos).length);
    }
  });

  it("perftDivide sums to perft and lists each legal move once", () => {
    for (const c of PERFT_CASES) {
      const pos = parseFen(c.fen);
      const before = snapshot(pos);
      const div = perftDivide(pos, 2);
      expect(div.map((d) => uci(d.move)).sort()).toEqual(legalUci(pos));
      expect(div.reduce((s, d) => s + d.nodes, 0)).toBe(c.counts[1]);
      expect(snapshot(pos)).toEqual(before);
    }
  });

  it("perft on a stalemate position is 0 at depth 1", () => {
    expect(perft(parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), 1)).toBe(0);
  });

  it("perft counts for edge positions (en passant pin, castling, promotion) match chess.js", () => {
    const fens = [
      "8/8/8/KPp4r/8/8/8/7k w - c6 0 1",
      "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
      "1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1",
      "r3k3/1P6/8/8/8/8/8/4K3 w q - 0 1",
    ];
    const count = (c: Chess, d: number): number => {
      if (d === 0) return 1;
      let n = 0;
      for (const m of c.moves({ verbose: true })) {
        c.move(m);
        n += count(c, d - 1);
        c.undo();
      }
      return n;
    };
    for (const fen of fens) {
      expect(perft(parseFen(fen), 3)).toBe(count(new Chess(fen), 3));
    }
  }, 120000);
});
