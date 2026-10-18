import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Board } from "@/components/board";
import type { BoardProps } from "@/components/board";
import type { BoardState, Piece, PieceType, SquareName } from "@/engine";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

function idx(name: SquareName): number {
  return FILES.indexOf(name[0] as (typeof FILES)[number]) + (Number(name[1]) - 1) * 8;
}

function initialBoard(): (Piece | null)[] {
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const b: (Piece | null)[] = Array(64).fill(null);
  for (let f = 0; f < 8; f++) {
    b[f] = { color: "w", type: back[f]! };
    b[8 + f] = { color: "w", type: "p" };
    b[48 + f] = { color: "b", type: "p" };
    b[56 + f] = { color: "b", type: back[f]! };
  }
  return b;
}

type Legal = BoardProps["legalMoves"];

const e2Moves: Legal = [
  { from: "e2", to: "e3", captured: false },
  { from: "e2", to: "e4", captured: false },
  { from: "g1", to: "f3", captured: false },
];

function setup(over: Partial<BoardProps> = {}) {
  const onMove = vi.fn();
  const props: BoardProps = {
    board: initialBoard() as BoardState,
    orientation: "white",
    legalMoves: e2Moves,
    interactive: true,
    onMove,
    ...over,
  };
  const utils = render(<Board {...props} />);
  return { onMove, props, ...utils };
}

const square = (name: string) => screen.getByLabelText(new RegExp(`^${name},`));
const click = (name: string) => fireEvent.click(square(name));

let target: Element | null = null;

function drag(from: string, to: string) {
  const src = square(from);
  const dst = square(to);
  target = dst;
  fireEvent.pointerDown(src, { pointerId: 1, clientX: 10, clientY: 10, button: 0, buttons: 1 });
  fireEvent.pointerMove(dst, { pointerId: 1, clientX: 200, clientY: 200, buttons: 1 });
  fireEvent.pointerUp(dst, { pointerId: 1, clientX: 200, clientY: 200, button: 0 });
}

