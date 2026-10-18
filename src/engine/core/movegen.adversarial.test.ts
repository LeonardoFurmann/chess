import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
/* eslint-disable @typescript-eslint/no-restricted-imports */
import { PERFT_CASES } from "../../../test/fixtures/perft";
import { randomPositions } from "../../../test/fixtures/random-positions";
/* eslint-enable @typescript-eslint/no-restricted-imports */
import { squareName } from "./board";
import { START_FEN, parseFen, toFen } from "./fen";
import { generatePseudoLegalMoves } from "./movegen";
import {
  MOVE_CAPTURE,
  MOVE_CASTLE_KING,
  MOVE_CASTLE_QUEEN,
  MOVE_DOUBLE_PUSH,
  MOVE_EN_PASSANT,
  MOVE_PROMOTION,
  hasFlag,
  moveFrom,
  movePromotion,
  moveTo,
} from "./move";
import { BISHOP, KING, KNIGHT, QUEEN, ROOK, WHITE } from "./types";

const PROMO_LETTER: Record<number, string> = { [KNIGHT]: "n", [BISHOP]: "b", [ROOK]: "r", [QUEEN]: "q" };

function uci(move: number): string {
  const p = movePromotion(move);
  return squareName(moveFrom(move)) + squareName(moveTo(move)) + (p ? PROMO_LETTER[p] : "");
}

function gen(fen: string): number[] {
  return generatePseudoLegalMoves(parseFen(fen));
}

function ucis(fen: string): string[] {
  return gen(fen).map(uci);
}

function find(fen: string, u: string): number | undefined {
  return gen(fen).find((m) => uci(m) === u);
}

