"use client";

import type { Game } from "phaser";
import { useEffect, useRef } from "react";

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || gameRef.current) return;

    let isMounted = true;

    async function initGame() {
      if (!container) return;
      
      const [{ createGame }] = await Promise.all([
        import("../game/create-game"),
      ]);

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;
      const game = await createGame({ parent: container, width, height });

      if (!isMounted) {
        game.destroy(true);
        return;
      }

      gameRef.current = game;

      resizeObserverRef.current = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width: nextWidth, height: nextHeight } = entry.contentRect;
        if (nextWidth > 0 && nextHeight > 0) {
          game.scale.resize(nextWidth, nextHeight);
        }
      });

      resizeObserverRef.current.observe(container);
    }

    void initGame();

    return () => {
      isMounted = false;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="game-root" />;
}
