import assert from "node:assert/strict";
import test from "node:test";
import { getNpcRoster } from "../game/npc-roster";
import type { MemoryFact } from "../game/memory/memory-types";
import { buildDayHighlights, buildDaySuggestionFallbacks } from "../game/day-summary-model";

function createFact(partial: Partial<MemoryFact> & Pick<MemoryFact, "id" | "npcId" | "type" | "content">): MemoryFact {
  const now = "2026-02-02T09:00:00.000Z";
  return {
    id: partial.id,
    npcId: partial.npcId,
    type: partial.type,
    content: partial.content,
    tags: partial.tags ?? ["day:1"],
    salience: partial.salience ?? 0.5,
    mentions: partial.mentions ?? 1,
    createdAt: partial.createdAt ?? now,
    lastMentionedAt: partial.lastMentionedAt ?? now,
  };
}

test("buildDayHighlights picks top fact per npc for the day", () => {
  const facts: MemoryFact[] = [
    createFact({
      id: "fact-1",
      npcId: "theo",
      type: "goal",
      content: "Player wants to build a bridge.",
      tags: ["day:1", "project:bridge"],
      salience: 0.62,
    }),
    createFact({
      id: "fact-2",
      npcId: "theo",
      type: "event",
      content: "Player picked up nails.",
      tags: ["day:1", "item:nails"],
      salience: 0.4,
    }),
    createFact({
      id: "fact-3",
      npcId: "jun",
      type: "event",
      content: "Player planted basil in the grove.",
      tags: ["day:1", "plant:basil"],
      salience: 0.55,
    }),
  ];

  const highlights = buildDayHighlights(facts, getNpcRoster(), 1);
  assert.equal(highlights.length, 2);
  const theoHighlight = highlights.find((highlight) => highlight.npcId === "theo");
  assert.ok(theoHighlight);
  assert.equal(theoHighlight?.summary, "Player wants to build a bridge.");
});

test("buildDaySuggestionFallbacks derives next steps from goals and projects", () => {
  const facts: MemoryFact[] = [
    createFact({
      id: "fact-4",
      npcId: "mira",
      type: "goal",
      content: "Player wants to finish the bridge plan.",
      tags: ["day:1", "goal:finish-the-bridge-plan", "project:bridge"],
      salience: 0.6,
    }),
    createFact({
      id: "fact-5",
      npcId: "pia",
      type: "event",
      content: "Player stopped by the market.",
      tags: ["day:1", "place:market-corner"],
      salience: 0.42,
    }),
  ];

  const suggestions = buildDaySuggestionFallbacks(facts, 1, 2);
  assert.equal(suggestions.length, 2);
  assert.ok(suggestions[0]?.detail.toLowerCase().includes("bridge"));
});
