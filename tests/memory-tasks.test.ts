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

test("task extraction creates open tasks and focus question", async () => {
  resetStores(4);

  const entry = {
    id: "entry-5",
    npcId: "mira",
    dayIndex: 4,
    timestamp: "2026-02-02T14:00:00.000Z",
    speaker: "player" as const,
    text: "I need to finalize the 50-song playlist for this weekend.",
  };

  await extractAndStoreMemories("mira", [entry]);
  const taskFact = getMemoryFacts().find(
    (fact) => (fact as unknown as { type?: string }).type === "task"
  );
  assert.ok(taskFact);

  const taskStatus = (taskFact as MemoryFact & { status?: string }).status;
  assert.equal(taskStatus, "open");

  const npc = getNpcById("mira");
  assert.ok(npc);

  const context = await buildNpcMemoryContext({
    npcId: npc.id,
    npcName: npc.name,
    npcRole: npc.role,
    memoryLimit: 2,
  });

  const focusQuestion = (context as { focusQuestion?: string }).focusQuestion;
  assert.ok(focusQuestion);
  assert.ok(focusQuestion.toLowerCase().includes("playlist"));
});

test("request phrasing becomes task without preference tags", async () => {
  resetStores(5);

  const entry = {
    id: "entry-6",
    npcId: "mira",
    dayIndex: 5,
    timestamp: "2026-02-02T15:00:00.000Z",
    speaker: "player" as const,
    text: "I'd like you to work on putting a sample playlist.",
  };

  await extractAndStoreMemories("mira", [entry]);
  const facts = getMemoryFacts();

  const taskFact = facts.find((fact) => fact.type === "task");
  assert.ok(taskFact);
  assert.ok(taskFact.content.toLowerCase().includes("sample playlist"));

  assert.ok(!facts.some((fact) => fact.type === "preference"));

  const allTags = facts.flatMap((fact) => fact.tags);
  assert.ok(!allTags.includes("product:checklist"));
});
