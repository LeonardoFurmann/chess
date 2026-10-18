"use client";

import { useEffect, useRef } from "react";
import type { Color } from "@/engine";

export function MoveList({
  moves,
  firstColor = "w",
}: {
  moves: readonly string[];
  firstColor?: Color;
}) {
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    // scrollIntoView is missing in some environments (e.g. jsdom).
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [moves.length]);

  // When Black moves first (FEN start), the first row has no White move.
  const offset = firstColor === "b" ? 1 : 0;
  const rows: { number: number; white?: string; black?: string }[] = [];
  for (let ply = 0; ply < moves.length + offset; ply += 2) {
    rows.push({
      number: ply / 2 + 1,
      white: ply - offset >= 0 ? moves[ply - offset] : undefined,
      black: moves[ply + 1 - offset],
    });
  }

  return (
    <div
      className="max-h-64 overflow-y-auto"
      aria-label="Lista de lances"
      role="region"
    >
      <ol className="font-mono text-sm">
        {rows.map((row, idx) => (
          <li
            key={row.number}
            ref={idx === rows.length - 1 ? endRef : undefined}
          >
            {row.white !== undefined ? (
              <>
                <span>{row.number}.</span> <span>{row.white}</span>
              </>
            ) : (
              <span>{row.number}...</span>
            )}
            {row.black !== undefined ? (
              <>
                {" "}
                <span>{row.black}</span>
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
