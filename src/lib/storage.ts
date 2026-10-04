/** Persisted game (docs/SPEC.md §6.5). */
export interface SavedGame {
  v: 1;
  mode: "local" | "ai";
  /** Human player's colour; "white" in local mode. */
  color: "white" | "black";
  level: 1 | 2 | 3;
  initialFen: string;
  /** Moves in UCI. */
  moves: string[];
}

export const STORAGE_KEY = "chess:current-game";

/** Saved game, or null if missing, corrupted, from another version or storage is unavailable. */
export function loadGame(): SavedGame | null {
  throw new Error("not implemented");
}

/** Never throws (storage errors are ignored). */
export function saveGame(game: SavedGame): void {
  throw new Error("not implemented");
}

export function clearGame(): void {
  throw new Error("not implemented");
}
