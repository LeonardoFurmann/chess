import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createGame,
  getBoard,
  getHistory,
  getLegalMoves,
  getLegalMovesFrom,
  getStatus,
  getTurn,
  play,
  undo as undoGame,
  type BoardState,
  type Color,
  type Game,
  type GameMove,
  type GameStatus,
  type MoveInput,
  type PromotionPiece,
  type SquareName,
} from "@/engine";
import { useEngine } from "@/hooks/useEngine";
import { clearGame, saveGame, type SavedGame } from "@/lib/storage";

export type Orientation = "white" | "black";

export interface UseGameConfig {
  /** Starting game (a fresh one, or one restored from storage). */
  game: Game;
  mode: "local" | "ai";
  /** Human colour; "white" in local mode. */
  color: "white" | "black";
  level: 1 | 2 | 3;
}

export interface PendingPromotion {
  from: SquareName;
  to: SquareName;
}

export interface BoardMove {
  from: SquareName;
  to: SquareName;
  captured: boolean;
}

export interface UseGame {
  game: Game;
  mode: "local" | "ai";
  color: "white" | "black";
  level: 1 | 2 | 3;
  orientation: Orientation;
  /** Memoized per game: the Board resets its selection when this identity changes. */
  board: BoardState;
  /** Memoized per game, like `board`. */
  legalMoves: readonly BoardMove[];
  status: GameStatus;
  turn: Color;
  history: readonly GameMove[];
  /** True when the human may move now. */
  interactive: boolean;
  thinking: boolean;
  canUndo: boolean;
  pendingPromotion: PendingPromotion | null;
  /** Last engine failure (the game can still be continued, undone or retried). */
  engineError: string | null;
  move(from: SquareName, to: SquareName, promotion?: PromotionPiece): void;
  choosePromotion(piece: PromotionPiece): void;
  cancelPromotion(): void;
  undo(): void;
  flip(): void;
  /** Discards the saved game. The caller navigates away. */
  newGame(): void;
  retryEngine(): void;
}

function uciToInput(uci: string): MoveInput {
  return {
    from: uci.slice(0, 2) as SquareName,
    to: uci.slice(2, 4) as SquareName,
    ...(uci.length === 5 ? { promotion: uci[4] as PromotionPiece } : {}),
  };
}

/** Rebuilds a Game by replaying the saved UCI moves; null if they do not reproduce (illegal data). */
export function restoreGame(saved: SavedGame): Game | null {
  try {
    let game = createGame(saved.initialFen);
    for (const uci of saved.moves) game = play(game, uciToInput(uci));
    return game;
  } catch {
    return null;
  }
}

export function useGame(config: UseGameConfig): UseGame {
  const { mode, color, level } = config;
  const engine = useEngine();
  const engineRef = useRef(engine);
  useEffect(() => {
    engineRef.current = engine;
  });

  const [game, setGame] = useState<Game>(config.game);
  const [orientation, setOrientation] = useState<Orientation>(color);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const discardedRef = useRef(false);
  const searchingRef = useRef(false);

  const human: Color = color === "white" ? "w" : "b";
  const status = useMemo(() => getStatus(game), [game]);
  const turn = useMemo(() => getTurn(game), [game]);
  const board = useMemo(() => getBoard(game), [game]);
  const history = useMemo(() => getHistory(game), [game]);
  const legalMoves = useMemo<readonly BoardMove[]>(
    () => getLegalMoves(game).map((m) => ({ from: m.from, to: m.to, captured: m.captured })),
    [game],
  );

  const playing = status.kind === "playing";
  const interactive = playing && (mode === "local" || turn === human);
  const canUndo = mode === "local" ? history.length > 0 : history.some((m) => m.color === human);

  // Persist every change (docs/SPEC.md §6.5).
  useEffect(() => {
    if (discardedRef.current) return;
    saveGame({
      v: 1,
      mode,
      color,
      level,
      initialFen: game.initialFen,
      moves: [...game.uciMoves],
    });
  }, [game, mode, color, level]);

  // The AI plays whenever it is its turn, including after undo, new game or reload.
  useEffect(() => {
    if (mode !== "ai" || !playing || turn === human) return;
    let ignored = false;
    searchingRef.current = true;
    engineRef.current
      .requestMove({ initialFen: game.initialFen, moves: game.uciMoves, level })
      .then((uci) => {
        if (ignored) return;
        searchingRef.current = false;
        if (uci === null) return;
        try {
          setGame(play(game, uciToInput(uci)));
        } catch {
          setEngineError("A IA devolveu um lance inválido.");
        }
      })
      .catch((error: unknown) => {
        if (ignored) return;
        searchingRef.current = false;
        setEngineError(error instanceof Error ? error.message : "Falha no motor da IA.");
      });
    return () => {
      ignored = true;
    };
  }, [game, mode, playing, turn, human, level, retry]);

  const applyMove = useCallback((input: MoveInput) => {
    try {
      setGame((current) => play(current, input));
    } catch {
      // illegal or game over: ignore
    }
  }, []);

  const move = useCallback(
    (from: SquareName, to: SquareName, promotion?: PromotionPiece) => {
      if (!interactive || pendingPromotion !== null) return;
      const candidates = getLegalMovesFrom(game, from).filter((m) => m.to === to);
      if (candidates.length === 0) return;
      if (promotion === undefined && candidates.some((m) => m.promotion !== undefined)) {
        setPendingPromotion({ from, to });
        return;
      }
      applyMove({ from, to, ...(promotion ? { promotion } : {}) });
    },
    [interactive, pendingPromotion, game, applyMove],
  );

  const choosePromotion = useCallback(
    (piece: PromotionPiece) => {
      if (pendingPromotion === null) return;
      const { from, to } = pendingPromotion;
      setPendingPromotion(null);
      applyMove({ from, to, promotion: piece });
    },
    [pendingPromotion, applyMove],
  );

  const cancelPromotion = useCallback(() => setPendingPromotion(null), []);

  const undo = useCallback(() => {
    if (!canUndo) return;
    if (searchingRef.current) {
      searchingRef.current = false;
      engineRef.current.cancel();
    }
    setPendingPromotion(null);
    setEngineError(null);
    setGame((current) => {
      if (mode === "local") return undoGame(current);
      // Against the AI: undo up to and including the human's last move.
      const moves = getHistory(current);
      let next = current;
      for (let i = moves.length - 1; i >= 0; i--) {
        next = undoGame(next);
        if (moves[i].color === human) break;
      }
      return next;
    });
  }, [canUndo, mode, human]);

  const flip = useCallback(() => setOrientation((o) => (o === "white" ? "black" : "white")), []);

  const newGame = useCallback(() => {
    discardedRef.current = true;
    clearGame();
  }, []);

  const retryEngine = useCallback(() => {
    setEngineError(null);
    setRetry((n) => n + 1);
  }, []);

  return {
    game,
    mode,
    color,
    level,
    orientation,
    board,
    legalMoves,
    status,
    turn,
    history,
    interactive,
    thinking: engine.thinking,
    canUndo,
    pendingPromotion,
    engineError,
    move,
    choosePromotion,
    cancelPromotion,
    undo,
    flip,
    newGame,
    retryEngine,
  };
}
