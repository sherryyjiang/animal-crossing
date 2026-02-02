# QA Test Plan

## Scope
- Validate the core gameplay loop (movement → talk → day summary).
- Confirm persistence across reloads.
- Verify overlays, pacing, and ambient animations.
- Exercise developer tooling and synthetic chat harness.

## Preconditions
- Run `npm install`.
- Start the app with `npm run dev`.
- Ensure the browser allows IndexedDB for the site.

## QA Checklist
- App loads without runtime errors and renders the village.
- Player moves with arrow keys and WASD; camera follows smoothly.
- Player collides with obstacles and stays within world bounds.
- Interaction prompts appear when close to an NPC or the notice board.
- Dialogue overlay opens and closes cleanly; close button works.
- Sending a message shows a short typing delay before the NPC reply.
- Continue button is disabled until the NPC reply appears.
- Dialogue lines animate on entry; overlay panel transitions are visible.
- Ambient animation is visible (tree sway, pond shimmer, plaza motes).
- Dev panel opens, refreshes, and shows logs + memory facts.
- Synthetic chat harness seeds entries/facts and shows per-NPC counts.
- Day HUD counts visits; End Day unlocks after all NPCs are visited.
- Day summary modal opens, shows a response, and Start New Day resets visits.
- Reload persists conversation logs, memory facts, and day index.

## Manual Test Script
1. Load the app and wait for the village scene to render.
2. Move around with WASD and arrow keys; confirm collisions with buildings/fences.
3. Walk to an NPC, confirm the prompt, and press E/Space to open dialogue.
4. Enter a short message, press Send, and watch the typing indicator.
5. Confirm the NPC reply appears after the delay; click Continue to close.
6. Open the dev panel and confirm the new conversation entry appears.
7. Repeat steps 3-6 with the remaining NPCs.
8. Click End Day once all NPCs are visited; wait for the summary.
9. Click Start New Day; verify visit count resets to 0 and day increments.
10. Refresh the page and confirm the logs, memory facts, and day index persist.
11. Open the dev panel, run Seed Synthetic Chat, and confirm entry/fact counts update.

## Bug Report Template
- **Title**: Concise description of the issue.
- **Repro steps**: Numbered list from a clean reload.
- **Expected**: What should happen.
- **Actual**: What happened instead.
- **Context**: Browser + OS, day index, NPC name, storage state.
- **Evidence**: Screenshot or console stack trace if present.
