"use client";

import { useState } from "react";
import { aiUrl, LOCAL_URL, type ColorChoice, type Level } from "@/components/home/play-url";

const COLORS: { value: ColorChoice; label: string }[] = [
  { value: "white", label: "Brancas" },
  { value: "black", label: "Pretas" },
  { value: "random", label: "Aleatório" },
];

const LEVELS: { value: Level; label: string }[] = [
  { value: 1, label: "Fácil" },
  { value: 2, label: "Médio" },
  { value: 3, label: "Difícil" },
];

export interface HomeScreenProps {
  /** Show the "Continuar partida" button. */
  hasSavedGame: boolean;
  /** Called with the destination URL. */
  onNavigate: (url: string) => void;
}

export function HomeScreen({ hasSavedGame, onNavigate }: HomeScreenProps) {
  const [color, setColor] = useState<ColorChoice>("white");
  const [level, setLevel] = useState<Level>(2);

  const choice = (selected: boolean) =>
    `rounded border px-3 py-2 text-sm ${
      selected ? "border-foreground bg-foreground text-background" : "border-foreground/30"
    }`;
  const primary = "w-full rounded bg-foreground px-4 py-3 font-medium text-background";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 p-6">
      <h1 className="text-3xl font-semibold">Xadrez</h1>

      {hasSavedGame && (
        <button type="button" className={primary} onClick={() => onNavigate("/play")}>
          Continuar partida
        </button>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">Dois jogadores</h2>
        <p className="text-sm opacity-70">Dois jogadores no mesmo dispositivo.</p>
        <button type="button" className={primary} onClick={() => onNavigate(LOCAL_URL)}>
          Jogar local
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">Contra a máquina</h2>
        <div role="group" aria-label="Cor" className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={color === c.value}
              className={choice(color === c.value)}
              onClick={() => setColor(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Nível" className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={level === l.value}
              className={choice(level === l.value)}
              onClick={() => setLevel(l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button type="button" className={primary} onClick={() => onNavigate(aiUrl(color, level))}>
          Jogar contra a máquina
        </button>
      </section>
    </main>
  );
}
