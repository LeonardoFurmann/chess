import { generateLegalMoves } from "./legal";
import { makeMove, unmakeMove } from "./make-move";
import type { Position } from "./position";
import type { Move } from "./types";

/** Number of leaf nodes of the legal move tree at the given depth. */
export function perft(position: Position, depth: number): number {
  if (depth <= 0) return 1;
  const moves = generateLegalMoves(position);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    makeMove(position, move);
    nodes += perft(position, depth - 1);
    unmakeMove(position);
  }
  return nodes;
}

/** Perft split by root move, for debugging divergences. */
export function perftDivide(position: Position, depth: number): { move: Move; nodes: number }[] {
  return generateLegalMoves(position).map((move) => {
    makeMove(position, move);
    const nodes = depth <= 1 ? 1 : perft(position, depth - 1);
    unmakeMove(position);
    return { move, nodes };
  });
}
