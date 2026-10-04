import type { BoardState, Color, Game, GameMove, GameStatus, MoveInput, SquareName } from "./types";

/** New game from a FEN (default: initial position). Throws on invalid FEN. */
export function createGame(fen?: string): Game {
  throw new Error("not implemented");
}

/** New game with the move applied. Throws on an illegal move or if the game is over. */
export function play(game: Game, move: MoveInput): Game {
  throw new Error("not implemented");
}

/** New game without the last move (equivalent game if there are no moves). */
export function undo(game: Game): Game {
  throw new Error("not implemented");
}

export function getLegalMoves(game: Game): readonly GameMove[] {
  throw new Error("not implemented");
}

export function getLegalMovesFrom(game: Game, square: SquareName): readonly GameMove[] {
  throw new Error("not implemented");
}

/** Precedence: checkmate > stalemate > insufficient material > threefold > fifty-move. */
export function getStatus(game: Game): GameStatus {
  throw new Error("not implemented");
}

export function getBoard(game: Game): BoardState {
  throw new Error("not implemented");
}

export function getTurn(game: Game): Color {
  throw new Error("not implemented");
}

export function getFen(game: Game): string {
  throw new Error("not implemented");
}

export function getHistory(game: Game): readonly GameMove[] {
  throw new Error("not implemented");
}

export function getLastMove(game: Game): GameMove | null {
  throw new Error("not implemented");
}

export function getInitialFen(game: Game): string {
  throw new Error("not implemented");
}

export function getUciMoves(game: Game): readonly string[] {
  throw new Error("not implemented");
}
