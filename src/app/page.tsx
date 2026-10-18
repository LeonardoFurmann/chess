"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeScreen } from "@/components/home/home-screen";
import { loadGame } from "@/lib/storage";

export default function Home() {
  const router = useRouter();
  // localStorage only exists on the client: read after mount to avoid a hydration mismatch.
  const [hasSavedGame, setHasSavedGame] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasSavedGame(loadGame() !== null);
  }, []);

  return <HomeScreen hasSavedGame={hasSavedGame} onNavigate={(url) => router.push(url)} />;
}
