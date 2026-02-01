import dynamic from "next/dynamic";
import { Suspense } from "react";

const PhaserGame = dynamic(
  () => import("../components/phaser-game").then((mod) => mod.PhaserGame),
  { ssr: false }
);

export default function HomePage() {
  return (
    <main className="game-shell">
      <Suspense fallback={<div className="loading">Loading...</div>}>
        <PhaserGame />
      </Suspense>
    </main>
  );
}

