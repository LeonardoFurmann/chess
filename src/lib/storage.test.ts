import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGame, loadGame, saveGame, STORAGE_KEY, type SavedGame } from "@/lib/storage";

const game: SavedGame = {
  v: 1,
  mode: "ai",
  color: "black",
  level: 2,
  initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  moves: ["e2e4", "e7e5"],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storage", () => {
  it("round-trips a saved game", () => {
    saveGame(game);
    expect(loadGame()).toEqual(game);
  });

  it("returns null when the key is missing", () => {
    expect(loadGame()).toBeNull();
  });

  it.each([
    ["invalid JSON", "{"],
    ["other version", JSON.stringify({ ...game, v: 2 })],
    ["missing moves", JSON.stringify({ ...game, moves: undefined })],
    ["non-string moves", JSON.stringify({ ...game, moves: [1] })],
    ["bad level", JSON.stringify({ ...game, level: 5 })],
    ["null", "null"],
  ])("returns null for %s", (_name, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(loadGame()).toBeNull();
  });

  it("clearGame removes the saved game", () => {
    saveGame(game);
    clearGame();
    expect(loadGame()).toBeNull();
  });

  it("does not throw when localStorage throws", () => {
    const boom = () => {
      throw new Error("denied");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);
    expect(loadGame()).toBeNull();
    expect(() => saveGame(game)).not.toThrow();
    expect(() => clearGame()).not.toThrow();
  });
});
