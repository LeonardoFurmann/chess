"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BoardState, Piece, SquareName } from "@/engine";

export type BoardProps = {
  board: BoardState;
  orientation: "white" | "black";
  legalMoves: readonly { from: SquareName; to: SquareName; captured: boolean }[];
  lastMove?: { from: SquareName; to: SquareName };
  checkSquare?: SquareName;
  interactive: boolean;
  onMove: (from: SquareName, to: SquareName) => void;
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

const PIECE_NAMES: Record<Piece["type"], { name: string; feminine: boolean }> = {
  p: { name: "peão", feminine: false },
  n: { name: "cavalo", feminine: false },
  b: { name: "bispo", feminine: false },
  r: { name: "torre", feminine: true },
  q: { name: "dama", feminine: true },
  k: { name: "rei", feminine: false },
};

function squareName(index: number): SquareName {
  return `${FILES[index % 8]}${RANKS[Math.floor(index / 8)]}` as SquareName;
}

function describe(square: SquareName, piece: Piece | null): string {
  if (!piece) return `${square}, vazia`;
  const { name, feminine } = PIECE_NAMES[piece.type];
  const color = piece.color === "w" ? (feminine ? "branca" : "branco") : feminine ? "preta" : "preto";
  return `${square}, ${name} ${color}`;
}

function squareFromPoint(x: number, y: number, fallback: EventTarget | null): SquareName | null {
  let el: Element | null = null;
  if (typeof document.elementFromPoint === "function") el = document.elementFromPoint(x, y);
  let square = el?.closest<HTMLElement>("[data-square]");
  if (!square && fallback instanceof Element) square = fallback.closest<HTMLElement>("[data-square]");
  return (square?.dataset.square as SquareName | undefined) ?? null;
}

type Selection = { square: SquareName; board: BoardState; legalMoves: BoardProps["legalMoves"] };
type Drag = { from: SquareName; startX: number; startY: number; dx: number; dy: number };

export function Board({
  board,
  orientation,
  legalMoves,
  lastMove,
  checkSquare,
  interactive,
  onMove,
}: BoardProps) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  // A selection is only valid for the position and move list it was made on.
  const selected =
    interactive && selection && selection.board === board && selection.legalMoves === legalMoves
      ? selection.square
      : null;
  const activeFrom = interactive ? (drag?.from ?? selected) : null;

  const movesFrom = (from: SquareName) => legalMoves.filter((m) => m.from === from);
  const legalTargets = new Map<SquareName, boolean>();
  if (activeFrom) {
    for (const m of movesFrom(activeFrom)) legalTargets.set(m.to, m.captured);
  }

  const select = (square: SquareName | null) =>
    setSelection(square ? { square, board, legalMoves } : null);

  const handleClick = (square: SquareName, piece: Piece | null) => {
    if (!interactive) return;
    if (selected && legalTargets.has(square)) {
      select(null);
      onMove(selected, square);
      return;
    }
    if (piece && movesFrom(square).length > 0) {
      select(square === selected ? null : square);
      return;
    }
    select(null);
  };

  const endDrag = () => setDrag(null);

  const handlePointerDown = (e: ReactPointerEvent, square: SquareName, piece: Piece | null) => {
    if (!interactive || !piece || movesFrom(square).length === 0) return;
    if (e.button !== undefined && e.button > 0) return;
    const target = e.currentTarget as Element;
    if (typeof target.releasePointerCapture === "function") {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // No capture to release.
      }
    }
    const next = { from: square, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 };
    setDrag(next);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dx: e.clientX - drag.startX, dy: e.clientY - drag.startY });
  };

  const handlePointerUp = (e: PointerEvent) => {
    const current = drag;
    if (!current) return;
    endDrag();
    const to = squareFromPoint(e.clientX, e.clientY, e.target);
    if (!interactive || !to || to === current.from) return;
    if (movesFrom(current.from).some((m) => m.to === to)) {
      select(null);
      onMove(current.from, to);
    }
  };

  // While dragging, listen on the window so releasing or cancelling outside the
  // board still ends the drag. Handlers are read through a ref to stay current.
  const handlersRef = useRef({ handlePointerMove, handlePointerUp, endDrag });
  useEffect(() => {
    handlersRef.current = { handlePointerMove, handlePointerUp, endDrag };
  });
  const isDragging = drag !== null;
  useEffect(() => {
    if (!isDragging) return;
    const move = (e: PointerEvent) => handlersRef.current.handlePointerMove(e);
    const up = (e: PointerEvent) => handlersRef.current.handlePointerUp(e);
    const cancel = () => handlersRef.current.endDrag();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [isDragging]);

  const flipped = orientation === "black";
  const rows = flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div
      role="group"
      aria-label="Tabuleiro de xadrez"
      data-testid="board"
      data-orientation={orientation}
      className="mx-auto grid aspect-square w-full max-w-[40rem] touch-none select-none grid-cols-8 overflow-hidden rounded-sm border border-neutral-700"
    >
      {rows.map((r, rowIdx) =>
        cols.map((c, colIdx) => {
          const index = r * 8 + c;
          const square = squareName(index);
          const piece = board[index] ?? null;
          const isDark = (r + c) % 2 === 0;
          const legal = legalTargets.get(square);
          const isSelected = square === activeFrom;
          const isLast = !!lastMove && (lastMove.from === square || lastMove.to === square);
          const isCheck = checkSquare === square;
          const dragging = drag?.from === square;
          const bg = isCheck
            ? "bg-red-500"
            : isSelected
              ? "bg-yellow-300"
              : isLast
                ? isDark
                  ? "bg-lime-600"
                  : "bg-lime-300"
                : isDark
                  ? "bg-emerald-700"
                  : "bg-emerald-100";
          return (
            <button
              key={square}
              type="button"
              data-square={square}
              data-selected={isSelected || undefined}
              data-legal={legal === undefined ? undefined : legal ? "capture" : "move"}
              data-last-move={isLast || undefined}
              data-check={isCheck || undefined}
              aria-label={describe(square, piece)}
              aria-disabled={!interactive}
              tabIndex={-1}
              className={`relative flex aspect-square items-center justify-center p-0 ${bg} ${dragging ? "z-10" : ""}`}
              onClick={() => handleClick(square, piece)}
              onPointerDown={(e) => handlePointerDown(e, square, piece)}
            >
              {piece && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/pieces/${piece.color}${piece.type.toUpperCase()}.svg`}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  data-piece={`${piece.color}${piece.type.toUpperCase()}`}
                  className="pointer-events-none h-[90%] w-[90%]"
                  style={
                    dragging && drag
                      ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 20 }
                      : undefined
                  }
                />
              )}
              {legal === false && (
                <span
                  aria-hidden="true"
                  data-marker="move"
                  className="pointer-events-none absolute h-1/4 w-1/4 rounded-full bg-black/30"
                />
              )}
              {legal === true && (
                <span
                  aria-hidden="true"
                  data-marker="capture"
                  className="pointer-events-none absolute h-[90%] w-[90%] rounded-full border-4 border-black/30"
                />
              )}
              {colIdx === 0 && (
                <span
                  aria-hidden="true"
                  data-coord="rank"
                  className="pointer-events-none absolute left-0.5 top-0 text-[0.6rem] font-semibold text-neutral-800"
                >
                  {RANKS[r]}
                </span>
              )}
              {rowIdx === 7 && (
                <span
                  aria-hidden="true"
                  data-coord="file"
                  className="pointer-events-none absolute bottom-0 right-0.5 text-[0.6rem] font-semibold text-neutral-800"
                >
                  {FILES[c]}
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
