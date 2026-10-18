import type { Color, DrawReason, GameStatus } from "@/engine";

const COLOR_PLURAL: Record<Color, string> = { w: "brancas", b: "pretas" };

const DRAW_TEXT: Record<DrawReason, string> = {
  "fifty-move": "Empate pela regra dos 50 lances",
  threefold: "Empate por tripla repetição",
  "insufficient-material": "Empate por material insuficiente",
};

/** Portuguese text for the game status; `turn` is the side to move. */
export function describeStatus(status: GameStatus, turn: Color): string {
  switch (status.kind) {
    case "playing":
      return status.inCheck
        ? `Xeque! Vez das ${COLOR_PLURAL[turn]}`
        : `Vez das ${COLOR_PLURAL[turn]}`;
    case "checkmate":
      return `Xeque-mate — ${COLOR_PLURAL[status.winner]} vencem`;
    case "stalemate":
      return "Empate por afogamento";
    case "draw":
      return DRAW_TEXT[status.reason];
  }
}
