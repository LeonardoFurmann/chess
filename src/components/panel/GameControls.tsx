export function GameControls({
  canUndo,
  onUndo,
  onNewGame,
  onFlip,
}: {
  canUndo: boolean;
  onUndo(): void;
  onNewGame(): void;
  onFlip(): void;
}) {
  const cls =
    "rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={cls}
        disabled={!canUndo}
        onClick={onUndo}
      >
        Desfazer
      </button>
      <button type="button" className={cls} onClick={onNewGame}>
        Nova partida
      </button>
      <button type="button" className={cls} onClick={onFlip}>
        Virar tabuleiro
      </button>
    </div>
  );
}
