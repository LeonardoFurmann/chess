import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as MoveListMod from "@/components/panel/MoveList";
import * as StatusBarMod from "@/components/panel/GameStatusBar";
import * as ControlsMod from "@/components/panel/GameControls";
import * as PromoMod from "@/components/promotion/PromotionDialog";
import { describeStatus } from "@/components/panel/describe-status";
import type { GameStatus } from "@/engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
const pick = (m: any, name: string) => m[name] ?? m.default;
const MoveList = pick(MoveListMod, "MoveList");
const GameStatusBar = pick(StatusBarMod, "GameStatusBar");
const GameControls = pick(ControlsMod, "GameControls");
const PromotionDialog = pick(PromoMod, "PromotionDialog");

const text = () => document.body.textContent ?? "";

describe("MoveList (adversarial)", () => {
  it("renders pairs for an odd number of moves", () => {
    render(<MoveList moves={["e4", "e5", "Nf3"]} />);
    expect(text()).toContain("1. e4");
    expect(text()).toContain("e5");
    expect(text()).toContain("2. Nf3");
    expect(text()).not.toContain("2... ");
  });

  it("renders an empty list without crashing or numbering", () => {
    render(<MoveList moves={[]} />);
    expect(text()).not.toMatch(/1\./);
  });

  it("renders a single move", () => {
    render(<MoveList moves={["d4"]} />);
    expect(text()).toContain("1. d4");
    expect(text()).not.toContain("2.");
  });

  it("keeps SAN markers like check, mate and promotion intact", () => {
    render(<MoveList moves={["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"]} />);
    expect(text()).toContain("4. Qxf7#");
  });

  it("keeps promotion SAN intact", () => {
    render(<MoveList moves={["e8=N+"]} />);
    expect(text()).toContain("e8=N+");
  });

  it("numbers double-digit moves", () => {
    const moves = Array.from({ length: 22 }, (_, i) => `m${i}`);
    render(<MoveList moves={moves} />);
    expect(text()).toContain("11. m20");
    expect(text()).toContain("m21");
  });

  it("updates when new moves are added", () => {
    const { rerender } = render(<MoveList moves={["e4"]} />);
    rerender(<MoveList moves={["e4", "e5"]} />);
    expect(text()).toContain("e5");
  });
});

describe("describeStatus (adversarial)", () => {
  const rows: [GameStatus, "w" | "b", RegExp][] = [
    [{ kind: "checkmate", winner: "w", inCheck: true }, "b", /Xeque-mate\s*[—-]\s*brancas vencem/i],
    [{ kind: "checkmate", winner: "b", inCheck: true }, "w", /Xeque-mate\s*[—-]\s*pretas vencem/i],
    [{ kind: "stalemate", inCheck: false }, "w", /Empate por afogamento/i],
    [{ kind: "draw", reason: "threefold", inCheck: false }, "w", /Empate por tripla repeti/i],
    [{ kind: "draw", reason: "fifty-move", inCheck: false }, "b", /Empate pela regra dos 50 lances/i],
    [{ kind: "draw", reason: "insufficient-material", inCheck: false }, "w", /Empate por material insuficiente/i],
    [{ kind: "playing", inCheck: false }, "w", /Vez das brancas/i],
    [{ kind: "playing", inCheck: false }, "b", /Vez das pretas/i],
  ];
  it.each(rows)("%j turn %s", (status, turn, re) => {
    expect(describeStatus(status, turn)).toMatch(re);
  });

  it("mentions check when playing in check", () => {
    expect(describeStatus({ kind: "playing", inCheck: true }, "b")).toMatch(/Xeque/i);
  });

  it("checkmate result does not depend on the turn", () => {
    const s: GameStatus = { kind: "checkmate", winner: "w", inCheck: true };
    expect(describeStatus(s, "w")).toBe(describeStatus(s, "b"));
  });
});

