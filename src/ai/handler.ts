import { makeMove, moveToUci, parseFen, uciToMove } from "@/engine/core";
import { levelOptions } from "./levels";
import type { EngineResponse, SearchRequest } from "./protocol";
import { search } from "./search";

/**
 * Pure request handler used by worker.ts: rebuilds the position from initialFen + moves,
 * searches with the level's options and builds the response. Never throws; failures become
 * an `error` response.
 */
export function handleSearch(request: SearchRequest): EngineResponse {
  const { requestId } = request;
  try {
    const position = parseFen(request.initialFen);
    for (const uci of request.moves) {
      const move = uciToMove(position, uci);
      if (move === null) throw new Error(`Illegal move in history: ${uci}`);
      makeMove(position, move);
    }
    const result = search(position, levelOptions(request.level, request.seed));
    return {
      type: "bestmove",
      requestId,
      move: result.move === null ? null : moveToUci(result.move),
      depth: result.depth,
      score: result.score,
      nodes: result.nodes,
      timeMs: result.timeMs,
    };
  } catch (error) {
    return {
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
