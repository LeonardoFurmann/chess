import { Chess } from "chess.js";
import { createGame, getFen, getLegalMoves, getStatus, play } from "@/engine";
import type { Game, GameMove, GameStatus, PromotionPiece, SquareName } from "@/engine";
import { randomPositions } from "../fixtures/random-positions";

/** Counters used to check that the sample really exercises the interesting cases. */
export interface OracleStats {
  positions: number;
  checks: number;
  checkmates: number;
  stalemates: number;
  insufficient: number;
  threefold: number;
  fiftyMove: number;
  enPassant: number;
  promotions: number;
  castles: number;
}

export interface OracleResult {
  stats: OracleStats;
  /** One reproducible message per diverging position (FEN, UCI history, differences). */
  divergences: string[];
}

export function emptyStats(): OracleStats {
  return {
    positions: 0,
    checks: 0,
    checkmates: 0,
    stalemates: 0,
    insufficient: 0,
    threefold: 0,
    fiftyMove: 0,
    enPassant: 0,
    promotions: 0,
    castles: 0,
  };
}

/** Status the oracle expects, using the engine's precedence (mate > stalemate > insufficient > threefold > 50). */
function expectedStatus(chess: Chess): string {
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (chess.isInsufficientMaterial()) return "draw:insufficient-material";
  if (chess.isThreefoldRepetition()) return "draw:threefold";
  if (chess.isDrawByFiftyMoves()) return "draw:fifty-move";
  return "playing";
}

function actualStatus(status: GameStatus): string {
  return status.kind === "draw" ? `draw:${status.reason}` : status.kind;
}

/**
 * First four FEN fields, with the en passant field kept only when a legal en passant capture
 * exists (engines differ on whether to always write the square after a double push).
 */
function normalizeFen(fen: string, hasLegalEnPassant: boolean): string {
  const [placement, side, castling, ep] = fen.split(" ");
  return [placement, side, castling, hasLegalEnPassant ? ep : "-"].join(" ");
}

/** A pawn capture onto the FEN en passant square is an en passant capture (the square is empty). */
function isEnPassant(ep: string, move: GameMove): boolean {
  return move.piece === "p" && move.captured && ep !== "-" && move.to === ep;
}

/** Compares everything the oracle checks for one position; returns the list of differences. */
export function comparePosition(game: Game, chess: Chess, stats?: OracleStats): string[] {
  const diffs: string[] = [];
  const ours: readonly GameMove[] = getLegalMoves(game);
  const theirs = chess.moves({ verbose: true });

  const oursByUci = new Map(ours.map((m) => [m.uci, m.san]));
  const theirsByUci = new Map(theirs.map((m) => [m.lan, m.san]));

  const onlyOurs = [...oursByUci.keys()].filter((u) => !theirsByUci.has(u)).sort();
  const onlyTheirs = [...theirsByUci.keys()].filter((u) => !oursByUci.has(u)).sort();
  if (onlyOurs.length > 0) diffs.push(`legal moves only in engine: ${onlyOurs.join(" ")}`);
  if (onlyTheirs.length > 0) diffs.push(`legal moves only in chess.js: ${onlyTheirs.join(" ")}`);
  if (ours.length !== oursByUci.size) diffs.push("engine returned duplicate legal moves");

  for (const [uci, san] of oursByUci) {
    const expected = theirsByUci.get(uci);
    if (expected !== undefined && expected !== san) diffs.push(`SAN of ${uci}: engine "${san}", chess.js "${expected}"`);
  }

  const status = getStatus(game);
  const expected = expectedStatus(chess);
  const actual = actualStatus(status);
  if (actual !== expected) diffs.push(`status: engine "${actual}", chess.js "${expected}"`);
  if (status.inCheck !== chess.isCheck()) diffs.push(`inCheck: engine ${status.inCheck}, chess.js ${chess.isCheck()}`);
  if (status.kind === "checkmate") {
    const winner = chess.turn() === "w" ? "b" : "w";
    if (status.winner !== winner) diffs.push(`winner: engine ${status.winner}, chess.js ${winner}`);
  }

  const fen = getFen(game);
  const ep = fen.split(" ")[3];
  const oursEp = ours.some((m) => isEnPassant(ep, m));
  const theirsEp = theirs.some((m) => m.flags.includes("e"));
  const fenOurs = normalizeFen(fen, oursEp);
  const fenTheirs = normalizeFen(chess.fen(), theirsEp);
  if (fenOurs !== fenTheirs) diffs.push(`FEN: engine "${fenOurs}", chess.js "${fenTheirs}"`);

  if (stats) {
    stats.positions++;
    if (status.inCheck) stats.checks++;
    if (actual === "checkmate") stats.checkmates++;
    if (actual === "stalemate") stats.stalemates++;
    if (actual === "draw:insufficient-material") stats.insufficient++;
    if (actual === "draw:threefold") stats.threefold++;
    if (actual === "draw:fifty-move") stats.fiftyMove++;
    if (theirsEp) stats.enPassant++;
    if (theirs.some((m) => m.promotion !== undefined)) stats.promotions++;
    if (theirs.some((m) => m.flags.includes("k") || m.flags.includes("q"))) stats.castles++;
  }
  return diffs;
}

