import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineRequest, EngineResponse } from "@/ai/protocol";
import { useEngine } from "./useEngine";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<EngineResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: EngineRequest[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: EngineRequest): void {
    this.posted.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(response: EngineResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<EngineResponse>);
  }
}

const REQUEST = { initialFen: "fen", moves: ["e2e4"], level: 2 as const };

function best(requestId: number, move: string | null): EngineResponse {
  return { type: "bestmove", requestId, move, depth: 1, score: 0, nodes: 1, timeMs: 1 };
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const live = () => FakeWorker.instances.filter((w) => !w.terminated);

describe("useEngine", () => {
  it("creates a worker on mount and terminates it on unmount", () => {
    const { unmount } = renderHook(() => useEngine());
    expect(live()).toHaveLength(1);
    unmount();
    expect(live()).toHaveLength(0);
  });

  it("is thinking during the search and resolves with the move", async () => {
    const { result } = renderHook(() => useEngine());
    expect(result.current.thinking).toBe(false);
    let promise!: Promise<string | null>;
    act(() => {
      promise = result.current.requestMove(REQUEST);
    });
    expect(result.current.thinking).toBe(true);
    const worker = live()[0];
    expect(worker.posted[0]).toMatchObject({ type: "search", initialFen: "fen", moves: ["e2e4"], level: 2 });
    act(() => worker.reply(best(worker.posted[0].requestId, "e7e5")));
    await expect(promise).resolves.toBe("e7e5");
    expect(result.current.thinking).toBe(false);
  });

  it("rejects on an error response", async () => {
    const { result } = renderHook(() => useEngine());
    let promise!: Promise<string | null>;
    act(() => {
      promise = result.current.requestMove(REQUEST);
    });
    const worker = live()[0];
    const assertion = expect(promise).rejects.toThrow("boom");
    act(() => worker.reply({ type: "error", requestId: worker.posted[0].requestId, message: "boom" }));
    await assertion;
    expect(result.current.thinking).toBe(false);
  });

  it("cancel() recreates the worker and ignores the stale response", async () => {
    const { result } = renderHook(() => useEngine());
    const settled = vi.fn();
    act(() => {
      void result.current.requestMove(REQUEST).then(settled);
    });
    const first = live()[0];
    const staleId = first.posted[0].requestId;
    act(() => result.current.cancel());
    expect(first.terminated).toBe(true);
    expect(live()).toHaveLength(1);
    expect(result.current.thinking).toBe(false);
    act(() => first.reply(best(staleId, "e7e5")));
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(result.current.thinking).toBe(false);
  });

  it("cancel() followed by a new request resolves only the new one", async () => {
    const { result } = renderHook(() => useEngine());
    const oldSettled = vi.fn();
    act(() => {
      void result.current.requestMove(REQUEST).then(oldSettled);
    });
    const first = live()[0];
    act(() => result.current.cancel());
    let promise!: Promise<string | null>;
    act(() => {
      promise = result.current.requestMove(REQUEST);
    });
    const second = live()[0];
    expect(second).not.toBe(first);
    act(() => first.reply(best(first.posted[0].requestId, "stale")));
    expect(result.current.thinking).toBe(true);
    act(() => second.reply(best(second.posted[0].requestId, "g1f3")));
    await expect(promise).resolves.toBe("g1f3");
    expect(oldSettled).not.toHaveBeenCalled();
  });

  it("only the last of two consecutive requests resolves", async () => {
    const { result } = renderHook(() => useEngine());
    const firstSettled = vi.fn();
    let second!: Promise<string | null>;
    act(() => {
      void result.current.requestMove(REQUEST).then(firstSettled);
      second = result.current.requestMove(REQUEST);
    });
    const worker = live()[0];
    const [r1, r2] = worker.posted.map((p) => p.requestId);
    expect(r2).not.toBe(r1);
    act(() => worker.reply(best(r1, "old")));
    expect(result.current.thinking).toBe(true);
    act(() => worker.reply(best(r2, "new")));
    await expect(second).resolves.toBe("new");
    expect(firstSettled).not.toHaveBeenCalled();
  });

  it("unmounting during a search terminates the worker without updating state", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useEngine());
    const settled = vi.fn();
    act(() => {
      void result.current.requestMove(REQUEST).then(settled);
    });
    const worker = live()[0];
    unmount();
    expect(worker.terminated).toBe(true);
    worker.reply(best(worker.posted[0].requestId, "e7e5"));
    expect(settled).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("a worker crash rejects the pending request and the next request recreates the worker", async () => {
    const { result } = renderHook(() => useEngine());
    let promise!: Promise<string | null>;
    act(() => {
      promise = result.current.requestMove(REQUEST);
    });
    const worker = live()[0];
    const assertion = expect(promise).rejects.toThrow("crash");
    act(() => worker.onerror?.({ message: "crash" } as ErrorEvent));
    await assertion;
    expect(result.current.thinking).toBe(false);
    act(() => {
      void result.current.requestMove(REQUEST);
    });
    expect(live()).toHaveLength(1);
    expect(live()[0]).not.toBe(worker);
  });
});
