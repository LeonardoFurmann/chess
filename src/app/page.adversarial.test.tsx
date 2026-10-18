import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { saveGame, STORAGE_KEY, type SavedGame } from "@/lib/storage";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: push, prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const saved: SavedGame = {
  v: 1,
  mode: "local",
  color: "white",
  level: 2,
  initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  moves: ["e2e4"],
};

beforeEach(() => {
  push.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

function pick(name: RegExp) {
  const el =
    screen.queryByRole("radio", { name }) ??
    screen.queryByRole("tab", { name }) ??
    screen.queryByRole("option", { name }) ??
    screen.getByRole("button", { name });
  if (el.tagName === "OPTION") {
    const select = el.closest("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: (el as HTMLOptionElement).value } });
  } else {
    fireEvent.click(el);
  }
}

/** Activates the control and returns the URL the app navigates to (router push or anchor). */
function go(name: RegExp): URL {
  const el = (screen.queryByRole("link", { name }) ?? screen.getByRole("button", { name })) as HTMLElement;
  fireEvent.click(el);
  const href =
    push.mock.calls.length > 0 ? String(push.mock.calls[0][0]) : (el.closest("a")?.getAttribute("href") ?? "");
  expect(href).not.toBe("");
  return new URL(href, "http://localhost");
}

const colors: [RegExp, string][] = [
  [/brancas/i, "white"],
  [/pretas/i, "black"],
];
const levels: [RegExp, string][] = [
  [/f[aá]cil/i, "1"],
  [/m[eé]dio/i, "2"],
  [/dif[ií]cil/i, "3"],
];

describe("home screen adversarial", () => {
  it("local mode navigates to /play?mode=local", () => {
    render(<Home />);
    const url = go(/jogar local/i);
    expect(url.pathname).toBe("/play");
    expect(url.searchParams.get("mode")).toBe("local");
  });

  for (const [cName, cVal] of colors) {
    for (const [lName, lVal] of levels) {
      it(`ai ${cVal} level ${lVal}`, () => {
        render(<Home />);
        pick(cName);
        pick(lName);
        const url = go(/jogar contra a m[aá]quina/i);
        expect(url.pathname).toBe("/play");
        expect(url.searchParams.get("mode")).toBe("ai");
        expect(url.searchParams.get("color")).toBe(cVal);
        expect(url.searchParams.get("level")).toBe(lVal);
      });
    }
  }

  it("random colour is resolved to white or black, never 'random'", () => {
    const seen = new Set<string>();
    for (const r of [0, 0.99, 0.2, 0.8]) {
      vi.spyOn(Math, "random").mockReturnValue(r);
      push.mockReset();
      render(<Home />);
      pick(/aleat[oó]rio/i);
      pick(/m[eé]dio/i);
      const url = go(/jogar contra a m[aá]quina/i);
      const c = url.searchParams.get("color");
      expect(["white", "black"]).toContain(c);
      expect(url.toString()).not.toMatch(/random|aleat/i);
      expect(url.searchParams.get("level")).toBe("2");
      expect(url.searchParams.get("mode")).toBe("ai");
      seen.add(c as string);
      cleanup();
      vi.restoreAllMocks();
    }
    expect(seen.size).toBe(2);
  });

  it("does not show 'Continuar partida' without a saved game", () => {
    render(<Home />);
    expect(screen.queryByText(/continuar partida/i)).toBeNull();
  });

  it("does not show 'Continuar partida' for a corrupted or other-version save", () => {
    localStorage.setItem(STORAGE_KEY, "{");
    render(<Home />);
    expect(screen.queryByText(/continuar partida/i)).toBeNull();
    cleanup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, v: 2 }));
    render(<Home />);
    expect(screen.queryByText(/continuar partida/i)).toBeNull();
  });

  it("shows 'Continuar partida' with a saved game and goes to /play without params", async () => {
    saveGame(saved);
    render(<Home />);
    await screen.findByText(/continuar partida/i);
    const url = go(/continuar partida/i);
    expect(url.pathname).toBe("/play");
    expect(url.search).toBe("");
  });

  it("still renders when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => render(<Home />)).not.toThrow();
    expect(screen.queryByText(/continuar partida/i)).toBeNull();
    expect(screen.getByText(/jogar local/i)).toBeInTheDocument();
  });

  it("server render does not touch localStorage and omits the saved-game button", () => {
    saveGame(saved);
    const spy = vi.spyOn(Storage.prototype, "getItem");
    const html = renderToString(<Home />);
    expect(spy).not.toHaveBeenCalled();
    expect(html).not.toMatch(/continuar partida/i);
    expect(html).toMatch(/jogar local/i);
  });

  it("server render works without localStorage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => renderToString(<Home />)).not.toThrow();
  });

  it("hydrates a saved-game page without console errors", async () => {
    const { hydrateRoot } = await import("react-dom/client");
    const { act } = await import("react");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    // Server HTML produced with no saved game, then the client has one.
    const html = renderToString(<Home />);
    saveGame(saved);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => {
      hydrateRoot(container, <Home />);
    });
    expect(errors).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/continuar partida/i);
    container.remove();
  });
});