describe("GameStatusBar (adversarial)", () => {
  it("shows whose turn it is", () => {
    render(<GameStatusBar status={{ kind: "playing", inCheck: false }} turn="w" thinking={false} />);
    expect(text()).toMatch(/Vez das brancas/);
    expect(text()).not.toMatch(/pensando/);
  });

  it("shows check", () => {
    render(<GameStatusBar status={{ kind: "playing", inCheck: true }} turn="b" thinking={false} />);
    expect(text()).toMatch(/Xeque!/);
  });

  it("shows the AI thinking indicator", () => {
    render(<GameStatusBar status={{ kind: "playing", inCheck: false }} turn="b" thinking />);
    expect(text()).toMatch(/IA pensando/);
  });

  it("shows the final result", () => {
    render(
      <GameStatusBar status={{ kind: "checkmate", winner: "w", inCheck: true }} turn="b" thinking={false} />,
    );
    expect(text()).toMatch(/Xeque-mate/);
    expect(text()).toMatch(/brancas vencem/);
  });

  it("shows a draw reason", () => {
    render(
      <GameStatusBar status={{ kind: "draw", reason: "threefold", inCheck: false }} turn="w" thinking={false} />,
    );
    expect(text()).toMatch(/tripla repeti/);
  });
});

describe("GameControls (adversarial)", () => {
  it("fires each callback exactly once", async () => {
    const [u, n, f] = [vi.fn(), vi.fn(), vi.fn()];
    render(<GameControls canUndo onUndo={u} onNewGame={n} onFlip={f} />);
    await userEvent.click(screen.getByRole("button", { name: /desfazer/i }));
    await userEvent.click(screen.getByRole("button", { name: /nova partida/i }));
    await userEvent.click(screen.getByRole("button", { name: /virar/i }));
    expect(u).toHaveBeenCalledTimes(1);
    expect(n).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("disabled undo does not fire but other buttons stay enabled", async () => {
    const [u, n, f] = [vi.fn(), vi.fn(), vi.fn()];
    render(<GameControls canUndo={false} onUndo={u} onNewGame={n} onFlip={f} />);
    const undo = screen.getByRole("button", { name: /desfazer/i });
    expect(undo).toBeDisabled();
    await userEvent.click(undo);
    expect(u).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /nova partida/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /virar/i })).toBeEnabled();
  });

  it("enables undo when canUndo is true", () => {
    render(<GameControls canUndo onUndo={vi.fn()} onNewGame={vi.fn()} onFlip={vi.fn()} />);
    expect(screen.getByRole("button", { name: /desfazer/i })).toBeEnabled();
  });
});

describe("PromotionDialog (adversarial)", () => {
  it("is an accessible dialog", () => {
    render(<PromotionDialog color="w" onSelect={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("offers queen, rook, bishop and knight", () => {
    render(<PromotionDialog color="w" onSelect={vi.fn()} onCancel={vi.fn()} />);
    for (const re of [/dama/i, /torre/i, /bispo/i, /cavalo/i]) {
      expect(screen.getByRole("button", { name: re })).toBeInTheDocument();
    }
  });

  it.each([
    [/dama/i, "q"],
    [/torre/i, "r"],
    [/bispo/i, "b"],
    [/cavalo/i, "n"],
  ])("selecting %s calls onSelect(%s) once", async (re, piece) => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    render(<PromotionDialog color="b" onSelect={onSelect} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: re }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(piece);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("Escape cancels and does not select", async () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    render(<PromotionDialog color="w" onSelect={onSelect} onCancel={onCancel} />);
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("uses piece images of the given color from /pieces", () => {
    const { rerender } = render(<PromotionDialog color="w" onSelect={vi.fn()} onCancel={vi.fn()} />);
    const srcs = () => Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    for (const p of ["Q", "R", "B", "N"]) expect(srcs().some((s) => s.includes(`/pieces/w${p}`))).toBe(true);
    rerender(<PromotionDialog color="b" onSelect={vi.fn()} onCancel={vi.fn()} />);
    for (const p of ["Q", "R", "B", "N"]) expect(srcs().some((s) => s.includes(`/pieces/b${p}`))).toBe(true);
  });

  it("traps focus: Tab never leaves the dialog", async () => {
    render(
      <div>
        <button>outside</button>
        <PromotionDialog color="w" onSelect={vi.fn()} onCancel={vi.fn()} />
      </div>,
    );
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 10; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 10; i++) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});