describe("Board adversarial", () => {
  beforeEach(() => {
    target = null;
    // jsdom has no layout; make hit-testing return whatever square we point at.
    (document as unknown as { elementFromPoint: unknown }).elementFromPoint = () => target;
  });
  afterEach(() => cleanup());

  it("renders 64 labelled squares and 32 occupied ones in both orientations", () => {
    for (const orientation of ["white", "black"] as const) {
      const { unmount } = setup({ orientation });
      const all = FILES.flatMap((f) =>
        [1, 2, 3, 4, 5, 6, 7, 8].map((r) => screen.getAllByLabelText(new RegExp(`^${f}${r},`))),
      );
      expect(all.every((l) => l.length === 1)).toBe(true);
      expect(square("e2").getAttribute("aria-label")).toBe("e2, peão branco");
      expect(square("b1").getAttribute("aria-label")).toBe("b1, cavalo branco");
      expect(square("e5").getAttribute("aria-label")).toBe("e5, vazia");
      const occupied = all.filter((l) => !/vazia/.test(l[0]!.getAttribute("aria-label")!));
      expect(occupied).toHaveLength(32);
      unmount();
    }
  });

  it("orders squares so a1 is top-right when black, bottom-left when white", () => {
    const before = (a: string, b: string) =>
      Boolean(square(a).compareDocumentPosition(square(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
    const w = setup({ orientation: "white" });
    expect(before("a8", "h8") && before("h8", "a1") && before("a1", "h1")).toBe(true);
    w.unmount();
    setup({ orientation: "black" });
    expect(before("h1", "a1") && before("a1", "h8") && before("h8", "a8")).toBe(true);
  });

  it("shows edge coordinates a-h and 1-8", () => {
    const { container } = setup();
    const text = container.textContent ?? "";
    for (const c of "abcdefgh12345678") expect(text).toContain(c);
  });

  it("click-click calls onMove exactly once with from/to", () => {
    const { onMove } = setup();
    click("e2");
    click("e4");
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith("e2", "e4");
  });

  it("does not call onMove for a non-legal destination", () => {
    const { onMove } = setup();
    click("e2");
    click("e5");
    click("d4");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("selecting a piece without legal moves and clicking elsewhere never moves", () => {
    const { onMove } = setup();
    click("a1");
    click("e4");
    click("a2");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("selecting a piece without moves never reports it as a move origin", () => {
    const { onMove } = setup();
    click("e2");
    click("a1");
    click("e4");
    expect(onMove).not.toHaveBeenCalledWith("a1", "e4");
  });

  it("clicking another own piece with moves switches selection", () => {
    const { onMove } = setup();
    click("e2");
    click("g1");
    click("e4");
    expect(onMove).not.toHaveBeenCalled();
    click("g1");
    click("f3");
    expect(onMove).toHaveBeenCalledWith("g1", "f3");
  });

  it("clicking outside (empty non-legal square) cancels selection", () => {
    const { onMove } = setup();
    click("e2");
    click("d5");
    click("e4");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("clicking the selected piece again does not move", () => {
    const { onMove } = setup();
    click("e2");
    click("e2");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("empty legalMoves: nothing can be moved", () => {
    const { onMove } = setup({ legalMoves: [] });
    click("e2");
    click("e4");
    click("g1");
    click("f3");
    drag("e2", "e4");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("interactive=false blocks click-click, even for legal pairs", () => {
    const { onMove } = setup({ interactive: false });
    click("e2");
    click("e4");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("interactive=false blocks drag", () => {
    const { onMove } = setup({ interactive: false });
    drag("e2", "e4");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("turning interactive off with a selection prevents completing the move", () => {
    const { onMove, rerender, props } = setup();
    click("e2");
    rerender(<Board {...props} interactive={false} />);
    click("e4");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("changing board while a piece is selected clears the selection", () => {
    const { onMove, rerender, props } = setup();
    click("e2");
    const b = [...(props.board as (Piece | null)[])];
    b[idx("a2")] = null;
    b[idx("a3")] = { color: "w", type: "p" };
    rerender(<Board {...props} board={b} />);
    click("e4");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("does not call onMove when legalMoves becomes empty after selecting", () => {
    const { onMove, rerender, props } = setup();
    click("e2");
    rerender(<Board {...props} legalMoves={[]} />);
    click("e4");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("captures are selectable destinations", () => {
    const board = initialBoard();
    board[idx("e4")] = { color: "w", type: "p" };
    board[idx("e2")] = null;
    board[idx("d5")] = { color: "b", type: "p" };
    board[idx("d7")] = null;
    const { onMove } = setup({
      board,
      legalMoves: [
        { from: "e4", to: "d5", captured: true },
        { from: "e4", to: "e5", captured: false },
      ],
    });
    click("e4");
    click("d5");
    expect(onMove).toHaveBeenCalledWith("e4", "d5");
  });

  it("works for black orientation with the same square names", () => {
    const { onMove } = setup({ orientation: "black" });
    click("e2");
    click("e4");
    expect(onMove).toHaveBeenCalledWith("e2", "e4");
  });

  it("does not crash with lastMove, checkSquare and selection on the same square", () => {
    setup({ lastMove: { from: "e2", to: "e4" }, checkSquare: "e4" });
    click("e2");
    expect(square("e4")).toBeTruthy();
  });

  it("drag to a legal destination calls onMove", () => {
    const { onMove } = setup();
    drag("e2", "e4");
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith("e2", "e4");
  });

  it("drag to an illegal destination does not call onMove", () => {
    const { onMove } = setup();
    drag("e2", "e5");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("dropping the piece on its own square does not call onMove", () => {
    const { onMove } = setup();
    drag("e2", "e2");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("dragging a piece without moves never calls onMove", () => {
    const { onMove } = setup();
    drag("a1", "a3");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("dragging from an empty square never calls onMove", () => {
    const { onMove } = setup();
    drag("e5", "e4");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("after a failed drag the board still shows the piece on its origin", () => {
    setup();
    drag("e2", "e5");
    expect(square("e2").getAttribute("aria-label")).toBe("e2, peão branco");
    expect(square("e5").getAttribute("aria-label")).toBe("e5, vazia");
  });

  it("drag released outside the board does not call onMove", () => {
    const { onMove } = setup();
    fireEvent.pointerDown(square("e2"), { pointerId: 1, clientX: 10, clientY: 10, button: 0, buttons: 1 });
    fireEvent.pointerUp(document.body, { pointerId: 1, clientX: -500, clientY: -500, button: 0 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("pointercancel aborts a drag without calling onMove", () => {
    const { onMove } = setup();
    target = square("e4");
    fireEvent.pointerDown(square("e2"), { pointerId: 1, clientX: 10, clientY: 10, button: 0, buttons: 1 });
    fireEvent.pointerCancel(square("e2"), { pointerId: 1 });
    fireEvent.pointerUp(square("e4"), { pointerId: 1, clientX: 200, clientY: 200, button: 0 });
    expect(onMove).not.toHaveBeenCalled();
  });
});
