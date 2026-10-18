"use client";

import { useEffect, useRef } from "react";

export function MoveList({ moves }: { moves: readonly string[] }) {
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    // scrollIntoView is missing in some environments (e.g. jsdom).
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [moves.length]);

  const rows: { number: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ number: i / 2 + 1, white: moves[i], black: moves[i + 1] });
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
            <span>{row.number}.</span> <span>{row.white}</span>
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
