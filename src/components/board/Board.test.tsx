import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoardState, Color, Piece, PieceType, SquareName } from "@/engine";
import { Board, type BoardProps } from "./Board";

const BACK_RANK: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];

function initialBoard(): BoardState {
  const b: (Piece | null)[] = Array(64).fill(null);
  const place = (i: number, color: Color, type: PieceType) => {
    b[i] = { color, type };
  };
  BACK_RANK.forEach((t, f) => {
    place(f, "w", t);
    place(8 + f, "w", "p");
    place(48 + f, "b", "p");
    place(56 + f, "b", t);
  });
  return b;
}

const E2_MOVES: BoardProps["legalMoves"] = [
  { from: "e2", to: "e3", captured: false },
  { from: "e2", to: "e4", captured: false },
  { from: "g1", to: "f3", captured: false },
];

function setup(props: Partial<BoardProps> = {}) {
  const onMove = vi.fn();
  const base: BoardProps = {
    board: initialBoard(),
    orientation: "white",
    legalMoves: E2_MOVES,
    interactive: true,
    onMove,
  };
  const all = { ...base, ...props };
  const utils = render(<Board {...all} />);
  return { onMove, ...utils, props: all };
}

const sq = (name: string) => document.querySelector<HTMLElement>(`[data-square="${name}"]`)!;

