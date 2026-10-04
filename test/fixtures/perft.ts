/**
 * Perft positions and node counts (https://www.chessprogramming.org/Perft_Results).
 * Every count was cross-checked with chess.js when the fixture was created.
 */
export interface PerftCase {
  name: string;
  fen: string;
  /** counts[i] = nodes at depth i + 1. */
  counts: readonly number[];
}

export const PERFT_CASES: readonly PerftCase[] = [
  {
    name: "initial",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    counts: [20, 400, 8902, 197281, 4865609],
  },
  {
    name: "kiwipete",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    counts: [48, 2039, 97862, 4085603],
  },
  {
    name: "position 3",
    fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    counts: [14, 191, 2812, 43238, 674624],
  },
  {
    name: "position 4",
    fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    counts: [6, 264, 9467, 422333],
  },
  {
    name: "position 5",
    fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    counts: [44, 1486, 62379, 2103487],
  },
  {
    name: "position 6",
    fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    counts: [46, 2079, 89890, 3894594],
  },
];

/** Node budget per position for the fast suite (`npm test`); deeper counts go to `test:slow`. */
export const FAST_SUITE_MAX_NODES = 500_000;

/** Depths whose count fits the fast suite. */
export function fastDepths(perftCase: PerftCase): number[] {
  return perftCase.counts.flatMap((nodes, i) => (nodes <= FAST_SUITE_MAX_NODES ? [i + 1] : []));
}

/** Depths reserved for the slow suite. */
export function slowDepths(perftCase: PerftCase): number[] {
  return perftCase.counts.flatMap((nodes, i) => (nodes > FAST_SUITE_MAX_NODES ? [i + 1] : []));
}
