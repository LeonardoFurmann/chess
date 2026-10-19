"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { hasGameParams, resolvePlayInit, type PlayInit } from "@/app/play/init";
import { PlayView } from "@/app/play/play-view";

function PlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [init, setInit] = useState<PlayInit | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // localStorage only exists on the client: resolve after mount to avoid a hydration mismatch.
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(searchParams.toString());
    const result = resolvePlayInit(params);
    if (result.kind === "redirect") {
      router.replace("/");
      return;
    }
    // A new game is persisted; drop the parameters so a reload resumes it instead of restarting.
    if (result.kind === "ready" && hasGameParams(params)) router.replace("/play");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInit(result);
  }, [router, searchParams]);

  if (init === null || init.kind === "redirect") return <p className="p-4">Carregando…</p>;
  if (init.kind === "error") {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-3 p-4">
        <p role="alert">{init.message}</p>
        <Link href="/" className="underline">
          Voltar ao início
        </Link>
      </main>
    );
  }
  return <PlayView saved={init.saved} game={init.game} />;
}

export default function PlayPage() {
  return (
    <Suspense fallback={<p className="p-4">Carregando…</p>}>
      <PlayContent />
    </Suspense>
  );
}