describe("Board rendering", () => {
  it.each(["white", "black"] as const)("renders the 32 starting pieces (%s)", (orientation) => {
    setup({ orientation });
    expect(document.querySelectorAll("[data-piece]")).toHaveLength(32);
    expect(sq("e1").querySelector("[data-piece]")).toHaveAttribute("data-piece", "wK");
    expect(sq("d8").querySelector("[data-piece]")).toHaveAttribute("data-piece", "bQ");
    expect(sq("b1").querySelector("img")).toHaveAttribute("src", "/pieces/wN.svg");
    expect(sq("e4").querySelector("[data-piece]")).toBeNull();
  });

  it("labels squares in Portuguese", () => {
    setup();
    expect(screen.getByLabelText("b1, cavalo branco")).toBeInTheDocument();
    expect(screen.getByLabelText("e5, vazia")).toBeInTheDocument();
    expect(screen.getByLabelText("d8, dama preta")).toBeInTheDocument();
    expect(screen.getByLabelText("a1, torre branca")).toBeInTheDocument();
  });

  it("puts a1 bottom-left for white and top-right for black", () => {
    const { rerender, props } = setup();
    let squares = [...document.querySelectorAll("[data-square]")];
    expect(squares[0]).toHaveAttribute("data-square", "a8");
    expect(squares[56]).toHaveAttribute("data-square", "a1");
    rerender(<Board {...props} orientation="black" />);
    squares = [...document.querySelectorAll("[data-square]")];
    expect(squares[0]).toHaveAttribute("data-square", "h1");
    expect(squares[7]).toHaveAttribute("data-square", "a1");
    expect(squares[63]).toHaveAttribute("data-square", "a8");
  });

  it("inverts the edge coordinates with black orientation", () => {
    const { rerender, props } = setup();
    const coords = (kind: string) =>
      [...document.querySelectorAll(`[data-coord="${kind}"]`)].map((e) => e.textContent);
    expect(coords("file")).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(coords("rank")).toEqual(["8", "7", "6", "5", "4", "3", "2", "1"]);
    rerender(<Board {...props} orientation="black" />);
    expect(coords("file")).toEqual(["h", "g", "f", "e", "d", "c", "b", "a"]);
    expect(coords("rank")).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("applies last move and check highlights", () => {
    setup({ lastMove: { from: "e2", to: "e4" }, checkSquare: "e1" });
    expect(sq("e2")).toHaveAttribute("data-last-move");
    expect(sq("e4")).toHaveAttribute("data-last-move");
    expect(sq("d4")).not.toHaveAttribute("data-last-move");
    expect(sq("e1")).toHaveAttribute("data-check");
    expect(sq("d1")).not.toHaveAttribute("data-check");
  });
});

describe("Board click-click", () => {
  it("moves e2 to e4", () => {
    const { onMove } = setup();
    fireEvent.click(sq("e2"));
    expect(sq("e2")).toHaveAttribute("data-selected");
    fireEvent.click(sq("e4"));
    expect(onMove).toHaveBeenCalledExactlyOnceWith("e2", "e4");
    expect(sq("e2")).not.toHaveAttribute("data-selected");
  });

  it("does not call onMove for a non legal target", () => {
    const { onMove } = setup();
    fireEvent.click(sq("e2"));
    fireEvent.click(sq("e5"));
    expect(onMove).not.toHaveBeenCalled();
    expect(sq("e2")).not.toHaveAttribute("data-selected");
  });

  it("shows move dots on empty targets and rings on captures", () => {
    const board = [...initialBoard()];
    board[28] = { color: "b", type: "p" }; // e4 black pawn
    setup({
      board,
      legalMoves: [
        { from: "e2", to: "e3", captured: false },
        { from: "d2", to: "e4", captured: true },
      ],
    });
    fireEvent.click(sq("e2"));
    expect(sq("e3")).toHaveAttribute("data-legal", "move");
    expect(sq("e3").querySelector('[data-marker="move"]')).not.toBeNull();
    expect(sq("e4")).not.toHaveAttribute("data-legal");
    fireEvent.click(sq("d2"));
    expect(sq("e4")).toHaveAttribute("data-legal", "capture");
    expect(sq("e4").querySelector('[data-marker="capture"]')).not.toBeNull();
    expect(sq("e3")).not.toHaveAttribute("data-legal");
    expect(sq("e2")).not.toHaveAttribute("data-selected");
    expect(sq("d2")).toHaveAttribute("data-selected");
  });

  it("switches selection to another own piece and cancels on empty click", () => {
    const { onMove } = setup();
    fireEvent.click(sq("e2"));
    fireEvent.click(sq("g1"));
    expect(sq("g1")).toHaveAttribute("data-selected");
    expect(sq("e2")).not.toHaveAttribute("data-selected");
    expect(sq("f3")).toHaveAttribute("data-legal", "move");
    fireEvent.click(sq("a5"));
    expect(document.querySelector("[data-selected]")).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });

  it("ignores pieces without legal moves", () => {
    setup();
    fireEvent.click(sq("a1"));
    expect(document.querySelector("[data-selected]")).toBeNull();
  });

  it("clears the selection when the board changes", () => {
    const { rerender, props } = setup();
    fireEvent.click(sq("e2"));
    expect(sq("e2")).toHaveAttribute("data-selected");
    rerender(<Board {...props} board={[...props.board]} />);
    expect(document.querySelector("[data-selected]")).toBeNull();
    expect(document.querySelector("[data-legal]")).toBeNull();
  });

  it("works with empty legalMoves", () => {
    const { onMove } = setup({ legalMoves: [] });
    fireEvent.click(sq("e2"));
    fireEvent.click(sq("e4"));
    expect(onMove).not.toHaveBeenCalled();
    expect(document.querySelector("[data-selected]")).toBeNull();
  });

  it("does nothing when interactive is false", () => {
    const { onMove } = setup({ interactive: false });
    fireEvent.click(sq("e2"));
    expect(document.querySelector("[data-selected]")).toBeNull();
    fireEvent.click(sq("e4"));
    fireEvent.pointerDown(sq("e2"), { pointerId: 1 });
    fireEvent.pointerUp(sq("e4"), { pointerId: 1 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("drops interaction when interactive turns false mid-selection", () => {
    const { rerender, props } = setup();
    fireEvent.click(sq("e2"));
    rerender(<Board {...props} interactive={false} />);
    expect(document.querySelector("[data-selected]")).toBeNull();
    expect(document.querySelector("[data-legal]")).toBeNull();
  });
});

describe("Board drag and drop", () => {
  const drag = (from: SquareName, to: SquareName) => {
    fireEvent.pointerDown(sq(from), { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(sq(to), { pointerId: 1, clientX: 20, clientY: 5 });
    fireEvent.pointerUp(sq(to), { pointerId: 1, clientX: 20, clientY: 5, button: 0 });
  };

  it("calls onMove when dropping on a legal target", () => {
    const { onMove } = setup();
    drag("e2", "e4");
    expect(onMove).toHaveBeenCalledExactlyOnceWith("e2", "e4");
  });

  it("highlights destinations and offsets the piece while dragging", () => {
    setup();
    fireEvent.pointerDown(sq("e2"), { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    expect(sq("e4")).toHaveAttribute("data-legal", "move");
    fireEvent.pointerMove(sq("e3"), { pointerId: 1, clientX: 15, clientY: 4 });
    expect(sq("e2").querySelector("img")).toHaveStyle({ transform: "translate(5px, -6px)" });
    fireEvent.pointerUp(sq("e2"), { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    expect(document.querySelector("[data-legal]")).toBeNull();
    expect(sq("e2").querySelector("img")?.getAttribute("style") ?? "").not.toContain("translate");
  });

  it("returns the piece on an illegal drop", () => {
    const { onMove } = setup();
    drag("e2", "e5");
    expect(onMove).not.toHaveBeenCalled();
    expect(sq("e2").querySelector("[data-piece]")).toHaveAttribute("data-piece", "wP");
  });

  it("ends the drag when released outside the board and ignores later clicks", () => {
    const { onMove } = setup();
    fireEvent.pointerDown(sq("e2"), { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(document.body, { pointerId: 1, clientX: -300, clientY: -300 });
    fireEvent.pointerUp(document.body, { pointerId: 1, clientX: -300, clientY: -300, button: 0 });
    expect(document.querySelector("[data-legal]")).toBeNull();
    expect(sq("e2").querySelector("img")?.getAttribute("style") ?? "").not.toContain("translate");
    fireEvent.pointerUp(sq("e4"), { pointerId: 1, clientX: 20, clientY: 5, button: 0 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("ends the drag on pointercancel outside the board", () => {
    setup();
    fireEvent.pointerDown(sq("e2"), { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerCancel(document.body, { pointerId: 1 });
    expect(document.querySelector("[data-legal]")).toBeNull();
  });

  it("does nothing when dropping on the origin square", () => {
    const { onMove } = setup();
    drag("e2", "e2");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("does not start a drag for a piece without moves", () => {
    const { onMove } = setup();
    drag("a1", "a3");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("does not drag when interactive is false", () => {
    const { onMove } = setup({ interactive: false });
    drag("e2", "e4");
    expect(onMove).not.toHaveBeenCalled();
  });
});
