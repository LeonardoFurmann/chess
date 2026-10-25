import { expect, test } from "@playwright/test";
import { clickMove, dragMove, moveList, openGame, square, status } from "./helpers";

test.describe("MVP end to end", () => {
  test("1. scholar's mate in local mode shows the result and locks the board", async ({ page }) => {
    await openGame(page, "mode=local");
    const moves: [string, string][] = [
      ["e2", "e4"],
      ["e7", "e5"],
      ["d1", "h5"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["g8", "f6"],
      ["h5", "f7"],
    ];
    for (const [from, to] of moves) await clickMove(page, from, to);

    await expect(status(page)).toContainText("Xeque-mate");
    await expect(status(page)).toContainText("brancas vencem");
    await expect(moveList(page)).toContainText("Qxf7#");
    await expect(square(page, "f7")).toHaveAccessibleName("f7, dama branca");

    // The board no longer accepts moves.
    await expect(square(page, "a7")).toHaveAttribute("aria-disabled", "true");
    await square(page, "a7").click({ force: true });
    await square(page, "a6").click({ force: true });
    await dragMove(page, "a7", "a6");
    await expect(square(page, "a7")).toHaveAccessibleName("a7, peão preto");
    await expect(square(page, "a6")).toHaveAccessibleName("a6, vazia");
  });

  test("2. moves by click-click and by drag and drop", async ({ page }) => {
    await openGame(page, "mode=local");
    await clickMove(page, "e2", "e4");
    await expect(square(page, "e4")).toHaveAccessibleName("e4, peão branco");
    await expect(square(page, "e2")).toHaveAccessibleName("e2, vazia");

    await dragMove(page, "e7", "e5");
    await expect(square(page, "e5")).toHaveAccessibleName("e5, peão preto");
    await expect(square(page, "e7")).toHaveAccessibleName("e7, vazia");
    await expect(moveList(page)).toContainText("1. e4 e5");
  });

  test("3. an illegal move does not change the position", async ({ page }) => {
    await openGame(page, "mode=local");
    await clickMove(page, "e2", "e5");
    await expect(square(page, "e2")).toHaveAccessibleName("e2, peão branco");
    await expect(square(page, "e5")).toHaveAccessibleName("e5, vazia");

    await dragMove(page, "e2", "e5");
    await expect(square(page, "e2")).toHaveAccessibleName("e2, peão branco");
    await expect(square(page, "e5")).toHaveAccessibleName("e5, vazia");

    await expect(status(page)).toHaveText("Vez das brancas");
    await expect(moveList(page).getByRole("listitem")).toHaveCount(0);
  });

  test("4. promotion to a knight from a FEN", async ({ page }) => {
    await openGame(page, `mode=local&fen=${encodeURIComponent("7k/P7/8/8/8/8/8/K7 w - - 0 1")}`);
    await clickMove(page, "a7", "a8");
    const dialog = page.getByRole("dialog", { name: "Escolha a peça de promoção" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cavalo" }).click();
    await expect(dialog).toBeHidden();
    await expect(square(page, "a8")).toHaveAccessibleName("a8, cavalo branco");
    await expect(square(page, "a7")).toHaveAccessibleName("a7, vazia");
    await expect(moveList(page)).toContainText("=N");
  });

  test("5a. undo in local mode goes back one move", async ({ page }) => {
    await openGame(page, "mode=local");
    await clickMove(page, "e2", "e4");
    await clickMove(page, "e7", "e5");
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(square(page, "e5")).toHaveAccessibleName("e5, vazia");
    await expect(square(page, "e7")).toHaveAccessibleName("e7, peão preto");
    await expect(square(page, "e4")).toHaveAccessibleName("e4, peão branco");
    await expect(status(page)).toHaveText("Vez das pretas");
  });

  test("5b. undo against the AI goes back to the player's move", async ({ page }) => {
    await openGame(page, "mode=ai&color=white&level=1");
    await clickMove(page, "e2", "e4");
    // Wait for the AI reply: both plies in the first row.
    await expect(moveList(page).getByRole("listitem").first()).toContainText(/1\. e4 \S+/);
    await expect(status(page)).toHaveText("Vez das brancas");
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(square(page, "e2")).toHaveAccessibleName("e2, peão branco");
    await expect(square(page, "e4")).toHaveAccessibleName("e4, vazia");
    await expect(moveList(page).getByRole("listitem")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Desfazer" })).toBeDisabled();
  });

  test("6. reload keeps the game", async ({ page }) => {
    await openGame(page, "mode=local");
    await clickMove(page, "e2", "e4");
    await clickMove(page, "e7", "e5");
    await expect(moveList(page)).toContainText("1. e4 e5");
    await page.reload();
    await expect(square(page, "e4")).toHaveAccessibleName("e4, peão branco");
    await expect(square(page, "e5")).toHaveAccessibleName("e5, peão preto");
    await expect(moveList(page)).toContainText("1. e4 e5");
    await expect(status(page)).toHaveText("Vez das brancas");
  });

  test("7. playing black against the AI: it moves first and shows thinking", async ({ page }) => {
    // Level 1 may answer in a few milliseconds, so record whether the indicator ever
    // appeared in the DOM instead of racing a visibility assertion against it.
    await page.addInitScript(() => {
      const w = window as unknown as { __seenThinking: boolean };
      w.__seenThinking = false;
      const check = () => {
        if (document.querySelector('[data-testid="thinking"]')) w.__seenThinking = true;
      };
      new MutationObserver(check).observe(document, { childList: true, subtree: true });
    });
    await openGame(page, "mode=ai&color=black&level=1");
    await expect(moveList(page).getByRole("listitem")).toHaveCount(1);
    await expect(moveList(page)).toContainText("1.");
    await expect(status(page)).toHaveText("Vez das pretas");
    await expect(page.getByTestId("thinking")).toBeHidden();
    await expect(page.getByTestId("board")).toHaveAttribute("data-orientation", "black");
    expect(await page.evaluate(() => (window as unknown as { __seenThinking: boolean }).__seenThinking)).toBe(true);
  });

  test("8. flipping the board reverses the coordinates", async ({ page }) => {
    await openGame(page, "mode=local");
    const board = page.getByTestId("board");
    const firstSquare = board.locator("[data-square]").first();
    await expect(board).toHaveAttribute("data-orientation", "white");
    await expect(firstSquare).toHaveAttribute("data-square", "a8");
    await expect(board.locator('[data-coord="file"]').first()).toHaveText("a");

    await page.getByRole("button", { name: "Virar tabuleiro" }).click();
    await expect(board).toHaveAttribute("data-orientation", "black");
    await expect(firstSquare).toHaveAttribute("data-square", "h1");
    await expect(board.locator('[data-coord="file"]').first()).toHaveText("h");
    await expect(board.locator('[data-coord="rank"]').first()).toHaveText("1");
  });

  test.describe("9. narrow viewport", () => {
    test.use({ viewport: { width: 375, height: 800 } });

    test("board fully visible without horizontal scroll", async ({ page }) => {
      await openGame(page, "mode=local");
      const box = await page.getByTestId("board").boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(square(page, "a1")).toBeInViewport();
      await expect(square(page, "h8")).toBeInViewport();
    });
  });
});
