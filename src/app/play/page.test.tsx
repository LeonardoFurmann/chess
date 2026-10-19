import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlayPage from "@/app/play/page";
import type { MoveRequest } from "@/hooks/useEngine";
import { loadGame, saveGame } from "@/lib/storage";

const push = vi.fn();
const replace = vi.fn();
let search = "";
let mockThinking = false;
const requests: MoveRequest[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/hooks/useEngine", () => ({
  useEngine: () => ({
    requestMove: (request: MoveRequest) => {
      requests.push(request);
      return new Promise<string | null>(() => {});
    },
    cancel: vi.fn(),
    thinking: mockThinking,
  }),
}));

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  requests.length = 0;
  search = "";
  mockThinking = false;
});

describe("/play page", () => {
  it("redirects to / without params and without a saved game", async () => {
    render(<PlayPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("shows a friendly error and a link home for an invalid fen", async () => {
    search = "mode=local&fen=garbage";
    render(<PlayPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/FEN/);
    expect(screen.getByRole("link", { name: /início/i })).toHaveAttribute("href", "/");
    expect(loadGame()).toBeNull();
  });

  it("starts a new game from params, saves it and drops the params from the URL", async () => {
    search = "mode=local";
    render(<PlayPage />);
    expect(await screen.findByRole("status")).toHaveTextContent("Vez das brancas");
    expect(replace).toHaveBeenCalledWith("/play");
    expect(loadGame()).toMatchObject({ mode: "local", initialFen: START, moves: [] });
  });

  it("plays by click-click and updates the move list and the saved game", async () => {
    search = "mode=local";
    render(<PlayPage />);
    await screen.findByRole("status");
    await userEvent.click(screen.getByLabelText(/^e2,/));
    await userEvent.click(screen.getByLabelText(/^e4/));
    expect(screen.getByRole("region", { name: "Lista de lances" })).toHaveTextContent("e4");
    expect(screen.getByRole("status")).toHaveTextContent("Vez das pretas");
    expect(loadGame()?.moves).toEqual(["e2e4"]);
  });

  it("restores a saved game on reload with the same history", async () => {
    saveGame({ v: 1, mode: "local", color: "white", level: 2, initialFen: START, moves: ["e2e4", "e7e5"] });
    render(<PlayPage />);
    const list = await screen.findByRole("region", { name: "Lista de lances" });
    expect(list).toHaveTextContent("e4");
    expect(list).toHaveTextContent("e5");
    expect(replace).not.toHaveBeenCalled();
  });

  it("discards a saved game whose moves do not reproduce", async () => {
    saveGame({ v: 1, mode: "local", color: "white", level: 2, initialFen: START, moves: ["e2e5"] });
    render(<PlayPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(loadGame()).toBeNull();
  });

  it("numbers moves from a FEN where Black moves first as 1...", async () => {
    saveGame({
      v: 1,
      mode: "local",
      color: "white",
      level: 2,
      initialFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      moves: ["e7e5"],
    });
    render(<PlayPage />);
    const list = await screen.findByRole("region", { name: "Lista de lances" });
    expect(list.textContent).toContain("1... e5");
  });

  it("shows the result and blocks the board when the game ends", async () => {
    saveGame({
      v: 1,
      mode: "local",
      color: "white",
      level: 2,
      initialFen: START,
      moves: ["f2f3", "e7e5", "g2g4", "d8h4"],
    });
    render(<PlayPage />);
    expect(await screen.findByRole("status")).toHaveTextContent("Xeque-mate");
    await userEvent.click(screen.getByLabelText(/^a2,/));
    expect(loadGame()?.moves).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeEnabled();
  });

  it("opens the promotion dialog, and cancelling plays nothing", async () => {
    search = "mode=local&fen=" + encodeURIComponent("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    render(<PlayPage />);
    await screen.findByRole("status");
    await userEvent.click(screen.getByLabelText(/^a7,/));
    await userEvent.click(screen.getByLabelText(/^a8/));
    expect(screen.getByRole("button", { name: "Cavalo" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Cavalo" })).toBeNull();
    expect(loadGame()?.moves).toEqual([]);
    await userEvent.click(screen.getByLabelText(/^a7,/));
    await userEvent.click(screen.getByLabelText(/^a8/));
    await userEvent.click(screen.getByRole("button", { name: "Cavalo" }));
    expect(loadGame()?.moves).toEqual(["a7a8n"]);
    expect(screen.getByRole("region", { name: "Lista de lances" })).toHaveTextContent("=N");
  });

  it("asks the engine to move first when the human plays black", async () => {
    search = "mode=ai&color=black&level=3";
    mockThinking = true;
    render(<PlayPage />);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ initialFen: START, moves: [], level: 3 });
    expect(await screen.findByTestId("thinking")).toBeInTheDocument();
  });

  it("Nova partida clears the saved game and goes home", async () => {
    search = "mode=local";
    render(<PlayPage />);
    await screen.findByRole("status");
    await userEvent.click(screen.getByRole("button", { name: "Nova partida" }));
    expect(push).toHaveBeenCalledWith("/");
    expect(loadGame()).toBeNull();
  });
});
