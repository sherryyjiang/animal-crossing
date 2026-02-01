# Layout Approach Decision (Iteration 2)

## Goal
Pick a layout method that supports a cozy, readable village while keeping early iteration speed high.

## Options Considered

### Tilemap (Tiled + Phaser tilemap)
**Pros**
- Built-in grid and collision layers.
- Scales to larger maps and repeated patterns.
- Easier to author walkable vs blocked areas.

**Cons**
- Requires a tile pipeline and Tiled authoring step.
- Adds asset prep overhead early (tilesets, exports, updates).
- Less flexible for bespoke, hand-placed props.

### Hand-Placed Sprites/Shapes (Phaser Graphics + data config)
**Pros**
- Fastest iteration for early prototypes.
- Easy to sculpt organic spaces and bespoke props.
- Works well with simple pastel vector shapes.

**Cons**
- Collision setup is manual.
- Large maps become harder to maintain without tooling.
- Fewer guardrails for alignment without a grid convention.

## Decision
**Choose hand-placed sprites/shapes for Iteration 2.**

Rationale: the current scope is a small, four-zone village with simple pastel assets. Hand-placed layout maximizes iteration speed and keeps the art pipeline lightweight. We can introduce a light data-driven layout file to reduce drift and make a later tilemap migration straightforward.

## Implementation Notes (to keep migration easy)
- Keep layout data in a single config module (positions, sizes, collision flags).
- Use a soft grid (e.g., 16px or 32px) for snapping values.
- Define collision as rectangles/zones that map 1:1 to future tile collision layers.
- Name props/zones consistently so they can be scripted later.

