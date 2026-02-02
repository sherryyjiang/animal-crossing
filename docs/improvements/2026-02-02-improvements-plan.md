# Game Improvements Plan (2026-02-02)

## Goals
- Make every NPC physically reachable in the village.
- Fix chat input capture and wire NPC replies to the LLM adapter.
- Add few-shot examples per NPC for better LLM steering and testing.
- Improve the visual fidelity of trees/shops/UI (less pastel, more contrast).

## Current Issues
- Several NPCs are placed inside obstacle colliders (Theo, Jun, Pia).
- Phaser keyboard capture blocks letters (W/A/S/D/E/space) while typing.
- Dialogue replies are templated echoes; not LLM-generated.

## Research Notes (assets + UI)
1) ferhatgnlts “Village Asset Pack” (CC0, 14 hand-drawn village PNGs).
   https://ferhatgnlts.itch.io/free-2d-village-asset-pack
2) Cainos “Pixel Art Platformer - Village Props” (124 props, free with attribution appreciated).
   https://cainos.itch.io/pixel-art-platformer-village-props
3) PixelJAD “Village Top Down” (free, but CC BY-ND and restrictions on redistribution).
   https://pixeljad.itch.io/villagetd
4) Game-icons.net (CC BY 3.0 SVG/PNG icons; good for UI icons/signage).
   https://game-icons.net/
5) Kenney CC0 asset packs (Sketch Desert shows CC0 license; Kenney packs generally CC0).
   https://kenney-assets.itch.io/sketch-desert

## Visual Direction Options (5-10 ideas)
1) CC0 hand-drawn village pack (ferhatgnlts) + custom palette tweaks.
2) Pixel art props pack (Cainos) + minimal top-down tiles + modern UI.
3) Use Game-icons.net SVGs for shops/trees/signs, recolor via CSS/Phaser.
4) Kenney “Sketch” line-art packs (buildings/trees) + muted-but-saturated palette.
5) Keep vector graphics, but upgrade to “storybook” shapes: layered canopies, roofed shops, and stronger contrast.
6) Add subtle texture overlays + drop shadows for panels and props.
7) Introduce a themed set of signage icons per NPC role (tools, books, gossip, mood).
8) Swap UI to a warm-neutral base with bold accent color (teal/coral) instead of pastel.

## Proposed Direction (pick for now)
- “Storybook vector” upgrade using current Phaser Graphics (no external downloads required).
- Stronger, warmer palette + higher-detail trees/shops + improved UI contrast.
- Keep external asset options documented for later swap.

## Implementation Plan (high-level)
1) Extract scene config to a pure module; add tests for NPC reachability.
2) Fix keyboard capture by disabling Phaser’s key capture for typing keys.
3) Add few-shot data + LLM chat message builder + wire DialogueOverlay to LLM adapter.
4) Update palette + tree/building renderers for higher fidelity.

## Testing Plan
- Unit tests for NPC collider overlap vs obstacles.
- Unit tests for few-shot coverage per NPC and chat message construction.
- Manual: verify typing in chat input accepts W/A/S/D/E/space and NPC replies are LLM.
- Manual: verify NPCs reachable in-game and visuals updated.
