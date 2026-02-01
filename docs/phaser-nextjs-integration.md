# Phaser 3 + Next.js App Router Integration (Client-Only)

## Decision Summary
Use a client-only React component to mount Phaser and keep all game code out of SSR.
Phaser is dynamically imported to avoid server bundling and to keep initial payload small.

## Chosen Pattern
- App Router page renders a client component (wrapped in `Suspense`) that mounts Phaser.
- The component initializes `new Phaser.Game(config)` exactly once and destroys it on unmount.
- Use a fixed parent container `div` with a `ref` or `id` for Phaser to attach to.
- Handle resize with `ResizeObserver` and call `game.scale.resize(width, height)`.

## Component Skeleton (Conceptual)
- `app/(game)/page.tsx`:
  - Dynamic import of `<PhaserGame />` with `ssr: false`
  - Wrap in `<Suspense fallback={...}>`
- `components/phaser-game.tsx`:
  - `use client`
  - `useEffect` to create/destroy Phaser instance
  - `useRef` to store game instance and container element

## Config Notes
- `type: Phaser.AUTO`
- `parent: containerElement` (or `parent: 'game-root'`)
- `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }`
- `physics: { default: 'arcade', arcade: { debug: false } }`

## Cleanup + Hot Reload
- On unmount, call `game.destroy(true)` and clear the ref.
- Guard against double-initialization in React strict mode.

## Why This Fits the Project
- Next.js stays server-first while Phaser stays purely client runtime.
- Clear boundary between UI (React) and simulation (Phaser scenes).
- Compatible with future multi-scene architecture and local storage hooks.
