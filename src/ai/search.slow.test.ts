import { describe, expect, it } from "vitest";
// Helpers live outside src, so the alias cannot reach them.
/* eslint-disable @typescript-eslint/no-restricted-imports */
import { createRandomPlayer, createRng, playGame } from "../../test/helpers/play-game";
import type { GameResult, Player } from "../../test/helpers/play-game";
/* eslint-enable @typescript-eslint/no-restricted-imports */
import { search } from "./search";

function createSearchPlayer(maxDepth: number): Player {
  return (position) => search(position, { maxDepth }).move;
}

/** The AI plays white in even games and black in odd ones against a seeded random player. */
function playAgainstRandom(
  game: number,
  maxDepth: number,
): { result: GameResult; aiIsWhite: boolean } {
  const ai = createSearchPlayer(maxDepth);
  const random = createRandomPlayer(createRng(1000 + game));
  const aiIsWhite = game % 2 === 0;
  const result = playGame({
    white: aiIsWhite ? ai : random,
    black: aiIsWhite ? random : ai,
  });
  return { result, aiIsWhite };
}

describe("search against a random player", () => {
  it("never plays an illegal move in 100 games at depth 2", () => {
    for (let game = 0; game < 100; game++) {
      const { result } = playAgainstRandom(game, 2);
      expect(result.illegalMoves, `game ${game}`).toEqual([]);
    }
  }, 600_000);

  it("wins at least 90% of 20 games at depth 3 and never loses", () => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    const start = performance.now();
    for (let game = 0; game < 20; game++) {
      const { result, aiIsWhite } = playAgainstRandom(game, 3);
      expect(result.illegalMoves, `game ${game}`).toEqual([]);
      if (result.outcome === "draw") draws++;
      else if ((result.outcome === "white") === aiIsWhite) wins++;
      else losses++;
    }
    const seconds = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`strength: ${wins} wins, ${draws} draws, ${losses} losses in ${seconds} s`);
    expect(losses).toBe(0);
    expect(wins).toBeGreaterThanOrEqual(18);
  }, 600_000);
});
