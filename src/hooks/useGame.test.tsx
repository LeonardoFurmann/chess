import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGame, getFen, play } from "@/engine";
import type { MoveRequest } from "@/hooks/useEngine";
import { restoreGame, useGame } from "@/hooks/useGame";
import { loadGame } from "@/lib/storage";

interface Deferred {
  request: MoveRequest;
  resolve(move: string | null): void;
  reject(error: Error): void;
}

const requests: Deferred[] = [];
const cancel = vi.fn();
let thinking = false;

vi.mock("@/hooks/useEngine", () => ({
  useEngine: () => ({
    requestMove: (request: MoveRequest) =>
      new Promise<string | null>((resolve, reject) => {
        requests.push({ request, resolve, reject });
      }),
    cancel,
    thinking,
  }),
}));

beforeEach(() => {
  requests.length = 0;
  cancel.mockClear();
  thinking = false;
});

const local = { game: createGame(), mode: "local", color: "white", level: 2 } as const;
const ai = (color: "white" | "black") => ({ game: createGame(), mode: "ai", color, level: 2 }) as const;

describe("restoreGame", () => {
  it("replays UCI moves, including promotions", () => {
    const g = restoreGame({
      v: 1,
      mode: "local",
      color: "white",
      level: 2,
      initialFen: "8/P6k/8/8/8/8/8/K7 w - - 0 1",
      moves: ["a7a8q"],
    });
    expect(g?.uciMoves).toEqual(["a7a8q"]);
  });

  it("returns null when a saved move is illegal", () => {
    const saved = { v: 1, mode: "local", color: "white", level: 2, initialFen: createGame().initialFen, moves: ["e2e5"] } as const;
    expect(restoreGame({ ...saved, moves: ["e2e5"] })).toBeNull();
  });
});

describe("useGame (local)", () => {
  it("plays a valid move and saves it", () => {
    const { result } = renderHook(() => useGame(local));
    act(() => result.current.move("e2", "e4"));
    expect(result.current.game.uciMoves).toEqual(["e2e4"]);
    expect(result.current.turn).toBe("b");
    expect(loadGame()?.moves).toEqual(["e2e4"]);
  });

  it("ignores illegal moves", () => {
    const { result } = renderHook(() => useGame(local));
    act(() => result.current.move("e2", "e5"));
    expect(result.current.game.uciMoves).toEqual([]);
  });

  it("keeps board and legalMoves identities stable across unrelated re-renders", () => {
    const { result } = renderHook(() => useGame(local));
    const { board, legalMoves } = result.current;
    act(() => result.current.flip());
    expect(result.current.board).toBe(board);
    expect(result.current.legalMoves).toBe(legalMoves);
  });

  it("holds a pending promotion without changing the game until chosen", () => {
    const game = createGame("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    const { result } = renderHook(() => useGame({ ...local, game }));
    act(() => result.current.move("a7", "a8"));
    expect(result.current.pendingPromotion).toEqual({ from: "a7", to: "a8" });
    expect(result.current.game).toBe(game);
    act(() => result.current.choosePromotion("n"));
    expect(result.current.pendingPromotion).toBeNull();
    expect(result.current.game.uciMoves).toEqual(["a7a8n"]);
  });

  it("cancelling a promotion plays nothing", () => {
    const game = createGame("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    const { result } = renderHook(() => useGame({ ...local, game }));
    act(() => result.current.move("a7", "a8"));
    act(() => result.current.cancelPromotion());
    expect(result.current.pendingPromotion).toBeNull();
    expect(result.current.game).toBe(game);
  });

  it("undo removes one move and canUndo is false without moves", () => {
    const { result } = renderHook(() => useGame(local));
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.move("e2", "e4"));
    act(() => result.current.move("e7", "e5"));
    act(() => result.current.undo());
    expect(result.current.game.uciMoves).toEqual(["e2e4"]);
    expect(loadGame()?.moves).toEqual(["e2e4"]);
  });

  it("flip toggles orientation; newGame clears the saved game and stops saving", () => {
    const { result, rerender } = renderHook(() => useGame(local));
    expect(result.current.orientation).toBe("white");
    act(() => result.current.flip());
    expect(result.current.orientation).toBe("black");
    expect(loadGame()).not.toBeNull();
    act(() => result.current.newGame());
    rerender();
    expect(loadGame()).toBeNull();
  });

  it("locks the board after the game is over", () => {
    let game = createGame();
    for (const [from, to] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]] as const) {
      game = play(game, { from, to });
    }
    const { result } = renderHook(() => useGame({ ...local, game }));
    expect(result.current.status.kind).toBe("checkmate");
    expect(result.current.interactive).toBe(false);
  });
});

