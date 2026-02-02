import assert from "node:assert/strict";
import test from "node:test";
import { clearConversationEntries, setActiveDayIndex } from "../game/logs/conversation-log";
import { extractAndStoreMemories } from "../game/memory/memory-pipeline";
import { buildNpcMemoryContext } from "../game/memory/memory-retrieval";
import { clearMemoryFacts, getMemoryFacts } from "../game/memory/memory-store";
import { getNpcById } from "../game/npc-roster";
import type { MemoryFact } from "../game/memory/memory-types";

function resetStores(dayIndex = 1) {
  clearConversationEntries();
  clearMemoryFacts();
  setActiveDayIndex(dayIndex);
}

test("memory links connect related facts", async () => {
  resetStores(1);

  const entry1 = {
    id: "entry-1",
    npcId: "theo",
    dayIndex: 1,
    timestamp: "2026-02-02T09:00:00.000Z",
    speaker: "player" as const,
    text: "I want to build a bridge at the Community Hall.",
  };

  await extractAndStoreMemories("theo", [entry1]);
  const goalFact = getMemoryFacts().find((fact) => fact.type === "goal");
  assert.ok(goalFact);

  const entry2 = {
    id: "entry-2",
    npcId: "theo",
    dayIndex: 1,
    timestamp: "2026-02-02T10:00:00.000Z",
    speaker: "player" as const,
    text: "I really bought nails for the bridge!",
  };

  await extractAndStoreMemories("theo", [entry2]);
  const itemFact = getMemoryFacts().find((fact) => fact.type === "item");
  assert.ok(itemFact);

  const links = (itemFact as MemoryFact & { links?: Array<{ targetId: string }> }).links ?? [];
  assert.ok(links.some((link) => link.targetId === goalFact.id));
});

test("npc memory context includes linked memories", async () => {
  resetStores(1);

  const entry1 = {
    id: "entry-3",
    npcId: "theo",
    dayIndex: 1,
    timestamp: "2026-02-02T11:00:00.000Z",
    speaker: "player" as const,
    text: "I want to build a bridge at the Community Hall.",
  };

  const entry2 = {
    id: "entry-4",
    npcId: "theo",
    dayIndex: 1,
    timestamp: "2026-02-02T12:00:00.000Z",
    speaker: "player" as const,
    text: "I really bought nails for the bridge!",
  };

  await extractAndStoreMemories("theo", [entry1]);
  const goalFact = getMemoryFacts().find((fact) => fact.type === "goal");
  assert.ok(goalFact);
  await extractAndStoreMemories("theo", [entry2]);

  const npc = getNpcById("theo");
  assert.ok(npc);

  const context = await buildNpcMemoryContext({
    npcId: npc.id,
    npcName: npc.name,
    npcRole: npc.role,
    memoryLimit: 1,
  });

  const linkedMemories = (context as { linkedMemories?: MemoryFact[] }).linkedMemories ?? [];
  assert.ok(linkedMemories.some((fact) => fact.id === goalFact.id));
});
