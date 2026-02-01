"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { DialogueOverlay } from "../components/dialogue-overlay";

const PhaserGame = dynamic(
  () => import("../components/phaser-game").then((mod) => mod.PhaserGame),
  { ssr: false }
);

export default function HomePage() {
  return (
    <main className="game-shell">
      <Suspense fallback={<div className="loading">Loading...</div>}>
        <PhaserGame />
        <DialogueOverlay />
      </Suspense>
    </main>
  );
}

