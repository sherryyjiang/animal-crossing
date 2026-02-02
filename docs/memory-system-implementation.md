# Memory System Implementation (Current)

This document captures how the current memory system works in the codebase
so we can track behavior and plan improvements.

## Scope

These notes reflect the implementation in `game/memory/*` and supporting
logs/storage as of today.

I could not locate PRD docs or Supabase/Gemini specs in this repo. If they live
elsewhere, please point me at them so we can compare expected vs actual behavior.

## Core data model

Memory facts are the primary record. Each fact includes:

- `type`: one of `emotion`, `preference`, `relationship`, `schedule`, `goal`,
  `task`, `item`, `event`
- `content`: human-readable sentence used in prompts
- `tags`: string tags used for anchors, threads, and linkage
- `salience`: 0-1 score based on type + wording
- `mentions`: count of merged mentions
- `status`: `open` or `done` (tasks only)
- `threadId` + `threadSequence`: optional conversation thread tracking
- `anchors`: derived from tags for linking
- timestamps: `createdAt`, `lastMentionedAt`

Reference: `game/memory/memory-types.ts`.

## Memory storage

- Memory facts are stored in a local in-memory store and persisted through
  `game/memory/memory-store.ts`.
- `extractAndStoreMemories()` replaces the store with merged facts after each
  extraction.

## Extraction pipeline (player-only)

Extraction is rule-based on player messages only:

1. Filter conversation entries to `speaker === "player"`.
2. For each entry, attempt to extract up to 4 facts.
3. Validate each fact with Zod and drop facts below a salience threshold.
4. Assign threads, attach links, merge with existing facts, then mark task
   completions.
5. Persist the merged list.

Reference: `game/memory/memory-pipeline.ts`.

### Fact creation rules

Each rule scans the lowercased text. If matched, it emits a fact with tags
and anchors. These are additive; multiple facts can be emitted per entry.

- **Emotion**: keyword match (happy, excited, etc.)
- **Preference**: verb + object match using verbs like `love`, `like`, `enjoy`
  (blocked if "like you to" indicates a request)
- **Task**: `need to`, `have to`, `must`, `gotta`, `should`
- **Task (request phrasing)**: `I'd like you to`, `I want you to`, `could you`,
  `can you`, `please` (stored as task with status `open`)
- **Goal**: `want to`, `plan to`, `hope to`, `trying to`, `aim to`
- **Relationship**: keyword match (friend, partner, sister, etc.)
- **Schedule**: time keywords (today, tomorrow, next week, weekdays, etc.)
- **Item**: verb + object (`bought`, `picked up`, `need`, etc.)
- **Event**: verb + object (`went`, `visited`, `finished`, etc.)
- **Fallback**: if no rule matches, add a generic `event` with raw text

### Tags and anchors

Tags are used for linking and threads:

- Base tags: `type:*`, `day:*`, `npc:*`
- Semantic tags extracted from lexicons and regex:
  - places, people, projects, activities, materials, tools, plants, products
  - genre tags like `"house music"`
  - titles from quoted text or multi-word capitalized phrases
  - people from "by <Name>" patterns

Anchors are derived from tags and used to link related memories. If tags are
empty, a fallback topic anchor is derived from the raw text.

### Salience scoring

Base salience per type (0.38-0.55). Bonuses for:

- emotion keywords
- "important" / "big"
- "very" / "really"
- exclamation point
- long text (>= 90 chars)

Facts below `MIN_SALIENCE` (0.4) are discarded.

### Merging

Facts are merged by a key of `(npcId, type, normalized content)`.

On merge:

- `mentions` increments
- `salience` slightly increases with mention count and weighted average
- tags, links, anchors are merged
- `status` is `done` if either fact is `done`
- `lastMentionedAt` updates to the newest

### Threading

Each fact attempts to derive a `threadId` from prioritized tag groups:

`task`, `goal`, `project`, `event`, `activity`, `place`, `person`, `genre`,
`item`, `title`, `schedule`

Thread sequence increments as new facts land in the same thread.

### Linking

Facts are linked when:

- they share anchors, or
- they were created in the same entry (context link)

Up to 4 links are attached per fact. Link labels can be specialized
("created by", "creator of") based on anchor types.

### Task completion

A task is marked `done` if an `event` fact indicates completion and overlaps
anchors with the task. Completion phrases include "finished", "completed",
"wrapped up", "done".

## Retrieval and prompt composition

Memory context is built per NPC:

1. Load all facts for the NPC.
2. Rank facts with a weighted score:
   - recency
   - salience
   - type match with NPC profile focus
3. Select top memories and their linked memories.
4. Choose an active task (highest salience, most recent).
5. Derive a focus question from the active task.
6. Include recent conversation snippets.

The prompt includes:

- NPC role + tone
- Key memories
- Linked memories
- Player insights
- Active task + focus question
- Recent conversation lines

Reference: `game/memory/memory-retrieval.ts` and `game/memory/npc-personality.ts`.

## Current tests

Memory behavior is covered by node test files:

- `tests/memory-pipeline.test.ts`: tags, mentions/salience
- `tests/memory-links.test.ts`: linking and linked memory inclusion
- `tests/memory-tasks.test.ts`: task extraction + focus question + request phrasing

Tests compile to `.test-dist` and run with `node --test`.

## Known limitations (current behavior)

- Rule-based extraction only; no LLM extraction yet.
- Only player messages are extracted into memory.
- Keyword/lexicon matching can still miss paraphrases or produce false positives.
- Tasks without explicit trigger phrases are not captured.
- Completion detection is limited to a small phrase set.
- Preference vs request disambiguation is narrow (currently only "like you to").
- Memory scoring is heuristic, not personalized to the player or NPC history.
