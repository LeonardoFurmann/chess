import { Chess } from "chess.js";
import { createRng } from "@/engine/core/rng";
import { PERFT_CASES } from "./perft";

/** A position reached by random play: replay `uciMoves` from `startFen` to get `fen`. */
export interface RandomPosition {
  startFen: string;
  uciMoves: readonly string[];
  fen: string;
}

export interface RandomPositionsOptions {
  /** Total number of positions to return. */
  count: number;
  seed?: number;
  /** Maximum plies per game before starting a new one. */
  maxPlies?: number;
  /** Games start from these FENs in round-robin (default: initial + perft positions). */
  startFens?: readonly string[];
}

const DEFAULT_START_FENS = PERFT_CASES.map((c) => c.fen);

/**
 * Deterministic positions from random games played with chess.js. Every ply of every game is
 * a position (the start position included); games restart when they end or reach maxPlies.
 */
export function randomPositions({
  count,
  seed = 20261003,
  maxPlies = 120,
  startFens = DEFAULT_START_FENS,
}: RandomPositionsOptions): RandomPosition[] {
  const rng = createRng(seed);
  const positions: RandomPosition[] = [];
  let gameIndex = 0;

  while (positions.length < count) {
    const startFen = startFens[gameIndex % startFens.length];
    gameIndex++;
    const chess = new Chess(startFen);
    const uciMoves: string[] = [];
    positions.push({ startFen, uciMoves: [], fen: chess.fen() });

    while (positions.length < count && uciMoves.length < maxPlies) {
      const moves = chess.moves({ verbose: true });
      // Threefold repetition is not checked: chess.js replays the whole history for it.
      if (moves.length === 0 || chess.isInsufficientMaterial() || chess.isDrawByFiftyMoves()) break;
      const move = moves[rng.nextInt(moves.length)];
      chess.move(move);
      uciMoves.push(move.lan);
      positions.push({ startFen, uciMoves: [...uciMoves], fen: chess.fen() });
    }
  }
  return positions;
}
