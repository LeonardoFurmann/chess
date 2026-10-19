import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlayPage from "@/app/play/page";
import type { MoveRequest } from "@/hooks/useEngine";
import { STORAGE_KEY, loadGame, saveGame, type SavedGame } from "@/lib/storage";

const push = vi.fn();
const replace = vi.fn();
const cancel = vi.fn();
let search = "";
let mockThinking = false;

interface Pending {
  request: MoveRequest;
  resolve: (move: string | null) => void;
}
const pending: Pending[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/play",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/hooks/useEngine", () => ({
  useEngine: () => ({
    requestMove: (request: MoveRequest) =>
      new Promise<string | null>((resolve) => {
        pending.push({ request, resolve });
      }),
    cancel,
    thinking: mockThinking,
  }),
}));

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function saved(partial: Partial<SavedGame>): SavedGame {
  return { v: 1, mode: "ai", color: "white", level: 2, initialFen: START, moves: [], ...partial };
}

async function click(from: string, to: string) {
  await userEvent.click(screen.getByLabelText(new RegExp(`^${from},`)));
  await userEvent.click(screen.getByLabelText(new RegExp(`^${to},`)));
}

const settle = () => new Promise((r) => setTimeout(r, 50));

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  cancel.mockClear();
  pending.length = 0;
  search = "";
  mockThinking = false;
});

describe("/play adversarial: AI flow", () => {
  it("sends the exact UCI history and initial fen after the human move, then applies the reply", async () => {
    search = "mode=ai&color=white&level=1";
    render(<PlayPage />);
    await screen.findByRole("status");
    expect(pending).toHaveLength(0);
    await click("e2", "e4");
    await waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0]!.request).toMatchObject({ initialFen: START, moves: ["e2e4"], level: 1 });
    await act(async () => pending[0]!.resolve("e7e5"));
    await waitFor(() => expect(loadGame()?.moves).toEqual(["e2e4", "e7e5"]));
    expect(screen.getByRole("status")).toHaveTextContent("Vez das brancas");
  });

  it("does not request a move when the game is already over", async () => {
    saveGame(saved({ moves: ["f2f3", "e7e5", "g2g4", "d8h4"] }));
    render(<PlayPage />);
    expect(await screen.findByRole("status")).toHaveTextContent("Xeque-mate — pretas vencem");
    await settle();
    expect(pending).toHaveLength(0);
  });

  it("ignores a stale reply after undo while the AI is thinking", async () => {
    search = "mode=ai&color=white";
    render(<PlayPage />);
    await screen.findByRole("status");
    await click("e2", "e4");
    await waitFor(() => expect(pending).toHaveLength(1));
    const undo = screen.getByRole("button", { name: "Desfazer" });
    expect(undo).toBeEnabled();
    await userEvent.click(undo);
    expect(cancel).toHaveBeenCalled();
    expect(loadGame()?.moves).toEqual([]);
    await act(async () => pending[0]!.resolve("e7e5"));
    await settle();
    expect(loadGame()?.moves).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("Vez das brancas");
  });

  it("blocks the board while the AI is thinking", async () => {
    saveGame(saved({ moves: ["e2e4"] }));
    mockThinking = true;
    render(<PlayPage />);
    await screen.findByTestId("thinking");
    await click("a7", "a6");
    await click("a2", "a3");
    expect(loadGame()?.moves).toEqual(["e2e4"]);
  });

  it("human as black: AI plays first automatically and undo is unavailable with only the AI move", async () => {
    search = "mode=ai&color=black&level=2";
    render(<PlayPage />);
    await waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0]!.request).toMatchObject({ initialFen: START, moves: [], level: 2 });
    await act(async () => pending[0]!.resolve("e2e4"));
    await waitFor(() => expect(loadGame()?.moves).toEqual(["e2e4"]));
    const undo = screen.getByRole("button", { name: "Desfazer" });
    expect(undo).toBeDisabled();
    await userEvent.click(undo);
    expect(loadGame()?.moves).toEqual(["e2e4"]);
  });

  it("human as black: undo removes the human move and the AI reply, keeping the AI opening", async () => {
    saveGame(saved({ color: "black", moves: ["e2e4", "e7e5", "g1f3"] }));
    render(<PlayPage />);
    await screen.findByRole("status");
    const undo = screen.getByRole("button", { name: "Desfazer" });
    expect(undo).toBeEnabled();
    await userEvent.click(undo);
    expect(loadGame()?.moves).toEqual(["e2e4"]);
    expect(screen.getByRole("status")).toHaveTextContent("Vez das pretas");
    await settle();
    expect(pending).toHaveLength(0);
  });

  it("human as white: undo after the AI replied removes both plies", async () => {
    saveGame(saved({ moves: ["e2e4", "e7e5"] }));
    render(<PlayPage />);
    await screen.findByRole("status");
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(loadGame()?.moves).toEqual([]);
  });

  it("local mode: undo removes exactly one ply and is disabled with no moves", async () => {
    saveGame(saved({ mode: "local", moves: ["e2e4", "e7e5"] }));
    render(<PlayPage />);
    await screen.findByRole("status");
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(loadGame()?.moves).toEqual(["e2e4"]);
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(loadGame()?.moves).toEqual([]);
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeDisabled();
  });

  it("reload during the AI search resumes the search with the same history", async () => {
    saveGame(saved({ moves: ["e2e4"] }));
    const first = render(<PlayPage />);
    await waitFor(() => expect(pending).toHaveLength(1));
    first.unmount();
    render(<PlayPage />);
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[1]!.request).toMatchObject({ initialFen: START, moves: ["e2e4"], level: 2 });
  });

  it("a reply that arrives after the page was unmounted does not alter the saved game", async () => {
    saveGame(saved({ moves: ["e2e4"] }));
    const first = render(<PlayPage />);
    await waitFor(() => expect(pending).toHaveLength(1));
    first.unmount();
    await act(async () => pending[0]!.resolve("e7e5"));
    await settle();
    expect(loadGame()?.moves).toEqual(["e2e4"]);
  });

  it("switching tabs (visibilitychange) does not duplicate the request or lose the game", async () => {
    saveGame(saved({ moves: ["e2e4"] }));
    render(<PlayPage />);
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });
    await settle();
    expect(pending).toHaveLength(1);
    expect(loadGame()?.moves).toEqual(["e2e4"]);
  });
});