describe("movegen adversarial: counts", () => {
  it("initial position has 20 moves for white and for black", () => {
    expect(gen(START_FEN)).toHaveLength(20);
    expect(gen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1")).toHaveLength(20);
  });

  it("initial double pushes carry the double push flag, single pushes do not", () => {
    const e4 = find(START_FEN, "e2e4")!;
    const e3 = find(START_FEN, "e2e3")!;
    expect(hasFlag(e4, MOVE_DOUBLE_PUSH)).toBe(true);
    expect(hasFlag(e3, MOVE_DOUBLE_PUSH)).toBe(false);
    expect(hasFlag(e3, MOVE_CAPTURE)).toBe(false);
  });

  it("lone queen in the a1 corner has 21 moves (plus 8 of a king off its lines)", () => {
    const moves = ucis("8/7k/8/8/8/6K1/8/Q7 w - - 0 1");
    expect(moves.filter((m) => m.startsWith("a1"))).toHaveLength(21);
    expect(moves).toHaveLength(21 + 8);
  });

  it("lone queen in the h8 corner for black has 21 moves", () => {
    const moves = ucis("7q/8/8/8/8/8/6k1/1K6 b - - 0 1").filter((m) => m.startsWith("h8"));
    expect(moves).toHaveLength(21);
  });

  it("knight in the corner has exactly 2 moves", () => {
    const moves = ucis("8/7k/8/8/8/6K1/8/N7 w - - 0 1").filter((m) => m.startsWith("a1"));
    expect(moves.sort()).toEqual(["a1b3", "a1c2"]);
  });
});

describe("movegen adversarial: pawns", () => {
  it("white pawn on the 7th with free square and two captures gives 12 promotions", () => {
    const fen = "1n1n4/2P5/8/8/8/8/8/k6K w - - 0 1";
    const moves = gen(fen).filter((m) => squareName(moveFrom(m)) === "c7");
    expect(moves).toHaveLength(12);
    for (const m of moves) {
      expect(hasFlag(m, MOVE_PROMOTION)).toBe(true);
      expect([KNIGHT, BISHOP, ROOK, QUEEN]).toContain(movePromotion(m));
    }
    expect(moves.filter((m) => hasFlag(m, MOVE_CAPTURE))).toHaveLength(8);
    for (const to of ["c8", "b8", "d8"]) {
      const kinds = moves.filter((m) => squareName(moveTo(m)) === to).map(movePromotion);
      expect(kinds.sort()).toEqual([KNIGHT, BISHOP, ROOK, QUEEN].sort());
    }
    const push = moves.filter((m) => squareName(moveTo(m)) === "c8");
    expect(push.every((m) => !hasFlag(m, MOVE_CAPTURE))).toBe(true);
  });

  it("black pawn on the 2nd promotes downwards, 12 moves", () => {
    const fen = "K6k/8/8/8/8/8/2p5/1N1N4 b - - 0 1";
    const moves = gen(fen).filter((m) => squareName(moveFrom(m)) === "c2");
    expect(moves).toHaveLength(12);
    expect(moves.every((m) => hasFlag(m, MOVE_PROMOTION))).toBe(true);
    expect(moves.every((m) => squareName(moveTo(m))[1] === "1")).toBe(true);
  });

  it("blocked promotion pawn: no push, only captures", () => {
    const fen = "1nn1k3/2P5/8/8/8/8/8/4K3 w - - 0 1";
    const moves = ucis(fen).filter((m) => m.startsWith("c7"));
    expect(moves.filter((m) => m.startsWith("c7c8"))).toHaveLength(0);
    expect(moves.filter((m) => m.startsWith("c7b8"))).toHaveLength(4);
    expect(moves).toHaveLength(4);
  });

  it("promotion pawns on the a/h files stay on the board (no wrap-around)", () => {
    const moves = ucis("1n4n1/P6P/8/8/8/8/8/k6K w - - 0 1");
    expect(moves.filter((m) => m.startsWith("a7"))).toHaveLength(8); // a8 push + b8 capture
    expect(moves.filter((m) => m.startsWith("h7"))).toHaveLength(8); // h8 push + g8 capture
  });

  it("pawns do not capture forward or sideways", () => {
    const moves = ucis("4k3/8/8/8/3p4/3P4/8/4K3 w - - 0 1").filter((m) => m.startsWith("d3"));
    expect(moves).toEqual([]);
  });

  it("black pawn pushes and captures go downwards", () => {
    const fen = "4k3/3p4/4P3/8/8/8/8/4K3 b - - 0 1";
    const moves = ucis(fen).filter((m) => m.startsWith("d7"));
    expect(moves.sort()).toEqual(["d7d5", "d7d6", "d7e6"]);
    expect(hasFlag(find(fen, "d7d5")!, MOVE_DOUBLE_PUSH)).toBe(true);
    expect(hasFlag(find(fen, "d7e6")!, MOVE_CAPTURE)).toBe(true);
  });

  it("double push blocked by the intermediate square", () => {
    const moves = ucis("4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1").filter((m) => m.startsWith("e2"));
    expect(moves).toEqual([]);
  });

  it("double push blocked by the destination square (single push still allowed)", () => {
    const moves = ucis("4k3/8/8/8/4n3/8/4P3/4K3 w - - 0 1").filter((m) => m.startsWith("e2"));
    expect(moves).toEqual(["e2e3"]);
  });

  it("black double push blocked at either square", () => {
    expect(ucis("4k3/4p3/4N3/8/8/8/8/4K3 b - - 0 1").filter((m) => m.startsWith("e7"))).toEqual([]);
    expect(ucis("4k3/4p3/8/4N3/8/8/8/4K3 b - - 0 1").filter((m) => m.startsWith("e7"))).toEqual(["e7e6"]);
  });

  it("no double push from a non-initial rank", () => {
    const moves = ucis("4k3/8/8/8/8/4P3/8/4K3 w - - 0 1").filter((m) => m.startsWith("e3"));
    expect(moves).toEqual(["e3e4"]);
  });
});

describe("movegen adversarial: en passant", () => {
  it("generated when ep square is set and adjacent pawn exists (white, both sides)", () => {
    const fen = "4k3/8/8/3pPp2/8/8/8/4K3 w - d6 0 1";
    const m = find(fen, "e5d6")!;
    expect(m).toBeDefined();
    expect(hasFlag(m, MOVE_EN_PASSANT)).toBe(true);
    expect(hasFlag(m, MOVE_CAPTURE)).toBe(true);
    expect(find(fen, "e5f6")).toBeUndefined();
    const m2 = find("4k3/8/8/3pPp2/8/8/8/4K3 w - f6 0 1", "e5f6")!;
    expect(hasFlag(m2, MOVE_EN_PASSANT)).toBe(true);
  });

  it("not generated when ep square is undefined", () => {
    expect(find("4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1", "e5d6")).toBeUndefined();
  });

  it("not generated when no pawn is adjacent to the ep square", () => {
    const moves = gen("4k3/8/8/3p4/8/8/4P3/4K3 w - d6 0 1");
    expect(moves.some((m) => hasFlag(m, MOVE_EN_PASSANT))).toBe(false);
  });

  it("not generated for a pawn on the wrong rank", () => {
    const moves = gen("4k3/8/8/3p4/8/4P3/8/4K3 w - d6 0 1");
    expect(moves.some((m) => hasFlag(m, MOVE_EN_PASSANT))).toBe(false);
  });

  it("not generated by a non-pawn piece adjacent to the ep square", () => {
    const moves = gen("4k3/8/8/3pN3/8/8/8/4K3 w - d6 0 1");
    expect(moves.some((m) => hasFlag(m, MOVE_EN_PASSANT))).toBe(false);
  });

  it("a-file: b5xa6 e.p. and h-file: g5xh6 e.p.", () => {
    const a = find("4k3/8/8/pP6/8/8/8/4K3 w - a6 0 1", "b5a6")!;
    expect(hasFlag(a, MOVE_EN_PASSANT)).toBe(true);
    const h = find("4k3/8/8/6Pp/8/8/8/4K3 w - h6 0 1", "g5h6")!;
    expect(hasFlag(h, MOVE_EN_PASSANT)).toBe(true);
  });

  it("edge-file pawn does not capture en passant across the board edge", () => {
    const moves = gen("4k3/8/8/P6p/8/8/8/4K3 w - h6 0 1");
    expect(moves.some((m) => hasFlag(m, MOVE_EN_PASSANT))).toBe(false);
    const moves2 = gen("4k3/8/8/p6P/8/8/8/4K3 w - a6 0 1");
    expect(moves2.some((m) => hasFlag(m, MOVE_EN_PASSANT))).toBe(false);
  });

  it("black en passant, including a and h files", () => {
    const m = find("4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1", "d4e3")!;
    expect(hasFlag(m, MOVE_EN_PASSANT)).toBe(true);
    expect(hasFlag(m, MOVE_CAPTURE)).toBe(true);
    expect(hasFlag(find("4k3/8/8/8/pP6/8/8/4K3 b - b3 0 1", "a4b3")!, MOVE_EN_PASSANT)).toBe(true);
    expect(hasFlag(find("4k3/8/8/8/6Pp/8/8/4K3 b - g3 0 1", "h4g3")!, MOVE_EN_PASSANT)).toBe(true);
  });

  it("two pawns can both capture en passant", () => {
    const moves = gen("4k3/8/8/3PpP2/8/8/8/4K3 w - e6 0 1").filter((m) => hasFlag(m, MOVE_EN_PASSANT));
    expect(moves.map(uci).sort()).toEqual(["d5e6", "f5e6"]);
  });
});

describe("movegen adversarial: castling", () => {
  const KIWI = PERFT_CASES.find((c) => c.name === "kiwipete")!.fen;
  const KIWI_BLACK = KIWI.replace(" w ", " b ");
  const castles = (fen: string) =>
    gen(fen).filter((m) => hasFlag(m, MOVE_CASTLE_KING) || hasFlag(m, MOVE_CASTLE_QUEEN));

  it("kiwipete: white generates both castles encoded as king moves", () => {
    expect(castles(KIWI).map(uci).sort()).toEqual(["e1c1", "e1g1"]);
    expect(hasFlag(find(KIWI, "e1g1")!, MOVE_CASTLE_KING)).toBe(true);
    expect(hasFlag(find(KIWI, "e1c1")!, MOVE_CASTLE_QUEEN)).toBe(true);
    expect(hasFlag(find(KIWI, "e1g1")!, MOVE_CAPTURE)).toBe(false);
  });

  it("kiwipete: black generates both castles", () => {
    expect(castles(KIWI_BLACK).map(uci).sort()).toEqual(["e8c8", "e8g8"]);
    expect(hasFlag(find(KIWI_BLACK, "e8g8")!, MOVE_CASTLE_KING)).toBe(true);
    expect(hasFlag(find(KIWI_BLACK, "e8c8")!, MOVE_CASTLE_QUEEN)).toBe(true);
  });

  it("no castling without the right", () => {
    expect(castles("r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1")).toHaveLength(0);
    expect(castles("r3k2r/8/8/8/8/8/8/R3K2R b - - 0 1")).toHaveLength(0);
  });

  it("only the available right is used", () => {
    expect(castles("r3k2r/8/8/8/8/8/8/R3K2R w K - 0 1").map(uci)).toEqual(["e1g1"]);
    expect(castles("r3k2r/8/8/8/8/8/8/R3K2R w Q - 0 1").map(uci)).toEqual(["e1c1"]);
    expect(castles("r3k2r/8/8/8/8/8/8/R3K2R b k - 0 1").map(uci)).toEqual(["e8g8"]);
    expect(castles("r3k2r/8/8/8/8/8/8/R3K2R b q - 0 1").map(uci)).toEqual(["e8c8"]);
  });

  it("white rights do not let black castle and vice versa", () => {
    expect(castles("r3k2r/8/8/8/8/8/8/R3K2R b KQ - 0 1")).toHaveLength(0);
    expect(castles("r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1")).toHaveLength(0);
  });

  it("long castle blocked by a piece on b1 (and b8)", () => {
    expect(castles("4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1").map(uci)).toEqual(["e1g1"]);
    expect(castles("rn2k2r/8/8/8/8/8/8/4K3 b kq - 0 1").map(uci)).toEqual(["e8g8"]);
  });

  it("long castle blocked by c1 or d1, short by f1 or g1", () => {
    expect(castles("4k3/8/8/8/8/8/8/R1B1K2R w KQ - 0 1").map(uci)).toEqual(["e1g1"]);
    expect(castles("4k3/8/8/8/8/8/8/R2BK2R w KQ - 0 1").map(uci)).toEqual(["e1g1"]);
    expect(castles("4k3/8/8/8/8/8/8/R3KB1R w KQ - 0 1").map(uci)).toEqual(["e1c1"]);
    expect(castles("4k3/8/8/8/8/8/8/R3K1NR w KQ - 0 1").map(uci)).toEqual(["e1c1"]);
  });

  it("blocked by enemy pieces too", () => {
    expect(castles("4k3/8/8/8/8/8/8/Rn2K1nR w KQ - 0 1")).toHaveLength(0);
  });

  it("no castle when the rook is missing despite the right", () => {
    expect(castles("4k3/8/8/8/8/8/8/4K2R w KQ - 0 1").map(uci)).toEqual(["e1g1"]);
    expect(castles("4k3/8/8/8/8/8/8/R3K3 w KQ - 0 1").map(uci)).toEqual(["e1c1"]);
    expect(castles("4k3/8/8/8/8/8/8/4K3 w KQ - 0 1")).toHaveLength(0);
    expect(castles("r3k3/8/8/8/8/8/8/4K3 b kq - 0 1").map(uci)).toEqual(["e8c8"]);
  });

  it("no castle when another piece (or an enemy rook) stands on the rook square", () => {
    expect(castles("4k3/8/8/8/8/8/8/4K2B w K - 0 1")).toHaveLength(0);
    expect(castles("4k3/8/8/8/8/8/8/4K2r w K - 0 1")).toHaveLength(0);
  });

  it("castling is still generated when the king is attacked (T1.6 filters)", () => {
    expect(castles("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1").map(uci).sort()).toEqual(["e1c1", "e1g1"]);
  });
});

describe("movegen adversarial: invariants", () => {
  it("does not mutate the position", () => {
    const pos = parseFen(PERFT_CASES.find((c) => c.name === "kiwipete")!.fen);
    const before = toFen(pos);
    const board = Array.from(pos.board);
    generatePseudoLegalMoves(pos);
    expect(toFen(pos)).toBe(before);
    expect(Array.from(pos.board)).toEqual(board);
    expect(pos.history).toHaveLength(0);
  });

  it("no duplicates, no own-piece captures, no king captures, capture flag matches target", () => {
    for (const c of PERFT_CASES) {
      const pos = parseFen(c.fen);
      const moves = generatePseudoLegalMoves(pos);
      expect(new Set(moves).size).toBe(moves.length);
      const sign = pos.sideToMove === WHITE ? 1 : -1;
      for (const m of moves) {
        expect(pos.board[moveFrom(m)] * sign).toBeGreaterThan(0);
        const target = pos.board[moveTo(m)] * sign;
        expect(target).toBeLessThanOrEqual(0);
        expect(Math.abs(target)).not.toBe(KING);
        if (!hasFlag(m, MOVE_EN_PASSANT)) {
          expect(hasFlag(m, MOVE_CAPTURE)).toBe(target < 0);
        }
      }
    }
  });
});

describe("movegen adversarial: superset of chess.js legal moves", () => {
  const positions = randomPositions({ count: 400, seed: 7 });

  it("every legal chess.js move appears with matching flags", () => {
    for (const rp of positions) {
      const chess = new Chess(rp.fen);
      const pseudo = new Map<string, number>();
      for (const m of gen(rp.fen)) pseudo.set(uci(m), m);
      for (const lm of chess.moves({ verbose: true })) {
        const m = pseudo.get(lm.lan);
        expect(m, `${rp.fen} missing ${lm.lan}`).toBeDefined();
        const f = lm.flags;
        expect(hasFlag(m!, MOVE_CAPTURE), `${rp.fen} ${lm.lan} capture`).toBe(f.includes("c") || f.includes("e"));
        expect(hasFlag(m!, MOVE_EN_PASSANT), `${rp.fen} ${lm.lan} ep`).toBe(f.includes("e"));
        expect(hasFlag(m!, MOVE_DOUBLE_PUSH), `${rp.fen} ${lm.lan} dbl`).toBe(f.includes("b"));
        expect(hasFlag(m!, MOVE_CASTLE_KING), `${rp.fen} ${lm.lan} ck`).toBe(f.includes("k"));
        expect(hasFlag(m!, MOVE_CASTLE_QUEEN), `${rp.fen} ${lm.lan} cq`).toBe(f.includes("q"));
        expect(hasFlag(m!, MOVE_PROMOTION), `${rp.fen} ${lm.lan} promo`).toBe(f.includes("p"));
      }
    }
  }, 60_000);

  it("superset holds on the perft fixtures too", () => {
    for (const c of PERFT_CASES) {
      const pseudo = new Set(ucis(c.fen));
      const legal = new Chess(c.fen).moves({ verbose: true });
      for (const lm of legal) expect(pseudo.has(lm.lan), `${c.name} ${lm.lan}`).toBe(true);
      expect(pseudo.size).toBeGreaterThanOrEqual(legal.length);
    }
  });
});
