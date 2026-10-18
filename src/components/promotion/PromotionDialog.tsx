"use client";

import { useEffect, useRef } from "react";
import type { Color, PromotionPiece } from "@/engine";

const PIECES: { type: PromotionPiece; letter: string; label: string }[] = [
  { type: "q", letter: "Q", label: "Dama" },
  { type: "r", letter: "R", label: "Torre" },
  { type: "b", letter: "B", label: "Bispo" },
  { type: "n", letter: "N", label: "Cavalo" },
];

export function PromotionDialog({
  color,
  onSelect,
  onCancel,
}: {
  color: Color;
  onSelect(p: PromotionPiece): void;
  onCancel(): void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    const buttons = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("button") ?? [],
    );
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    } else if (!dialogRef.current?.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Escolha a peça de promoção"
        onKeyDown={onKeyDown}
        className="rounded bg-white p-4 text-black"
      >
        <p className="mb-2 font-semibold">Promover peão a:</p>
        <div className="flex gap-2">
          {PIECES.map((p) => (
            <button
              key={p.type}
              type="button"
              aria-label={p.label}
              onClick={() => onSelect(p.type)}
              className="rounded border p-1 hover:bg-gray-200 focus:outline focus:outline-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/pieces/${color}${p.letter}.svg`}
                alt=""
                width={56}
                height={56}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 text-sm underline"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
