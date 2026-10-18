import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PERFT_CASES } from "../../../test/fixtures/perft";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { randomPositions } from "../../../test/fixtures/random-positions";
import { isFiftyMoveDraw, isInsufficientMaterial } from "./draw";
import { parseFen } from "./fen";
import { createRng } from "./rng";

const TRUE_CASES: Record<string, string> = {
  "K vs K": "4k3/8/8/8/8/8/8/4K3",
  "kings in corners": "k7/8/8/8/8/8/8/7K",
  "K+N vs K (white knight)": "4k3/8/8/8/8/8/8/3NK3",
  "K+N vs K (black knight)": "3nk3/8/8/8/8/8/8/4K3",
  "K+B vs K": "4k3/8/8/8/8/8/8/2B1K3",
  "K vs K+B (black bishop)": "2b1k3/8/8/8/8/8/8/4K3",
  "K+B vs K+B same colour (c1 vs f8)": "4kb2/8/8/8/8/8/8/2B1K3",
  "K+B vs K+B same colour (c1 vs a3)": "4k3/8/8/8/8/b7/8/2B1K3",
  "K+2B vs K, same colour (c1, f4)": "4k3/8/8/8/5B2/8/8/2B1K3",
  "K+2B vs K+B, all same colour": "4kb2/8/8/8/5B2/8/8/2B1K3",
};

const FALSE_CASES: Record<string, string> = {
  "white pawn": "4k3/8/8/8/8/8/4P3/4K3",
  "black pawn": "4k3/4p3/8/8/8/8/8/4K3",
  "white rook": "4k3/8/8/8/8/8/8/R3K3",
  "black queen": "3qk3/8/8/8/8/8/8/4K3",
  "K+N+N vs K": "4k3/8/8/8/8/8/8/1NN1K3",
  "K+N vs K+N": "1n2k3/8/8/8/8/8/8/1N2K3",
  "K+B vs K+N": "1n2k3/8/8/8/8/8/8/2B1K3",
  "K+N vs K+B": "2b1k3/8/8/8/8/8/8/1N2K3",
  "K+B vs K+B different colours (c1 vs c8)": "2b1k3/8/8/8/8/8/8/2B1K3",
  "K+2B vs K, different colours (c1, f1)": "4k3/8/8/8/8/8/8/2B1KB2",
  "K+B+N vs K": "4k3/8/8/8/8/8/8/1NB1K3",
  "K+2B vs K+B, one off-colour": "4kb2/8/8/8/8/8/8/2B1KB2",
};

const insufficient = (placement: string): boolean => isInsufficientMaterial(parseFen(`${placement} w - - 0 1`));

describe("isInsufficientMaterial", () => {
  for (const [name, placement] of Object.entries(TRUE_CASES)) {
    it(`is true for ${name}`, () => {
      expect(insufficient(placement)).toBe(true);
    });
  }
  for (const [name, placement] of Object.entries(FALSE_CASES)) {
    it(`is false for ${name}`, () => {
      expect(insufficient(placement)).toBe(false);
    });
  }

  it("agrees with chess.js on every hand-written case", () => {
    for (const placement of [...Object.values(TRUE_CASES), ...Object.values(FALSE_CASES)]) {
      const fen = `${placement} w - - 0 1`;
      expect(isInsufficientMaterial(parseFen(fen)), fen).toBe(new Chess(fen).isInsufficientMaterial());
    }
  });

  it("agrees with chess.js on perft fixtures", () => {
    for (const c of PERFT_CASES) {
      expect(isInsufficientMaterial(parseFen(c.fen)), c.name).toBe(new Chess(c.fen).isInsufficientMaterial());
    }
  });

  it("agrees with chess.js on random-game positions", () => {
    for (const p of randomPositions({ count: 400 })) {
      expect(isInsufficientMaterial(parseFen(p.fen)), p.fen).toBe(new Chess(p.fen).isInsufficientMaterial());
    }
  });

  it("agrees with chess.js on random sparse endgames", () => {
    const rng = createRng(1505);
    const pool = ["N", "B", "R", "Q", "P", "n", "b", "r", "q", "p"];
    let checked = 0;
    for (let i = 0; i < 3000; i++) {
      const squares = new Array<string>(64).fill("");
      const free = (): number => {
        let s = rng.nextInt(64);
        while (squares[s] !== "") s = rng.nextInt(64);
        return s;
      };
      squares[free()] = "K";
      squares[free()] = "k";
      const extra = rng.nextInt(5);
      for (let j = 0; j < extra; j++) {
        const piece = pool[rng.nextInt(pool.length)];
        const s = free();
        // Pawns never stand on the first or last rank.
        squares[s] = piece.toLowerCase() === "p" && (s < 8 || s >= 56) ? "N" : piece;
      }
      // Half of the positions keep minor pieces only, the interesting ones.
      if (rng.nextInt(2) === 0) {
        for (let s = 0; s < 64; s++) if (/[RQPrqp]/.test(squares[s])) squares[s] = "B";
      }
      const rows: string[] = [];
      for (let rank = 7; rank >= 0; rank--) {
        let row = "";
        let empty = 0;
        for (let file = 0; file < 8; file++) {
          const piece = squares[rank * 8 + file];
          if (piece === "") {
            empty++;
          } else {
            if (empty > 0) row += empty;
            empty = 0;
            row += piece;
          }
        }
        if (empty > 0) row += empty;
        rows.push(row);
      }
      const fen = `${rows.join("/")} w - - 0 1`;
      let oracle: boolean;
      try {
        oracle = new Chess(fen).isInsufficientMaterial();
      } catch {
        continue;
      }
      expect(isInsufficientMaterial(parseFen(fen)), fen).toBe(oracle);
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
  });
});

describe("isFiftyMoveDraw", () => {
  const withClock = (clock: number) => parseFen(`4k3/8/8/8/8/8/8/R3K3 w - - ${clock} 60`);

  it("is false at 0 and 99", () => {
    expect(isFiftyMoveDraw(withClock(0))).toBe(false);
    expect(isFiftyMoveDraw(withClock(99))).toBe(false);
  });

  it("is true at 100 and 120", () => {
    expect(isFiftyMoveDraw(withClock(100))).toBe(true);
    expect(isFiftyMoveDraw(withClock(120))).toBe(true);
  });
});
