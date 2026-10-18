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

function isSavedGame(value: unknown): value is SavedGame {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    g.v === 1 &&
    (g.mode === "local" || g.mode === "ai") &&
    (g.color === "white" || g.color === "black") &&
    (g.level === 1 || g.level === 2 || g.level === 3) &&
    typeof g.initialFen === "string" &&
    Array.isArray(g.moves) &&
    g.moves.every((m) => typeof m === "string")
  );
}

/** Saved game, or null if missing, corrupted, from another version or storage is unavailable. */
export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSavedGame(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Never throws (storage errors are ignored). */
export function saveGame(game: SavedGame): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  } catch {
    // storage unavailable or full: ignore
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable: ignore
  }
}
