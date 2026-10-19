import { createGame, type Game } from "@/engine";
import { restoreGame } from "@/hooks/useGame";
import { clearGame, loadGame, saveGame, type SavedGame } from "@/lib/storage";

export type PlayInit =
  | { kind: "ready"; saved: SavedGame; game: Game }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

/** True when the URL asks for a new game (docs/SPEC.md §6.1). */
export function hasGameParams(params: URLSearchParams): boolean {
  return params.has("mode") || params.has("fen") || params.has("color") || params.has("level");
}

/** Decides what /play shows. Client only (reads and writes localStorage). */
export function resolvePlayInit(params: URLSearchParams): PlayInit {
  if (hasGameParams(params)) {
    const mode = params.get("mode") ?? "local";
    if (mode !== "local" && mode !== "ai") {
      return { kind: "error", message: "Modo de jogo inválido." };
    }
    let game: Game;
    try {
      game = createGame(params.get("fen") ?? undefined);
    } catch {
      return { kind: "error", message: "A posição (FEN) informada é inválida." };
    }
    const levelParam = Number(params.get("level"));
    const level = levelParam === 1 || levelParam === 3 ? levelParam : 2;
    const color = mode === "ai" && params.get("color") === "black" ? "black" : "white";
    const saved: SavedGame = { v: 1, mode, color, level, initialFen: game.initialFen, moves: [] };
    saveGame(saved);
    return { kind: "ready", saved, game };
  }

  const saved = loadGame();
  if (saved === null) return { kind: "redirect" };
  const game = restoreGame(saved);
  if (game === null) {
    // Saved moves do not reproduce: treat as no saved game.
    clearGame();
    return { kind: "redirect" };
  }
  return { kind: "ready", saved, game };
}
