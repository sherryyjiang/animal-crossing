import assert from "node:assert/strict";
import test from "node:test";
import { clearConversationEntries, setActiveDayIndex } from "../game/logs/conversation-log";
import { extractAndStoreMemories } from "../game/memory/memory-pipeline";
import type { MemoryFact } from "../game/memory/memory-types";
import { clearMemoryFacts, getMemoryFacts } from "../game/memory/memory-store";

function resetStores(dayIndex = 1) {
  clearConversationEntries();
  clearMemoryFacts();
  setActiveDayIndex(dayIndex);
}

test("memory extraction tags places, people, materials, and projects", async () => {
  resetStores(2);

  const entry = {
    id: "entry-1",
    npcId: "theo",
    dayIndex: 2,
    timestamp: "2026-02-02T10:00:00.000Z",
    speaker: "player" as const,
    text: "I want to build a bridge at the Community Hall using cedar planks and nails with Theo.",
  };

  await extractAndStoreMemories("theo", [entry]);

  const facts = getMemoryFacts();
  assert.ok(facts.length > 0);

  const tags = facts.flatMap((fact) => fact.tags);
  assert.ok(tags.includes("place:community-hall"));
  assert.ok(tags.includes("person:theo"));
  assert.ok(tags.includes("material:cedar"));
  assert.ok(tags.includes("project:bridge"));
  assert.ok(tags.includes("activity:build"));
});

test("repeated memories strengthen via mentions", async () => {
  resetStores(3);

  const entry = {
    id: "entry-2",
    npcId: "jun",
    dayIndex: 3,
    timestamp: "2026-02-02T12:00:00.000Z",
    speaker: "player" as const,
    text: "I love planting basil in the grove.",
  };

  await extractAndStoreMemories("jun", [entry]);
  const firstFact = getMemoryFacts()[0];
  assert.ok(firstFact);

  await extractAndStoreMemories("jun", [entry]);
  const factAfterRepeat = getMemoryFacts()[0];
  assert.ok(factAfterRepeat);

  const factWithMentions = factAfterRepeat as MemoryFact & { mentions?: number };
  assert.equal(factWithMentions.mentions, 2);
  assert.ok(factAfterRepeat.salience > firstFact.salience);
});