describe("/play adversarial: promotion", () => {
  const PROMO = "8/P6k/8/8/8/8/8/K7 w - - 0 1";

  it("pending promotion does not change the game; cancel plays nothing; knight records =N", async () => {
    search = "mode=local&fen=" + encodeURIComponent(PROMO);
    render(<PlayPage />);
    await screen.findByRole("status");
    await click("a7", "a8");
    expect(screen.getByRole("button", { name: "Cavalo" })).toBeInTheDocument();
    expect(loadGame()?.moves).toEqual([]);
    await userEvent.keyboard("{Escape}");
    expect(loadGame()?.moves).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("Vez das brancas");
    await click("a7", "a8");
    await userEvent.click(screen.getByRole("button", { name: "Cavalo" }));
    expect(loadGame()?.moves).toEqual(["a7a8n"]);
    expect(screen.getByRole("region", { name: "Lista de lances" })).toHaveTextContent("=N");
    expect(screen.getByLabelText(/^a8, cavalo branco/)).toBeInTheDocument();
  });

  it("cancelled promotion in AI mode does not trigger a search", async () => {
    search = "mode=ai&color=white&fen=" + encodeURIComponent(PROMO);
    render(<PlayPage />);
    await screen.findByRole("status");
    await click("a7", "a8");
    await userEvent.keyboard("{Escape}");
    await settle();
    expect(pending).toHaveLength(0);
  });
});