describe("useGame (AI)", () => {
  it("requests a move with the right history after the human moves and applies it", async () => {
    const { result } = renderHook(() => useGame(ai("white")));
    expect(requests).toHaveLength(0);
    act(() => result.current.move("e2", "e4"));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].request).toMatchObject({ initialFen: createGame().initialFen, moves: ["e2e4"], level: 2 });
    expect(result.current.interactive).toBe(false);
    await act(async () => requests[0].resolve("e7e5"));
    expect(result.current.game.uciMoves).toEqual(["e2e4", "e7e5"]);
    expect(result.current.interactive).toBe(true);
  });

  it("plays first when the human has black", async () => {
    const { result } = renderHook(() => useGame(ai("black")));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].request.moves).toEqual([]);
    expect(result.current.orientation).toBe("black");
    await act(async () => requests[0].resolve("e2e4"));
    expect(result.current.game.uciMoves).toEqual(["e2e4"]);
  });

  it("resumes the AI when restored on its turn", async () => {
    const game = play(createGame(), { from: "e2", to: "e4" });
    renderHook(() => useGame({ ...ai("white"), game }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].request.moves).toEqual(["e2e4"]);
  });

  it("undo while thinking cancels the search and ignores its late answer", async () => {
    const { result } = renderHook(() => useGame(ai("white")));
    act(() => result.current.move("e2", "e4"));
    await waitFor(() => expect(requests).toHaveLength(1));
    act(() => result.current.undo());
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(result.current.game.uciMoves).toEqual([]);
    await act(async () => requests[0].resolve("e7e5"));
    expect(result.current.game.uciMoves).toEqual([]);
  });

  it("undo goes back to the human's last move (normally 2 plies)", async () => {
    const { result } = renderHook(() => useGame(ai("white")));
    act(() => result.current.move("e2", "e4"));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => requests[0].resolve("e7e5"));
    act(() => result.current.move("d2", "d4"));
    await waitFor(() => expect(requests).toHaveLength(2));
    await act(async () => requests[1].resolve("d7d5"));
    act(() => result.current.undo());
    expect(result.current.game.uciMoves).toEqual(["e2e4", "e7e5"]);
    expect(requests).toHaveLength(2);
  });

  it("canUndo is false while only the AI has moved (human has black)", async () => {
    const { result } = renderHook(() => useGame(ai("black")));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => requests[0].resolve("e2e4"));
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.move("e7", "e5"));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(result.current.canUndo).toBe(true);
  });

  it("undoing to the start with black makes the AI play again", async () => {
    const { result } = renderHook(() => useGame(ai("black")));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => requests[0].resolve("e2e4"));
    act(() => result.current.move("e7", "e5"));
    await waitFor(() => expect(requests).toHaveLength(2));
    await act(async () => requests[1].resolve("g1f3"));
    act(() => result.current.undo());
    expect(result.current.game.uciMoves).toEqual(["e2e4"]);
    act(() => result.current.move("c7", "c5"));
    await waitFor(() => expect(requests).toHaveLength(3));
    act(() => result.current.undo());
    expect(result.current.game.uciMoves).toEqual(["e2e4"]);
  });

  it("reports an engine rejection without breaking and can retry", async () => {
    const { result } = renderHook(() => useGame(ai("white")));
    act(() => result.current.move("e2", "e4"));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => requests[0].reject(new Error("boom")));
    expect(result.current.engineError).toBe("boom");
    expect(result.current.game.uciMoves).toEqual(["e2e4"]);
    act(() => result.current.retryEngine());
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(result.current.engineError).toBeNull();
    await act(async () => requests[1].resolve("e7e5"));
    expect(getFen(result.current.game)).toContain("4p3");
  });
});
