/**
 * Mate puzzles validated with chess.js when the fixture was created (see fixtures.test.ts).
 * `solutions` lists every first move (UCI) that forces the mate in the given number of moves.
 */
export interface MatePuzzle {
  fen: string;
  solutions: readonly string[];
}

export const MATE_IN_1: readonly MatePuzzle[] = [
  { fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", solutions: ["a1a8"] },
  { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4", solutions: ["f3f7"] },
  { fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", solutions: ["d8h4"] },
  { fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", solutions: ["g5f7"] },
  { fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1", solutions: ["f1f8"] },
  { fen: "k7/8/1K6/8/8/8/8/7R w - - 0 1", solutions: ["h1h8"] },
  { fen: "r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1", solutions: ["a8a1"] },
  { fen: "k7/2P5/1K6/8/8/8/8/8 w - - 0 1", solutions: ["c7c8r", "c7c8q"] },
  { fen: "k7/8/K7/8/8/8/8/1Q6 w - - 0 1", solutions: ["b1b7"] },
  { fen: "6k1/8/6K1/8/8/8/8/R7 w - - 0 1", solutions: ["a1a8"] },
  { fen: "6RK/6PP/8/4n3/8/8/8/6k1 b - - 0 1", solutions: ["e5f7", "e5g6"] },
  { fen: "8/8/8/8/8/6k1/4q3/7K b - - 0 1", solutions: ["e2g2", "e2h2", "e2f1", "e2e1", "e2d1"] },
];

/** Positions with a forced mate in 2 and no mate in 1. */
export const MATE_IN_2: readonly MatePuzzle[] = [
  { fen: "7k/8/8/8/8/8/R7/1R5K w - - 0 1", solutions: ["a2a7", "b1b7", "b1g1"] },
  { fen: "7k/8/8/6K1/8/8/8/Q7 w - - 0 1", solutions: ["g5g6", "g5h6"] },
  { fen: "k7/8/2K5/8/8/8/8/7R w - - 0 1", solutions: ["c6c7", "c6b6"] },
  { fen: "1r5k/r7/8/8/8/8/8/7K b - - 0 1", solutions: ["b8g8", "b8b2", "a7a2"] },
  { fen: "7r/8/8/8/8/2k5/8/K7 b - - 0 1", solutions: ["c3c2", "c3b3"] },
  { fen: "q7/8/8/8/6k1/8/8/7K b - - 0 1", solutions: ["g4h3", "g4g3"] },
  { fen: "k7/8/8/8/8/4K3/6R1/7R w - - 0 1", solutions: ["g2g7", "g2b2", "h1h7", "h1b1"] },
  { fen: "7r/6r1/4k3/8/8/8/8/K7 b - - 0 1", solutions: ["h8h2", "h8b8", "g7g2", "g7b7"] },
  { fen: "k7/8/8/1K6/8/8/8/7Q w - - 0 1", solutions: ["b5a6", "b5b6"] },
  { fen: "7q/8/8/8/1k6/8/8/K7 b - - 0 1", solutions: ["b4b3", "b4a3"] },
];
