import assert from "node:assert/strict";
import test from "node:test";
import { getNpcRoster } from "../game/npc-roster";
import { getNpcPersonalityProfile } from "../game/memory/npc-personality";
import {
  getNpcFewShotMessages,
  getNpcFewShotPairs,
} from "../game/llm/npc-few-shot";
import { buildNpcChatInput } from "../game/llm/npc-chat";

test("provides few-shot examples for every NPC", () => {
  const roster = getNpcRoster();

  roster.forEach((npc) => {
    const messages = getNpcFewShotMessages(npc.id, npc.name, npc.role);
    assert.ok(messages.length >= 2);
    assert.equal(messages[0]?.role, "user");
    assert.equal(messages[1]?.role, "assistant");

    const pairs = getNpcFewShotPairs(npc.id, npc.name, npc.role);
    assert.ok(pairs.length >= 1);
    assert.ok((pairs[0]?.user?.length ?? 0) > 0);
    assert.ok((pairs[0]?.assistant?.length ?? 0) > 0);
  });
});

test("builds chat input with few-shots before conversation history", () => {
  const npcId = "mira";
  const npcName = "Mira";
  const npcRole = "Hall Host";
  const profile = getNpcPersonalityProfile(npcId, npcRole);

  const memoryContext = {
    npcId,
    dayIndex: 1,
    profile,
    prompt: "System prompt for Mira.",
    topMemories: [],
    recentConversation: [],
  };

  const conversationHistory = [
    { speaker: "npc" as const, text: "Welcome back to the hall!" },
    { speaker: "player" as const, text: "Thanks, it feels cozy today." },
  ];

  const result = buildNpcChatInput({
    npcId,
    npcName,
    npcRole,
    memoryContext,
    conversationHistory,
    playerText: "I brought some tea for everyone.",
  });

  assert.ok(result.systemPrompt.includes(memoryContext.prompt));
  assert.deepEqual(result.messages[result.messages.length - 1], {
    role: "user",
    content: "I brought some tea for everyone.",
  });

  const fewShotMessages = getNpcFewShotMessages(npcId, npcName, npcRole);
  const firstHistoryIndex = result.messages.findIndex(
    (message: { content: string }) => message.content === conversationHistory[0].text
  );

  assert.ok(firstHistoryIndex >= fewShotMessages.length);
});
