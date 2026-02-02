import assert from "node:assert/strict";
import test from "node:test";
import type { MemoryFact } from "../game/memory/memory-types";
import { buildMemoryGraph, groupFactsByThread } from "../game/memory/memory-dev-tools";

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
    status: partial.status,
    threadId: partial.threadId,
    threadSequence: partial.threadSequence,
    anchors: partial.anchors,
    links: partial.links,
    createdAt: partial.createdAt ?? now,
    lastMentionedAt: partial.lastMentionedAt ?? now,
  };
}

test("buildMemoryGraph returns valid edges for existing links", () => {
  const facts: MemoryFact[] = [
    createFact({
      id: "fact-1",
      npcId: "mira",
      type: "goal",
      content: "Player wants to build a bridge.",
      links: [{ targetId: "fact-2", label: "related to" }],
    }),
    createFact({
      id: "fact-2",
      npcId: "mira",
      type: "item",
      content: "Player bought nails.",
      links: [{ targetId: "missing", label: "context" }],
    }),
  ];

  const graph = buildMemoryGraph(facts);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);

  const edge = graph.edges[0];
  assert.ok(edge);
  assert.equal(edge.sourceId, "fact-1");
  assert.equal(edge.targetId, "fact-2");
  assert.equal(edge.label, "related to");
});

test("groupFactsByThread groups and sorts by thread sequence", () => {
  const facts: MemoryFact[] = [
    createFact({
      id: "fact-a",
      npcId: "mira",
      type: "goal",
      content: "Player wants a bridge plan.",
      threadId: "mira:project:bridge",
      threadSequence: 2,
      lastMentionedAt: "2026-02-02T12:00:00.000Z",
    }),
    createFact({
      id: "fact-b",
      npcId: "mira",
      type: "task",
      content: "Player needs to finalize the bridge plan.",
      status: "open",
      threadId: "mira:project:bridge",
      threadSequence: 1,
      lastMentionedAt: "2026-02-02T11:00:00.000Z",
    }),
    createFact({
      id: "fact-c",
      npcId: "mira",
      type: "event",
      content: "Player hosted a playlist session.",
      threadId: "mira:topic:playlist",
      threadSequence: 1,
      lastMentionedAt: "2026-02-02T13:00:00.000Z",
    }),
    createFact({
      id: "fact-d",
      npcId: "mira",
      type: "event",
      content: "Player stopped by the hall.",
    }),
  ];

  const groups = groupFactsByThread(facts);
  const bridgeGroup = groups.find((group) => group.threadId === "mira:project:bridge");
  assert.ok(bridgeGroup);
  assert.equal(bridgeGroup?.label, "project bridge");
  assert.equal(bridgeGroup?.hasOpenTasks, true);

  const bridgeFacts = bridgeGroup?.facts ?? [];
  assert.equal(bridgeFacts[0]?.id, "fact-b");
  assert.equal(bridgeFacts[1]?.id, "fact-a");

  const unthreaded = groups.find((group) => group.threadId === "unthreaded");
  assert.ok(unthreaded);
  assert.equal(unthreaded?.facts.length, 1);
});
