import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { saveGame } from "@/lib/storage";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockClear());

describe("Home page", () => {
  it("hides Continuar when nothing is saved", () => {
    render(<Home />);
    expect(screen.queryByRole("button", { name: "Continuar partida" })).toBeNull();
  });

  it("shows Continuar only with a saved game and navigates to /play", async () => {
    saveGame({ v: 1, mode: "local", color: "white", level: 2, initialFen: "x", moves: [] });
    render(<Home />);
    await userEvent.click(await screen.findByRole("button", { name: "Continuar partida" }));
    expect(push).toHaveBeenCalledWith("/play");
  });

  it("server render does not depend on localStorage", () => {
    saveGame({ v: 1, mode: "local", color: "white", level: 2, initialFen: "x", moves: [] });
    expect(renderToString(<Home />)).not.toContain("Continuar partida");
  });
});
