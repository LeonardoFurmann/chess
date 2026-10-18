import {
  BLACK,
  WHITE,
  createRng,
  generateLegalMoves,
  inCheck,
  isFiftyMoveDraw,
  isInsufficientMaterial,
  makeMove,
  parseFen,
  repetitionCount,
  START_FEN,
} from "@/engine/core";
import type { Color, Move, Position, Rng } from "@/engine/core";

/** Chooses a move for the side to move, or null to give up. May not mutate the position. */
export type Player = (position: Position) => Move | null;

export type GameOutcome = "white" | "black" | "draw";

export interface GameResult {
  outcome: GameOutcome;
  reason: "checkmate" | "stalemate" | "insufficient" | "fifty-move" | "repetition" | "max-plies";
  plies: number;
  /** Moves a player returned that are not legal in the position (the game stops there). */
  illegalMoves: { ply: number; move: Move | null }[];
}

export interface PlayGameOptions {
  white: Player;
  black: Player;
  startFen?: string;
  /** The game is drawn when it reaches this many plies (default 400). */
  maxPlies?: number;
}

/** Player that picks uniformly among the legal moves using a seeded generator. */
export function createRandomPlayer(rng: Rng): Player {
  return (position) => {
    const moves = generateLegalMoves(position);
    return moves.length === 0 ? null : moves[rng.nextInt(moves.length)];
  };
}

/** Plays a full game, verifying every returned move against the legal move list. */
export function playGame({
  white,
  black,
  startFen = START_FEN,
  maxPlies = 400,
}: PlayGameOptions): GameResult {
  const position = parseFen(startFen);
  const illegalMoves: GameResult["illegalMoves"] = [];
  const finish = (
    outcome: GameOutcome,
    reason: GameResult["reason"],
    plies: number,
  ): GameResult => ({ outcome, reason, plies, illegalMoves });

  for (let plies = 0; ; plies++) {
    const moves = generateLegalMoves(position);
    if (moves.length === 0) {
      if (inCheck(position)) {
        return finish(position.sideToMove === WHITE ? "black" : "white", "checkmate", plies);
      }
      return finish("draw", "stalemate", plies);
    }
    if (isInsufficientMaterial(position)) return finish("draw", "insufficient", plies);
    if (isFiftyMoveDraw(position)) return finish("draw", "fifty-move", plies);
    if (repetitionCount(position) >= 3) return finish("draw", "repetition", plies);
    if (plies >= maxPlies) return finish("draw", "max-plies", plies);

    const player = position.sideToMove === WHITE ? white : black;
    const move = player(position);
    if (move === null || !moves.includes(move)) {
      illegalMoves.push({ ply: plies, move });
      return finish("draw", "max-plies", plies);
    }
    makeMove(position, move);
  }
}

/** Which colour a result favours, or null for a draw. */
export function winnerColor(result: GameResult): Color | null {
  if (result.outcome === "white") return WHITE;
  if (result.outcome === "black") return BLACK;
  return null;
}

/** Seeded generator for tests, re-exported so tests need a single import. */
export { createRng };
