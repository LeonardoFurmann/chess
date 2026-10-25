import { expect, type Locator, type Page } from "@playwright/test";

/** Square button, matched by its coordinate (its aria-label is e.g. "e2, peão branco"). */
export function square(page: Page, name: string): Locator {
  return page.locator(`[data-square="${name}"]`);
}

export async function openGame(page: Page, query: string): Promise<void> {
  await page.goto(`/play?${query}`);
  await expect(page.getByRole("group", { name: "Tabuleiro de xadrez" })).toBeVisible();
  // The parameters are dropped once the game is persisted.
  await expect(page).toHaveURL(/\/play$/);
}

export async function clickMove(page: Page, from: string, to: string): Promise<void> {
  await square(page, from).click();
  await square(page, to).click();
}

export async function dragMove(page: Page, from: string, to: string): Promise<void> {
  const a = await square(page, from).boundingBox();
  const b = await square(page, to).boundingBox();
  if (!a || !b) throw new Error("square not visible");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

export function moveList(page: Page): Locator {
  return page.getByRole("region", { name: "Lista de lances" });
}

export function status(page: Page): Locator {
  return page.getByRole("status");
}
