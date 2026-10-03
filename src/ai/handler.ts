import type { EngineResponse, SearchRequest } from "./protocol";

/**
 * Pure request handler used by worker.ts: rebuilds the position from initialFen + moves,
 * searches with the level's options and builds the response. Never throws; failures become
 * an `error` response.
 */
export function handleSearch(request: SearchRequest): EngineResponse {
  throw new Error("not implemented");
}
