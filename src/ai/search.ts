import {
  generateLegalMoves,
  inCheck,
  isFiftyMoveDraw,
  isInsufficientMaterial,
  makeMove,
  unmakeMove,
} from "@/engine/core";
import type { Move, Position, Rng } from "@/engine/core";
import { evaluate } from "./evaluate";

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

/** Hard cap on iterative deepening when only a time limit is given. */
const DEFAULT_TIMED_MAX_DEPTH = 64;
/** Depth used when neither maxDepth nor timeLimitMs is given. */
const DEFAULT_MAX_DEPTH = 4;
/** The stop conditions are polled every POLL_MASK + 1 nodes. */
const POLL_MASK = 127;
const INFINITY = MATE_SCORE + 1000;

class SearchAborted extends Error {}

interface RootEntry {
  move: Move;
  score: number;
}

/**
 * Negamax + alpha-beta with iterative deepening (docs/SPEC.md §5.1). Depth 1 is always
 * completed. The position is left exactly as received.
 */
export function search(position: Position, options: SearchOptions): SearchResult {
  const start = performance.now();
  const { timeLimitMs, shouldStop, randomMarginCp = 0, rng } = options;
  const maxDepth = Math.max(
    1,
    options.maxDepth ?? (timeLimitMs !== undefined ? DEFAULT_TIMED_MAX_DEPTH : DEFAULT_MAX_DEPTH),
  );
  const deadline = timeLimitMs !== undefined ? start + timeLimitMs : Infinity;

  let nodes = 0;
  let stopEnabled = false;

  const checkStop = (): void => {
    if (performance.now() >= deadline || (shouldStop !== undefined && shouldStop())) {
      throw new SearchAborted();
    }
  };

  /** Draw by repetition: a repeat of a position on the current search path, or a third occurrence. */
  const isRepetition = (ply: number): boolean => {
    const history = position.history;
    const limit = Math.min(position.halfmoveClock, history.length);
    let count = 1;
    // history[length - k] holds the hash from k plies ago; only even k share the side to move.
    for (let k = 2; k <= limit; k += 2) {
      const entry = history[history.length - k];
      if (entry.hashHi === position.hashHi && entry.hashLo === position.hashLo) {
        if (k <= ply) return true;
        count++;
        if (count >= 3) return true;
      }
    }
    return false;
  };

  const negamax = (depth: number, ply: number, alpha: number, beta: number): number => {
    nodes++;
    if (stopEnabled && (nodes & POLL_MASK) === 0) checkStop();

    if (isRepetition(ply) || isInsufficientMaterial(position)) return 0;
    if (depth <= 0) return isFiftyMoveDraw(position) ? 0 : evaluate(position);

    const moves = generateLegalMoves(position);
    // Mate takes precedence over the fifty-move rule, so it is decided before the clock.
    if (moves.length === 0) return inCheck(position) ? -(MATE_SCORE - ply) : 0;
    if (isFiftyMoveDraw(position)) return 0;

    let best = -INFINITY;
    for (const move of moves) {
      makeMove(position, move);
      let score: number;
      try {
        score = 0 - negamax(depth - 1, ply + 1, -beta, -alpha);
      } finally {
        unmakeMove(position);
      }
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  };

  const rootMoves = generateLegalMoves(position);
  if (rootMoves.length === 0) {
    return {
      move: null,
      score: inCheck(position) ? -MATE_SCORE : 0,
      depth: 0,
      nodes: 1,
      timeMs: performance.now() - start,
    };
  }

  const margin = rng !== undefined ? Math.max(0, randomMarginCp) : 0;
  let order: Move[] = rootMoves;
  let completed: RootEntry[] = [{ move: rootMoves[0], score: 0 }];
  let completedDepth = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (depth > 1) {
      // Depth 1 always completes, so stop conditions only apply from depth 2 on.
      stopEnabled = true;
      try {
        checkStop();
      } catch {
        break;
      }
    }
    try {
      const entries: RootEntry[] = [];
      let best = -INFINITY;
      for (const move of order) {
        // With a margin the window is widened so every move within it gets an exact score.
        const alpha =
          margin > 0 ? Math.max(-INFINITY, best - margin - 1) : Math.max(-INFINITY, best);
        makeMove(position, move);
        let score: number;
        try {
          score = 0 - negamax(depth - 1, 1, -INFINITY, -alpha);
        } finally {
          unmakeMove(position);
        }
        entries.push({ move, score });
        if (score > best) best = score;
      }
      completed = entries;
      completedDepth = depth;
      // Search the best move first on the next iteration (cheap root ordering).
      let bestIndex = 0;
      for (let i = 1; i < entries.length; i++) {
        if (entries[i].score > entries[bestIndex].score) bestIndex = i;
      }
      order = [
        entries[bestIndex].move,
        ...entries.filter((_, i) => i !== bestIndex).map((e) => e.move),
      ];
      // A proven mate (or being mated) cannot change with more depth.
      if (Math.abs(entries[bestIndex].score) >= MATE_SCORE - depth) break;
    } catch (error) {
      if (error instanceof SearchAborted) break;
      throw error;
    }
  }

  let bestEntry = completed[0];
  for (const entry of completed) {
    if (entry.score > bestEntry.score) bestEntry = entry;
  }
  let chosen = bestEntry;
  if (margin > 0 && rng !== undefined) {
    const candidates = completed.filter((e) => e.score >= bestEntry.score - margin);
    chosen = candidates[rng.nextInt(candidates.length)];
  }

  return {
    move: chosen.move,
    score: chosen.score,
    depth: completedDepth,
    nodes,
    timeMs: performance.now() - start,
  };
}