function report(startFen: string, uciMoves: readonly string[], fen: string, diffs: string[]): string {
  return [
    `FEN: ${fen}`,
    `start FEN: ${startFen}`,
    `moves (UCI): ${uciMoves.length > 0 ? uciMoves.join(" ") : "(none)"}`,
    ...diffs.map((d) => `  - ${d}`),
  ].join("\n");
}

function applyUci(chess: Chess, uci: string): void {
  chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  });
}

/** Plays one move; once the game is over `play` refuses, so the Game is rebuilt directly (it is plain data). */
function advance(game: Game, uci: string): Game {
  if (getStatus(game).kind === "playing") {
    return play(game, {
      from: uci.slice(0, 2) as SquareName,
      to: uci.slice(2, 4) as SquareName,
      promotion: uci.length > 4 ? (uci[4] as PromotionPiece) : undefined,
    });
  }
  return { initialFen: game.initialFen, uciMoves: [...game.uciMoves, uci] };
}

/** Walks a scripted sequence of moves, comparing engine and chess.js before the first move and after each one. */
export function compareLine(startFen: string, uciMoves: readonly string[], stats?: OracleStats): string[] {
  const messages: string[] = [];
  let game = createGame(startFen);
  const chess = new Chess(startFen);
  const played: string[] = [];
  const check = () => {
    const diffs = comparePosition(game, chess, stats);
    if (diffs.length > 0) messages.push(report(startFen, played, chess.fen(), diffs));
  };
  check();
  for (const uci of uciMoves) {
    played.push(uci);
    game = advance(game, uci);
    applyUci(chess, uci);
    check();
  }
  return messages;
}

/**
 * Compares `count` positions from seeded random games (see random-positions.ts). Positions come
 * in game order, so each game is followed incrementally on both sides.
 */
export function runOracle(count: number, maxDivergences = 10): OracleResult {
  const stats = emptyStats();
  const divergences: string[] = [];
  let game: Game | null = null;
  let chess: Chess | null = null;

  for (const position of randomPositions({ count })) {
    const n = position.uciMoves.length;
    if (game !== null && chess !== null && game.initialFen === position.startFen && game.uciMoves.length === n - 1) {
      game = advance(game, position.uciMoves[n - 1]);
      applyUci(chess, position.uciMoves[n - 1]);
    } else {
      game = createGame(position.startFen);
      chess = new Chess(position.startFen);
      for (const uci of position.uciMoves) {
        game = advance(game, uci);
        applyUci(chess, uci);
      }
    }
    const diffs = comparePosition(game, chess, stats);
    if (chess.fen() !== position.fen) diffs.push(`fixture FEN differs from replayed chess.js FEN: ${position.fen}`);
    if (diffs.length > 0 && divergences.length < maxDivergences) {
      divergences.push(report(position.startFen, position.uciMoves, chess.fen(), diffs));
    }
  }
  return { stats, divergences };
}
