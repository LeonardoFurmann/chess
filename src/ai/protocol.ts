/**
 * Messages between the UI and the AI Web Worker (docs/SPEC.md §5.4). This file is a contract.
 *
 * The search runs synchronously inside the worker, so the worker cannot read new messages
 * while searching. Cancelling is done on the UI side: ignore stale `requestId`s and, to stop
 * immediately, terminate the worker and create a new one.
 */

/** 1 = easy, 2 = medium, 3 = hard. */
export type Level = 1 | 2 | 3;

export interface SearchRequest {
  readonly type: "search";
  readonly requestId: number;
  /** FEN the game started from. */
  readonly initialFen: string;
  /** Moves played since initialFen, in UCI. Needed for repetition detection. */
  readonly moves: readonly string[];
  readonly level: Level;
  /** Seed for the easy level's randomness; same seed, same move. */
  readonly seed?: number;
}

export interface BestMoveResponse {
  readonly type: "bestmove";
  readonly requestId: number;
  /** UCI move, or null if the side to move has no legal moves. */
  readonly move: string | null;
  readonly depth: number;
  readonly score: number;
  readonly nodes: number;
  readonly timeMs: number;
}

export interface ErrorResponse {
  readonly type: "error";
  readonly requestId: number;
  readonly message: string;
}

export type EngineRequest = SearchRequest;
export type EngineResponse = BestMoveResponse | ErrorResponse;
