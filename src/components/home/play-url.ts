export type ColorChoice = "white" | "black" | "random";
export type Level = 1 | 2 | 3;

export const LOCAL_URL = "/play?mode=local";

/** Builds the AI game URL. A random colour is resolved here, never put in the URL. */
export function aiUrl(color: ColorChoice, level: Level, rand: () => number = Math.random): string {
  const resolved = color === "random" ? (rand() < 0.5 ? "white" : "black") : color;
  return `/play?mode=ai&color=${resolved}&level=${level}`;
}
