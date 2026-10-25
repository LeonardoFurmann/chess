import { expect, test, type Page } from "@playwright/test";

const sq = (page: Page, name: string) => page.locator(`button[aria-label^="${name},"]`);
const moveItems = (page: Page) => page.getByRole("region", { name: "Lista de lances" }).locator("li");

const PROMO_FEN = "8/P6k/8/8/8/8/8/K7 w - - 0 1";
const STALEMATE_FEN = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";

async function startLocal(page: Page, fen?: string) {
  const q = fen ? `&fen=${encodeURIComponent(fen)}` : "";
  await page.goto(`/play?mode=local${q}`);
  await expect(page.getByRole("group", { name: "Tabuleiro de xadrez" })).toBeVisible();
}

test("dropping a piece outside the board changes nothing", async ({ page }) => {
  await startLocal(page);
  const box = (await sq(page, "e2").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(2, 2, { steps: 5 });
  await page.mouse.up();
  await expect(sq(page, "e2")).toHaveAttribute("aria-label", "e2, peão branco");
  await expect(sq(page, "e4")).toHaveAttribute("aria-label", "e4, vazia");
  await expect(moveItems(page)).toHaveCount(0);
  // still white's turn: a legal move works afterwards
  await sq(page, "e2").click();
  await sq(page, "e4").click();
  await expect(sq(page, "e4")).toHaveAttribute("aria-label", "e4, peão branco");
});

test("clicking an opponent piece without selection selects nothing", async ({ page }) => {
  await startLocal(page);
  await sq(page, "e7").click();
  await expect(page.locator("[data-selected]")).toHaveCount(0);
  await expect(page.locator("[data-legal]")).toHaveCount(0);
  await expect(sq(page, "e7")).toHaveAttribute("aria-label", "e7, peão preto");
  await expect(moveItems(page)).toHaveCount(0);
});

test("cancelling the promotion changes nothing", async ({ page }) => {
  await startLocal(page, PROMO_FEN);
  await sq(page, "a7").click();
  await sq(page, "a8").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Dama" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Torre" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Bispo" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cavalo" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  await expect(sq(page, "a7")).toHaveAttribute("aria-label", "a7, peão branco");
  await expect(sq(page, "a8")).toHaveAttribute("aria-label", "a8, vazia");
  await expect(page.locator("[data-selected]")).toHaveCount(0);
  await expect(moveItems(page)).toHaveCount(0);
});

test("undo as black against the AI right at the start keeps the AI opening move", async ({ page }) => {
  await page.goto("/play?mode=ai&color=black&level=1");
  await expect(moveItems(page)).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText("IA pensando")).toBeHidden();
  const undo = page.getByRole("button", { name: "Desfazer" });
  if (await undo.isEnabled()) await undo.click();
  // the player has made no move, so nothing of theirs can be undone
  await expect(moveItems(page)).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText("IA pensando")).toBeHidden();
});

test("reloading during the AI turn resumes and the AI plays", async ({ page }) => {
  await page.goto("/play?mode=ai&color=black&level=1");
  await expect(page.getByRole("group", { name: "Tabuleiro de xadrez" })).toBeVisible();
  await page.reload();
  await expect(moveItems(page)).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText("IA pensando")).toBeHidden();
  await expect(sq(page, "e7")).toHaveAttribute("aria-label", "e7, peão preto");
});

test("Nova partida goes to / and Continuar partida disappears", async ({ page }) => {
  await startLocal(page);
  await sq(page, "e2").click();
  await sq(page, "e4").click();
  await expect(moveItems(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Nova partida" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Jogar local" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar partida" })).toHaveCount(0);
});

test("Continuar partida is offered after leaving a game in progress", async ({ page }) => {
  await startLocal(page);
  await sq(page, "d2").click();
  await sq(page, "d4").click();
  await expect(moveItems(page)).toHaveCount(1);
  await page.goto("/");
  await page.getByRole("button", { name: "Continuar partida" }).click();
  await expect(page).toHaveURL(/\/play/);
  await expect(sq(page, "d4")).toHaveAttribute("aria-label", "d4, peão branco");
});

test("invalid ?fen= shows an error with a link to /", async ({ page }) => {
  await page.goto("/play?mode=local&fen=not-a-fen");
  await expect(page.getByText("A posição (FEN) informada é inválida.")).toBeVisible();
  const link = page.getByRole("link", { name: /Voltar ao início/ });
  await expect(link).toHaveAttribute("href", "/");
  await link.click();
  await expect(page).toHaveURL(/\/$/);
});

test("/play without a saved game redirects to /", async ({ page }) => {
  await page.goto("/play");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Jogar local" })).toBeVisible();
});

test("stalemate from ?fen= is shown in Portuguese and locks the board", async ({ page }) => {
  await startLocal(page, STALEMATE_FEN);
  await expect(page.getByRole("status")).toContainText("Empate por afogamento");
  await sq(page, "h8").click({ force: true });
  await expect(page.locator("[data-legal]")).toHaveCount(0);
});
