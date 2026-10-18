import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "@/components/home/home-screen";
import { aiUrl } from "@/components/home/play-url";

afterEach(() => vi.restoreAllMocks());

function setup(hasSavedGame = false) {
  const onNavigate = vi.fn();
  render(<HomeScreen hasSavedGame={hasSavedGame} onNavigate={onNavigate} />);
  return onNavigate;
}

const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));

describe("HomeScreen", () => {
  it("local mode navigates to /play?mode=local", async () => {
    const nav = setup();
    await click("Jogar local");
    expect(nav).toHaveBeenCalledWith("/play?mode=local");
  });

  const colors = [
    ["Brancas", "white"],
    ["Pretas", "black"],
  ] as const;
  const levels = [
    ["Fácil", 1],
    ["Médio", 2],
    ["Difícil", 3],
  ] as const;

  for (const [colorLabel, color] of colors) {
    for (const [levelLabel, level] of levels) {
      it(`AI ${colorLabel}/${levelLabel}`, async () => {
        const nav = setup();
        await click(colorLabel);
        await click(levelLabel);
        await click("Jogar contra a máquina");
        expect(nav).toHaveBeenCalledWith(`/play?mode=ai&color=${color}&level=${level}`);
      });
    }
  }

  it("random colour resolves to white or black, never random", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    const nav = setup();
    await click("Aleatório");
    await click("Jogar contra a máquina");
    await click("Jogar contra a máquina");
    expect(nav).toHaveBeenNthCalledWith(1, "/play?mode=ai&color=white&level=2");
    expect(nav).toHaveBeenNthCalledWith(2, "/play?mode=ai&color=black&level=2");
    for (const [url] of nav.mock.calls) expect(url).not.toContain("random");
  });

  it("hides Continuar without a saved game", () => {
    setup(false);
    expect(screen.queryByRole("button", { name: "Continuar partida" })).toBeNull();
  });

  it("shows Continuar with a saved game and navigates to /play", async () => {
    const nav = setup(true);
    await click("Continuar partida");
    expect(nav).toHaveBeenCalledWith("/play");
  });
});

describe("aiUrl", () => {
  it("resolves random with the given generator", () => {
    expect(aiUrl("random", 3, () => 0.2)).toBe("/play?mode=ai&color=white&level=3");
    expect(aiUrl("random", 3, () => 0.7)).toBe("/play?mode=ai&color=black&level=3");
  });
});
