import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Color, GameStatus } from "@/engine";
import { describeStatus } from "@/components/panel/describe-status";
import { GameControls } from "@/components/panel/GameControls";
import { GameStatusBar } from "@/components/panel/GameStatusBar";
import { MoveList } from "@/components/panel/MoveList";

describe("MoveList", () => {
  it("numbers moves in pairs", () => {
    render(<MoveList moves={["e4", "e5", "Nf3"]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("1. e4 e5");
    expect(items[1]).toHaveTextContent("2. Nf3");
  });

  it("starts with Black when firstColor is b", () => {
    render(<MoveList moves={["e5", "Nf3", "Nc6"]} firstColor="b" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("1... e5");
    expect(items[1]).toHaveTextContent("2. Nf3 Nc6");
  });

  it("shows a lone Black first move as 1...", () => {
    render(<MoveList moves={["e5"]} firstColor="b" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("1... e5");
  });

  it("renders an empty list", () => {
    render(<MoveList moves={[]} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("describeStatus", () => {
  const table: [GameStatus, Color, string][] = [
    [{ kind: "playing", inCheck: false }, "w", "Vez das brancas"],
    [{ kind: "playing", inCheck: false }, "b", "Vez das pretas"],
    [{ kind: "playing", inCheck: true }, "b", "Xeque! Vez das pretas"],
    [
      { kind: "checkmate", winner: "w", inCheck: true },
      "b",
      "Xeque-mate — brancas vencem",
    ],
    [
      { kind: "checkmate", winner: "b", inCheck: true },
      "w",
      "Xeque-mate — pretas vencem",
    ],
    [{ kind: "stalemate", inCheck: false }, "w", "Empate por afogamento"],
    [
      { kind: "draw", reason: "threefold", inCheck: false },
      "w",
      "Empate por tripla repetição",
    ],
    [
      { kind: "draw", reason: "fifty-move", inCheck: false },
      "w",
      "Empate pela regra dos 50 lances",
    ],
    [
      { kind: "draw", reason: "insufficient-material", inCheck: false },
      "w",
      "Empate por material insuficiente",
    ],
  ];
  it.each(table)("describes %j for turn %s", (status, turn, expected) => {
    expect(describeStatus(status, turn)).toBe(expected);
  });
});

describe("GameStatusBar", () => {
  it("shows the thinking indicator", () => {
    render(
      <GameStatusBar
        status={{ kind: "playing", inCheck: false }}
        turn="b"
        thinking
      />,
    );
    expect(screen.getByText("Vez das pretas")).toBeInTheDocument();
    expect(screen.getByText("IA pensando…")).toBeInTheDocument();
  });

  it("hides the indicator when not thinking", () => {
    render(
      <GameStatusBar
        status={{ kind: "playing", inCheck: true }}
        turn="w"
        thinking={false}
      />,
    );
    expect(screen.getByText(/Xeque!/)).toBeInTheDocument();
    expect(screen.queryByText("IA pensando…")).toBeNull();
  });
});

describe("GameControls", () => {
  it("disables undo when canUndo is false", async () => {
    const onUndo = vi.fn();
    render(
      <GameControls
        canUndo={false}
        onUndo={onUndo}
        onNewGame={vi.fn()}
        onFlip={vi.fn()}
      />,
    );
    const undo = screen.getByRole("button", { name: "Desfazer" });
    expect(undo).toBeDisabled();
    await userEvent.click(undo);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("fires the callbacks", async () => {
    const onUndo = vi.fn();
    const onNewGame = vi.fn();
    const onFlip = vi.fn();
    render(
      <GameControls
        canUndo
        onUndo={onUndo}
        onNewGame={onNewGame}
        onFlip={onFlip}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await userEvent.click(screen.getByRole("button", { name: "Nova partida" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Virar tabuleiro" }),
    );
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onNewGame).toHaveBeenCalledTimes(1);
    expect(onFlip).toHaveBeenCalledTimes(1);
  });
});
