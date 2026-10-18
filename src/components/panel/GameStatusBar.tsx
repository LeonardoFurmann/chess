import type { Color, GameStatus } from "@/engine";
import { describeStatus } from "@/components/panel/describe-status";

export function GameStatusBar({
  status,
  turn,
  thinking,
}: {
  status: GameStatus;
  turn: Color;
  thinking: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p role="status" aria-live="polite" className="text-lg font-semibold">
        {describeStatus(status, turn)}
      </p>
      {thinking && status.kind === "playing" ? (
        <p className="text-sm opacity-70" data-testid="thinking">
          IA pensando…
        </p>
      ) : null}
    </div>
  );
}
