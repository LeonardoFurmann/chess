import type { Level } from "@/ai/protocol";

export interface MoveRequest {
  initialFen: string;
  moves: readonly string[];
  level: Level;
  seed?: number;
}

export interface UseEngine {
  /** Resolves with the AI move in UCI (null if no legal move). Superseded requests never resolve. */
  requestMove(request: MoveRequest): Promise<string | null>;
  /** Discards the current request and stops the search immediately (recreates the worker). */
  cancel(): void;
  thinking: boolean;
}

/** Owns the AI Web Worker for the component's lifetime (docs/SPEC.md §5.4). */
export function useEngine(): UseEngine {
  throw new Error("not implemented");
}