describe("/play adversarial: initialization and persistence", () => {
  it("redirects to / when there is no param and no saved game", async () => {
    render(<PlayPage />);
    await waitFor(() => expect(replace.mock.calls.length + push.mock.calls.length).toBeGreaterThan(0));
    const call = [...replace.mock.calls, ...push.mock.calls][0]!;
    expect(call[0]).toBe("/");
  });

  it.each([
    ["not json", "{{{"],
    ["wrong version", JSON.stringify({ v: 2, mode: "local", color: "white", level: 2, initialFen: START, moves: [] })],
    ["wrong shape", JSON.stringify({ hello: 1 })],
    ["null", "null"],
    ["illegal move", JSON.stringify(saved({ moves: ["e2e5"] }))],
    ["garbage fen", JSON.stringify(saved({ initialFen: "xyz" }))],
    ["move after mate", JSON.stringify(saved({ moves: ["f2f3", "e7e5", "g2g4", "d8h4", "a2a3"] }))],
  ])("treats a saved game that is %s as absent and redirects to /", async (_name, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    render(<PlayPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByLabelText(/^e2,/)).toBeNull();
  });

  it("an invalid fen shows an alert with a link to / and no board", async () => {
    search = "mode=local&fen=" + encodeURIComponent("8/8/8 w - - 0 1");
    render(<PlayPage />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/")).toBe(true);
    expect(screen.queryByLabelText(/^e2,/)).toBeNull();
  });

  it("params replace the saved game", async () => {
    saveGame(saved({ mode: "local", moves: ["e2e4", "e7e5"] }));
    search = "mode=ai&color=black&level=3";
    render(<PlayPage />);
    await screen.findByRole("status");
    await waitFor(() => expect(loadGame()).toMatchObject({ mode: "ai", color: "black", level: 3, moves: [] }));
  });

  it("params with fen start from that position", async () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    search = "mode=local&fen=" + encodeURIComponent(fen);
    render(<PlayPage />);
    expect(await screen.findByRole("status")).toHaveTextContent("Vez das pretas");
    expect(loadGame()?.initialFen).toBe(fen);
  });

  it("saves after every move and survives a reload with identical history", async () => {
    search = "mode=local";
    const first = render(<PlayPage />);
    await screen.findByRole("status");
    await click("e2", "e4");
    await click("e7", "e5");
    await click("g1", "f3");
    expect(loadGame()?.moves).toEqual(["e2e4", "e7e5", "g1f3"]);
    first.unmount();
    search = "";
    render(<PlayPage />);
    const list = await screen.findByRole("region", { name: "Lista de lances" });
    expect(list).toHaveTextContent("Nf3");
    expect(loadGame()?.moves).toEqual(["e2e4", "e7e5", "g1f3"]);
  });

  it("an illegal move leaves position and saved game unchanged", async () => {
    search = "mode=local";
    render(<PlayPage />);
    await screen.findByRole("status");
    await click("e2", "e5");
    expect(loadGame()?.moves).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("Vez das brancas");
  });
});

describe("/play adversarial: end of game and chrome", () => {
  it("shows the result in Portuguese and blocks the board after scholar's mate", async () => {
    search = "mode=local";
    render(<PlayPage />);
    await screen.findByRole("status");
    const moves: [string, string][] = [
      ["e2", "e4"],
      ["e7", "e5"],
      ["d1", "h5"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["g8", "f6"],
      ["h5", "f7"],
    ];
    for (const [a, b] of moves) await click(a, b);
    expect(screen.getByRole("status")).toHaveTextContent("Xeque-mate — brancas vencem");
    await click("a7", "a6");
    expect(loadGame()?.moves).toHaveLength(7);
  });

  it("stalemate position shows the Portuguese stalemate text", async () => {
    search = "mode=local&fen=" + encodeURIComponent("7k/5Q2/8/8/8/8/8/K7 b - - 0 1");
    render(<PlayPage />);
    expect(await screen.findByRole("status")).toHaveTextContent("Empate por afogamento");
  });

  it("flip toggles the orientation; AI as black starts flipped", async () => {
    search = "mode=local";
    const view = render(<PlayPage />);
    await screen.findByRole("status");
    const orientation = () => view.container.querySelector("[data-orientation]")!.getAttribute("data-orientation");
    expect(orientation()).toBe("white");
    await userEvent.click(screen.getByRole("button", { name: "Virar tabuleiro" }));
    expect(orientation()).toBe("black");
    cleanup();
    search = "mode=ai&color=black";
    const v2 = render(<PlayPage />);
    await screen.findByRole("status");
    expect(v2.container.querySelector("[data-orientation]")!.getAttribute("data-orientation")).toBe("black");
  });

  it("Nova partida clears the saved game and navigates to /", async () => {
    saveGame(saved({ mode: "local", moves: ["e2e4"] }));
    render(<PlayPage />);
    await screen.findByRole("status");
    await userEvent.click(screen.getByRole("button", { name: "Nova partida" }));
    expect(push).toHaveBeenCalledWith("/");
    expect(loadGame()).toBeNull();
  });
});
