"use client";

import { useRouter } from "next/navigation";
import type { BoardState, Color, Game, SquareName } from "@/engine";
import { Board } from "@/components/board";
import { GameControls } from "@/components/panel/GameControls";
import { GameStatusBar } from "@/components/panel/GameStatusBar";
import { MoveList } from "@/components/panel/MoveList";
import { PromotionDialog } from "@/components/promotion/PromotionDialog";
import { useGame } from "@/hooks/useGame";
import type { SavedGame } from "@/lib/storage";

function kingSquare(board: BoardState, color: Color): SquareName | undefined {
  const index = board.findIndex((p) => p?.type === "k" && p.color === color);
  if (index < 0) return undefined;
  return `${"abcdefgh"[index % 8]}${Math.floor(index / 8) + 1}` as SquareName;
}

export function PlayView({ saved, game: initialGame }: { saved: SavedGame; game: Game }) {
  const router = useRouter();
  const g = useGame({ game: initialGame, mode: saved.mode, color: saved.color, level: saved.level });

  const lastMove = g.history.length > 0 ? g.history[g.history.length - 1] : undefined;
  const checkSquare = g.status.inCheck ? kingSquare(g.board, g.turn) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:flex-row md:items-start">
      <div className="w-full max-w-xl md:flex-1">
        <Board
          board={g.board}
          orientation={g.orientation}
          legalMoves={g.legalMoves}
          lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : undefined}
          checkSquare={checkSquare}
          interactive={g.interactive}
          onMove={(from, to) => g.move(from, to)}
        />
      </div>
      <aside className="flex w-full flex-col gap-4 md:w-72">
        <GameStatusBar status={g.status} turn={g.turn} thinking={g.thinking} />
        {g.engineError !== null ? (
          <div role="alert" className="flex flex-col gap-2 rounded border border-red-500 p-2 text-sm">
            <p>Erro na IA: {g.engineError}</p>
            <button type="button" className="self-start rounded border px-3 py-1" onClick={g.retryEngine}>
              Tentar novamente
            </button>
          </div>
        ) : null}
        <MoveList
          moves={g.history.map((m) => m.san)}
          firstColor={g.history.length > 0 ? g.history[0].color : "w"}
        />
        <GameControls
          canUndo={g.canUndo}
          onUndo={g.undo}
          onFlip={g.flip}
          onNewGame={() => {
            g.newGame();
            router.push("/");
          }}
        />
      </aside>
      {g.pendingPromotion !== null ? (
        <PromotionDialog color={g.turn} onSelect={g.choosePromotion} onCancel={g.cancelPromotion} />
      ) : null}
    </main>
  );
}
