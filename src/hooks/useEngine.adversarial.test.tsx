import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineResponse, SearchRequest } from "@/ai/protocol";
import { useEngine } from "@/hooks/useEngine";

class FakeWorker {
  static instances: FakeWorker[] = [];
  terminated = false;
  posted: SearchRequest[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  listeners: Record<string, ((e: unknown) => void)[]> = {};
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(m: SearchRequest) {
    this.posted.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  addEventListener(t: string, fn: (e: unknown) => void) {
    (this.listeners[t] ??= []).push(fn);
  }
  removeEventListener(t: string, fn: (e: unknown) => void) {
    this.listeners[t] = (this.listeners[t] ?? []).filter((f) => f !== fn);
  }
  /** Simulates a worker -> UI message (no-op if terminated, like a real worker). */
  reply(data: EngineResponse) {
    if (this.terminated) return;
    this.deliver(data);
  }
  /** Delivers even after terminate(), to check the hook ignores late messages. */
  deliver(data: EngineResponse) {
    const ev = { data } as MessageEvent;
    this.onmessage?.(ev);
    for (const fn of this.listeners.message ?? []) fn(ev);
  }
}

const REQ = {
  initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  moves: [] as string[],
  level: 1 as const,
};
const best = (requestId: number, move: string | null): EngineResponse => ({
  type: "bestmove",
  requestId,
  move,
  depth: 2,
  score: 0,
  nodes: 1,
  timeMs: 1,
});
const live = () => FakeWorker.instances.filter((w) => !w.terminated);
const lastPosted = (w: FakeWorker) => w.posted[w.posted.length - 1]!;
const flush = () => act(async () => {});

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useEngine adversarial", () => {
  it("thinking is true during search and false after the answer; promise resolves with move", async () => {
    const { result } = renderHook(() => useEngine());
    expect(result.current.thinking).toBe(false);
    let p!: Promise<string | null>;
    act(() => {
      p = result.current.requestMove(REQ);
    });
    expect(result.current.thinking).toBe(true);
    const w = live()[0]!;
    expect(w.posted).toHaveLength(1);
    expect(lastPosted(w)).toMatchObject({ type: "search", level: 1, initialFen: REQ.initialFen });
    act(() => w.reply(best(lastPosted(w).requestId, "e2e4")));
    await expect(p).resolves.toBe("e2e4");
    await flush();
    expect(result.current.thinking).toBe(false);
  });

  it("move null resolves to null", async () => {
    const { result } = renderHook(() => useEngine());
    let p!: Promise<string | null>;
    act(() => {
      p = result.current.requestMove(REQ);
    });
    const w = live()[0]!;
    act(() => w.reply(best(lastPosted(w).requestId, null)));
    await expect(p).resolves.toBeNull();
  });

  it("forwards seed, level and moves", () => {
    const { result } = renderHook(() => useEngine());
    act(() => {
      void result.current.requestMove({ ...REQ, moves: ["e2e4"], seed: 99, level: 3 });
    });
    expect(lastPosted(live()[0]!)).toMatchObject({ moves: ["e2e4"], seed: 99, level: 3 });
  });

  it("two consecutive requests without cancel: only the last resolves", async () => {
    const { result } = renderHook(() => useEngine());
    let p1!: Promise<string | null>;
    let p2!: Promise<string | null>;
    act(() => {
      p1 = result.current.requestMove(REQ);
      p2 = result.current.requestMove({ ...REQ, moves: ["e2e4"] });
    });
    const s1 = vi.fn();
    void p1.then(s1, s1);
    const posted = FakeWorker.instances.flatMap((w) => w.posted);
    const id1 = posted[0]!.requestId;
    const id2 = posted[posted.length - 1]!.requestId;
    expect(id1).not.toBe(id2);
    for (const w of live()) act(() => w.reply(best(id1, "a2a3")));
    await flush();
    expect(s1).not.toHaveBeenCalled();
    expect(result.current.thinking).toBe(true);
    for (const w of live()) act(() => w.reply(best(id2, "d2d4")));
    await expect(p2).resolves.toBe("d2d4");
    await flush();
    expect(s1).not.toHaveBeenCalled();
    expect(result.current.thinking).toBe(false);
  });

  it("cancel terminates the worker, creates a new one, thinking false, old promise never resolves", async () => {
    const { result } = renderHook(() => useEngine());
    let p1!: Promise<string | null>;
    act(() => {
      p1 = result.current.requestMove(REQ);
    });
    const s1 = vi.fn();
    void p1.then(s1, s1);
    const w1 = live()[0]!;
    const id1 = lastPosted(w1).requestId;
    act(() => result.current.cancel());
    expect(w1.terminated).toBe(true);
    expect(live()).toHaveLength(1);
    expect(result.current.thinking).toBe(false);
    act(() => w1.deliver(best(id1, "e2e4")));
    await flush();
    expect(s1).not.toHaveBeenCalled();
    expect(result.current.thinking).toBe(false);
  });

  it("cancel followed by a new request: old never resolves, new resolves on the new worker", async () => {
    const { result } = renderHook(() => useEngine());
    let p1!: Promise<string | null>;
    let p2!: Promise<string | null>;
    act(() => {
      p1 = result.current.requestMove(REQ);
    });
    const s1 = vi.fn();
    void p1.then(s1, s1);
    const w1 = live()[0]!;
    const id1 = lastPosted(w1).requestId;
    act(() => result.current.cancel());
    act(() => {
      p2 = result.current.requestMove({ ...REQ, level: 2 });
    });
    expect(result.current.thinking).toBe(true);
    const w2 = live()[0]!;
    expect(w2).not.toBe(w1);
    const id2 = lastPosted(w2).requestId;
    expect(id2).not.toBe(id1);
    act(() => w2.reply(best(id1, "a2a3"))); // stale id arriving on the new worker
    await flush();
    expect(s1).not.toHaveBeenCalled();
    expect(result.current.thinking).toBe(true);
    act(() => w2.reply(best(id2, "g1f3")));
    await expect(p2).resolves.toBe("g1f3");
    expect(s1).not.toHaveBeenCalled();
  });

  it("cancel with nothing in flight is harmless; engine still usable", async () => {
    const { result } = renderHook(() => useEngine());
    act(() => result.current.cancel());
    act(() => result.current.cancel());
    expect(result.current.thinking).toBe(false);
    expect(live()).toHaveLength(1);
    let p!: Promise<string | null>;
    act(() => {
      p = result.current.requestMove(REQ);
    });
    const w = live()[0]!;
    act(() => w.reply(best(lastPosted(w).requestId, "c2c4")));
    await expect(p).resolves.toBe("c2c4");
  });

  it("error response: thinking returns to false and no move is produced", async () => {
    const { result } = renderHook(() => useEngine());
    let p!: Promise<string | null>;
    act(() => {
      p = result.current.requestMove(REQ);
    });
    const outcome = vi.fn();
    void p.then(
      (v) => outcome("resolved", v),
      () => outcome("rejected"),
    );
    const w = live()[0]!;
    act(() => w.reply({ type: "error", requestId: lastPosted(w).requestId, message: "boom" }));
    await flush();
    expect(result.current.thinking).toBe(false);
    for (const c of outcome.mock.calls) {
      if (c[0] === "resolved") expect(c[1]).toBeNull();
    }
  });

  it("stale error (old requestId) is ignored", async () => {
    const { result } = renderHook(() => useEngine());
    let p2!: Promise<string | null>;
    act(() => {
      void result.current.requestMove(REQ);
    });
    const id1 = lastPosted(live()[0]!).requestId;
    act(() => result.current.cancel());
    act(() => {
      p2 = result.current.requestMove(REQ);
    });
    const w = live()[0]!;
    act(() => w.reply({ type: "error", requestId: id1, message: "old" }));
    await flush();
    expect(result.current.thinking).toBe(true);
    act(() => w.reply(best(lastPosted(w).requestId, "b1c3")));
    await expect(p2).resolves.toBe("b1c3");
  });

  it("unmount with a search in flight terminates the worker and does not update state afterwards", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useEngine());
    let p!: Promise<string | null>;
    act(() => {
      p = result.current.requestMove(REQ);
    });
    const s = vi.fn();
    void p.then(s, s);
    const w = live()[0]!;
    const id = lastPosted(w).requestId;
    unmount();
    expect(live()).toHaveLength(0);
    expect(w.terminated).toBe(true);
    expect(() => w.deliver(best(id, "e2e4"))).not.toThrow();
    await flush();
    expect(s).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("unmount without any request terminates its worker", () => {
    const { unmount } = renderHook(() => useEngine());
    expect(live()).toHaveLength(1);
    unmount();
    expect(live()).toHaveLength(0);
  });
});
