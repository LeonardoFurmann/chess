import {
  BLACK,
  START_FEN,
  WHITE,
  clonePosition,
  generateLegalMoves,
  hasFlag,
  inCheck,
  isFiftyMoveDraw,
  isInsufficientMaterial,
  makeMove,
  moveFrom,
  movePromotion,
  moveTo,
  moveToSan,
  moveToUci,
  parseFen,
  parseSquare,
  pieceColor,
  pieceKind,
  repetitionCount,
  squareName,
  toFen,
  uciToMove,
  MOVE_CAPTURE,
} from "@/engine/core";
import type { Move, Position } from "@/engine/core";
import type {
  BoardState,
  Color,
  Game,
  GameMove,
  GameStatus,
  MoveInput,
  Piece,
  PieceType,
  PromotionPiece,
  SquareName,
} from "./types";

/**
 * Private derived state, keyed by the (frozen) Game object. The cached Position is never exposed
 * and never mutated after it is built (the move generators restore it before returning).
 */
interface Derived {
  readonly position: Position;
  history: readonly GameMove[] | null;
}

const derivedByGame = new WeakMap<Game, Derived>();

const PIECE_TYPES: Readonly<Record<number, PieceType>> = { 1: "p", 2: "n", 3: "b", 4: "r", 5: "q", 6: "k" };
const PROMOTIONS: Readonly<Record<number, PromotionPiece>> = { 2: "n", 3: "b", 4: "r", 5: "q" };

function toColor(side: number): Color {
  return side === WHITE ? "w" : "b";
}

/** Builds the position by replaying every move from the initial FEN (so repetition sees them all). */
function replay(initialFen: string, uciMoves: readonly string[]): Position {
  const position = parseFen(initialFen);
  for (const uci of uciMoves) {
    const move = uciToMove(position, uci);
    if (move === null) throw new Error(`Illegal move in game: ${uci}`);
    makeMove(position, move);
  }
  return position;
}

function freezeGame(initialFen: string, uciMoves: readonly string[], position: Position): Game {
  const game: Game = Object.freeze({ initialFen, uciMoves: Object.freeze([...uciMoves]) });
  derivedByGame.set(game, { position, history: null });
  return game;
}

function derive(game: Game): Derived {
  let derived = derivedByGame.get(game);
  if (derived === undefined) {
    derived = { position: replay(game.initialFen, game.uciMoves), history: null };
    derivedByGame.set(game, derived);
  }
  return derived;
}

/** GameMove for a legal move of the position (computed before the move is played). */
function describeMove(position: Position, move: Move): GameMove {
  const from = moveFrom(move);
  const piece = position.board[from];
  const promotion = movePromotion(move);
  const base = {
    from: squareName(from) as SquareName,
    to: squareName(moveTo(move)) as SquareName,
    color: toColor(pieceColor(piece)),
    piece: PIECE_TYPES[pieceKind(piece)],
    captured: hasFlag(move, MOVE_CAPTURE),
    san: moveToSan(position, move),
    uci: moveToUci(move),
  };
  return Object.freeze(promotion === 0 ? base : { ...base, promotion: PROMOTIONS[promotion] });
}

/** New game from a FEN (default: initial position). Throws on invalid FEN. */
export function createGame(fen?: string): Game {
  const initialFen = fen ?? START_FEN;
  return freezeGame(initialFen, [], parseFen(initialFen));
}

/** New game with the move applied. Throws on an illegal move or if the game is over. */
export function play(game: Game, move: MoveInput): Game {
  if (getStatus(game).kind !== "playing") throw new Error("Game is over");
  const position = derive(game).position;
  // uciToMove only accepts a promotion suffix when the move really is a promotion, and requires it then.
  const packed = uciToMove(position, `${move.from}${move.to}${move.promotion ?? ""}`);
  if (packed === null) throw new Error(`Illegal move: ${move.from}${move.to}${move.promotion ?? ""}`);
  const next = clonePosition(position);
  makeMove(next, packed);
  return freezeGame(game.initialFen, [...game.uciMoves, moveToUci(packed)], next);
}

/** New game without the last move (equivalent game if there are no moves). */
export function undo(game: Game): Game {
  const uciMoves = game.uciMoves.slice(0, -1);
  return freezeGame(game.initialFen, uciMoves, replay(game.initialFen, uciMoves));
}

export function getLegalMoves(game: Game): readonly GameMove[] {
  const position = derive(game).position;
  return Object.freeze(generateLegalMoves(position).map((move) => describeMove(position, move)));
}

export function getLegalMovesFrom(game: Game, square: SquareName): readonly GameMove[] {
  const from = parseSquare(square);
  const position = derive(game).position;
  return Object.freeze(
    generateLegalMoves(position)
      .filter((move) => moveFrom(move) === from)
      .map((move) => describeMove(position, move)),
  );
}

/** Precedence: checkmate > stalemate > insufficient material > threefold > fifty-move. */
export function getStatus(game: Game): GameStatus {
  const position = derive(game).position;
  const check = inCheck(position);
  if (generateLegalMoves(position).length === 0) {
    if (check) {
      // The side to move is mated, so the other side wins.
      const winner: Color = position.sideToMove === WHITE ? "b" : "w";
      return Object.freeze({ kind: "checkmate", winner, inCheck: true } as const);
    }
    return Object.freeze({ kind: "stalemate", inCheck: false } as const);
  }
  if (isInsufficientMaterial(position)) {
    return Object.freeze({ kind: "draw", reason: "insufficient-material", inCheck: check } as const);
  }
  if (repetitionCount(position) >= 3) {
    return Object.freeze({ kind: "draw", reason: "threefold", inCheck: check } as const);
  }
  if (isFiftyMoveDraw(position)) {
    return Object.freeze({ kind: "draw", reason: "fifty-move", inCheck: check } as const);
  }
  return Object.freeze({ kind: "playing", inCheck: check } as const);
}

export function getBoard(game: Game): BoardState {
  const board = derive(game).position.board;
  const squares: (Piece | null)[] = [];
  for (let i = 0; i < 64; i++) {
    const code = board[i];
    squares.push(
      code === 0
        ? null
        : Object.freeze({ color: toColor(code > 0 ? WHITE : BLACK), type: PIECE_TYPES[pieceKind(code)] }),
    );
  }
  return Object.freeze(squares);
}

export function getTurn(game: Game): Color {
  return toColor(derive(game).position.sideToMove);
}

export function getFen(game: Game): string {
  return toFen(derive(game).position);
}

export function getHistory(game: Game): readonly GameMove[] {
  const derived = derive(game);
  if (derived.history === null) {
    const position = parseFen(game.initialFen);
    const moves: GameMove[] = [];
    for (const uci of game.uciMoves) {
      const move = uciToMove(position, uci);
      if (move === null) throw new Error(`Illegal move in game: ${uci}`);
      moves.push(describeMove(position, move));
      makeMove(position, move);
    }
    derived.history = Object.freeze(moves);
  }
  return derived.history;
}

export function getLastMove(game: Game): GameMove | null {
  const history = getHistory(game);
  return history.length === 0 ? null : history[history.length - 1];
}

export function getInitialFen(game: Game): string {
  return game.initialFen;
}

export function getUciMoves(game: Game): readonly string[] {
  return game.uciMoves;
}
