import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGame, loadGame, saveGame, STORAGE_KEY, type SavedGame } from "@/lib/storage";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const sample: SavedGame = {
  v: 1,
  mode: "ai",
  color: "black",
  level: 3,
  initialFen: START,
  moves: ["e2e4", "e7e5", "g1f3", "e7e8q"],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("storage adversarial", () => {
  it("uses the documented key", () => {
    expect(STORAGE_KEY).toBe("chess:current-game");
  });

  it("round-trips a game and stores it under the key", () => {
    saveGame(sample);
    expect(localStorage.getItem("chess:current-game")).not.toBeNull();
    expect(loadGame()).toEqual(sample);
  });

  it("round-trips an empty move list and local mode", () => {
    const g: SavedGame = { ...sample, mode: "local", color: "white", level: 1, moves: [] };
    saveGame(g);
    expect(loadGame()).toEqual(g);
  });

  it("overwrites a previous save", () => {
    saveGame(sample);
    const next = { ...sample, moves: [...sample.moves, "a2a3"] };
    saveGame(next);
    expect(loadGame()).toEqual(next);
  });

  it("clearGame removes the save and is idempotent", () => {
    saveGame(sample);
    clearGame();
    expect(loadGame()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(() => clearGame()).not.toThrow();
  });

  it("returns null when the key is absent", () => {
    expect(loadGame()).toBeNull();
  });

  it.each([
    ["truncated JSON", "{"],
    ["empty string", ""],
    ["garbage", "not json at all"],
    ["null literal", "null"],
    ["number", "42"],
    ["string literal", '"abc"'],
    ["array", "[]"],
    ["version 2", JSON.stringify({ ...sample, v: 2 })],
    ["version 0", JSON.stringify({ ...sample, v: 0 })],
    ["missing v", JSON.stringify({ ...sample, v: undefined })],
    ["string version", JSON.stringify({ ...sample, v: "1" })],
    ["missing moves", JSON.stringify({ ...sample, moves: undefined })],
    ["moves not an array", JSON.stringify({ ...sample, moves: "e2e4" })],
    ["moves null", JSON.stringify({ ...sample, moves: null })],
    ["missing initialFen", JSON.stringify({ ...sample, initialFen: undefined })],
    ["missing mode", JSON.stringify({ ...sample, mode: undefined })],
    ["missing color", JSON.stringify({ ...sample, color: undefined })],
    ["missing level", JSON.stringify({ ...sample, level: undefined })],
    ["v2 minimal", JSON.stringify({ v: 2 })],
  ])("returns null for %s", (_name, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(() => loadGame()).not.toThrow();
    expect(loadGame()).toBeNull();
  });

  it("does not throw when getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => loadGame()).not.toThrow();
    expect(loadGame()).toBeNull();
  });

  it("does not throw when setItem throws (quota)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => saveGame(sample)).not.toThrow();
  });

  it("does not throw when removeItem throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => clearGame()).not.toThrow();
  });

  it("does not throw when localStorage itself is undefined", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => loadGame()).not.toThrow();
    expect(loadGame()).toBeNull();
    expect(() => saveGame(sample)).not.toThrow();
    expect(() => clearGame()).not.toThrow();
  });

  it("does not throw when the localStorage getter throws", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => loadGame()).not.toThrow();
    expect(loadGame()).toBeNull();
    expect(() => saveGame(sample)).not.toThrow();
    expect(() => clearGame()).not.toThrow();
  });
});
