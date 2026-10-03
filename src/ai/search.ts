import type { Move, Position, Rng } from "@/engine/core";

/** Score of a mate found at ply 0; a mate at ply n scores MATE_SCORE - n. */
export const MATE_SCORE = 100_000;

export interface SearchOptions {
  /** Maximum iterative-deepening depth. */
  maxDepth?: number;
  /** Time budget; the result of the last completed depth is used when it runs out. */
  timeLimitMs?: number;
  /** At the root, pick randomly among moves scoring >= best - margin (easy level). */
  randomMarginCp?: number;
  /** Required when randomMarginCp is set. */
  rng?: Rng;
  /** Polled periodically; returning true stops the search like a timeout. */
  shouldStop?: () => boolean;
}

export interface SearchResult {
  /** Best move, or null when the side to move has no legal moves. */
  move: Move | null;
  score: number;
  /** Deepest completed iteration. */
  depth: number;
  nodes: number;
  timeMs: number;
}

/**
 * Negamax + alpha-beta with iterative deepening (docs/SPEC.md §5.1). Depth 1 is always
 * completed. The position is left exactly as received.
 */
export function search(position: Position, options: SearchOptions): SearchResult {
  throw new Error("not implemented");
}
