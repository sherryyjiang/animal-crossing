---
task: "Animal Crossing-like 2D village (Next.js + Phaser 3 + LLM NPCs)"
test_command: ""
---

# Task: Animal Crossing-Like Village (Browser-Only)

Use `PLAN.md` as the source of truth. This task file expands it into actionable steps.

## Constraints
- Browser-only runtime for now (no backend).
- Local persistence (IndexedDB preferred; localStorage fallback).
- LLM-generated day summary.
- Soft pastel visual style with cute, cozy assets.
- LLM model should be swappable (start with gpt-oss on Cerebras).

## Research + Decisions
- [x] Review Phaser 3 + Next.js integration patterns (client-only mount, resize, input) and capture the chosen approach in a short doc. <!-- group: 1 -->
- [x] Evaluate layout approach: tilemap vs hand-placed sprites; document tradeoffs and pick one. <!-- group: 1 -->
- [x] Investigate IndexedDB options (`idb`, `dexie`) and pick a library + fallback plan. <!-- group: 1 -->
- [x] Review Cerebras gpt-oss API constraints (auth, rate limits, CORS) and define how the browser client will call it. <!-- group: 1 -->
- [x] Review Phaser Gamedev resources for best practices on camera, collisions, and interaction triggers. <!-- group: 1 -->
- [x] Gather 3-5 visual references (Animal Crossing, Stardew, Spiritfarer, etc.) and summarize the key cues. <!-- group: 1 -->
- [x] Brainstorm 3 distinct visual directions (pastel vector, soft pixel, paper-cut) with palettes + UI notes. <!-- group: 1 -->
- [x] Draft NPC personality notes + memory filters in a short doc. <!-- group: 1 -->
- [x] Draft day summary prompt template + safety guardrails. <!-- group: 1 -->

## Design Decisions
- [x] Finalize art direction + palette + typography and document in `docs/visual-style.md`. <!-- group: 2 -->
- [x] Finalize village layout plan (map sketch, zones, props) in `docs/village-map.md`. <!-- group: 2 -->
- [x] Finalize memory schema + retrieval weights per NPC in `docs/memory-schema.md`. <!-- group: 2 -->
- [x] Finalize LLM adapter interface + config shape in `docs/llm-adapter.md`. <!-- group: 2 -->

## Implementation
- [x] Bootstrap Next.js app with Phaser 3 scene mounting (client-only). <!-- group: 3 -->
- [x] Add player movement, collisions, camera follow, and interaction detection. <!-- group: 3 -->
- [x] Implement base village layout with pastel assets (SVG/Graphics). <!-- group: 4 -->
- [x] Add four NPCs with idle animations and location signage. <!-- group: 4 -->
- [x] Build dialogue UI overlay with input + continue flow. <!-- group: 5 -->
- [x] Implement conversation logging per NPC/day. <!-- group: 5 -->
- [x] Implement local storage layer (IndexedDB + fallback). <!-- group: 6 -->
- [x] Implement memory extraction + salience scoring pipeline. <!-- group: 6 -->
- [x] Implement memory retrieval + NPC personality prompts. <!-- group: 6 -->
- [ ] Implement LLM adapter + model configuration switching. <!-- group: 6 -->
- [ ] Add day cycle state, end-day gating, and LLM summary modal. <!-- group: 7 -->

## Polish + Validation
- [ ] Add developer panel for inspecting memory + day logs. <!-- group: 8 -->
- [ ] Add synthetic chat harness to validate memory behavior. <!-- group: 8 -->
- [ ] UX polish: transitions, dialogue pacing, ambient animation. <!-- group: 9 -->
- [ ] QA checklist + manual test script in `docs/test-plan.md`. <!-- group: 9 -->

---

## Available Skills

This project has specialized skills in `.cursor/skills/` that provide domain expertise:

- **phaser-gamedev**: Phaser 3 game development patterns including:
  - Scene architecture (Boot/Menu/Game/UI), lifecycle, and transitions
  - Arcade physics, collision detection, and object pooling
  - Spritesheet loading, animations, and nine-slice UI panels
  - Tilemap integration with Tiled (layers, collision, object spawning)
  - Performance optimization (pooling, culling, delta time)
  - See `references/` subfolder for detailed patterns

Read these skills before implementing Phaser-related tasks. They contain battle-tested patterns and anti-patterns to avoid.

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes (use `test_command` when set)
4. Commit your changes frequently
5. **Consult `.cursor/skills/` for domain expertise** (especially `phaser-gamedev` for game implementation tasks)
6. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
7. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
