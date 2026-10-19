import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineRequest, EngineResponse, Level } from "@/ai/protocol";

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

interface Pending {
  readonly requestId: number;
  readonly resolve: (move: string | null) => void;
  readonly reject: (error: Error) => void;
}

/** Owns the AI Web Worker for the component's lifetime (docs/SPEC.md §5.4). */
export function useEngine(): UseEngine {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const nextIdRef = useRef(0);
  const mountedRef = useRef(false);
  const [thinking, setThinking] = useState(false);

  const createWorker = useCallback((): Worker => {
    const worker = new Worker(new URL("../ai/worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      // Ignore replies from a worker that was already replaced.
      if (workerRef.current !== worker) return;
      const response = event.data;
      const pending = pendingRef.current;
      if (pending === null || pending.requestId !== response.requestId) return;
      pendingRef.current = null;
      if (mountedRef.current) setThinking(false);
      if (response.type === "bestmove") pending.resolve(response.move);
      else pending.reject(new Error(response.message));
    };
    worker.onerror = (event: ErrorEvent) => {
      if (workerRef.current !== worker) return;
      const pending = pendingRef.current;
      pendingRef.current = null;
      worker.terminate();
      workerRef.current = null;
      if (mountedRef.current) setThinking(false);
      pending?.reject(new Error(event.message || "Engine worker failed"));
    };
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (workerRef.current === null) createWorker();
    return () => {
      mountedRef.current = false;
      pendingRef.current = null;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [createWorker]);

  const requestMove = useCallback(
    (request: MoveRequest): Promise<string | null> => {
      const worker = workerRef.current ?? createWorker();
      const requestId = ++nextIdRef.current;
      return new Promise<string | null>((resolve, reject) => {
        // A newer request supersedes the previous one, which never settles.
        pendingRef.current = { requestId, resolve, reject };
        setThinking(true);
        const message: EngineRequest = {
          type: "search",
          requestId,
          initialFen: request.initialFen,
          moves: request.moves,
          level: request.level,
          seed: request.seed,
        };
        worker.postMessage(message);
      });
    },
    [createWorker],
  );

  const cancel = useCallback((): void => {
    pendingRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    createWorker();
    setThinking(false);
  }, [createWorker]);

  return { requestMove, cancel, thinking };
}
