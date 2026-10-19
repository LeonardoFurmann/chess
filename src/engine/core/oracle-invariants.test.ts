import { describe, expect, it } from "vitest";
// Fixtures live outside src, so the alias cannot reach them.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { randomPositions } from "../../../test/fixtures/random-positions";
import { parseFen } from "./fen";
import { generateLegalMoves } from "./legal";
import { makeMove, unmakeMove } from "./make-move";
import { moveToUci } from "./notation";
import type { Position } from "./position";
import { computeHash } from "./zobrist";

// Same seed (default) and count as the fast suite in test/oracle/oracle.test.ts.
const POSITION_COUNT = 2_000;

function snapshot(p: Position): string {
  return JSON.stringify({
    board: Array.from(p.board),
    side: p.sideToMove,
    castling: p.castling,
    ep: p.epSquare,
    half: p.halfmoveClock,
    full: p.fullmoveNumber,
    wk: p.whiteKing,
    bk: p.blackKing,
    hi: p.hashHi,
    lo: p.hashLo,
    history: p.history.length,
  });
}

describe("make/unmake and incremental hash on every oracle position", () => {
  it(
    `holds for every legal move of ${POSITION_COUNT} seeded random positions`,
    { timeout: 25_000 },
    () => {
      const failures: string[] = [];
      let positions = 0;
      let moves = 0;

      for (const { fen } of randomPositions({ count: POSITION_COUNT })) {
        positions++;
        const position = parseFen(fen);
        const before = snapshot(position);
        for (const move of generateLegalMoves(position)) {
          moves++;
          const uci = moveToUci(move);
          makeMove(position, move);
          const fresh = computeHash(position);
          if (fresh.hi !== position.hashHi || fresh.lo !== position.hashLo) {
            failures.push(`FEN ${fen} move ${uci}: incremental hash differs from computeHash`);
          }
          unmakeMove(position);
          if (snapshot(position) !== before) {
            failures.push(`FEN ${fen} move ${uci}: unmakeMove did not restore the position`);
          }
        }
        if (failures.length >= 10) break;
      }

      console.info(`oracle invariants: ${positions} positions, ${moves} legal moves`);
      expect(failures.join("\n")).toBe("");
      expect(positions).toBeGreaterThanOrEqual(2_000);
      expect(moves).toBeGreaterThan(positions);
    },
  );
});
