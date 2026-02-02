import type { NpcMemoryContext } from "../memory/memory-retrieval";
import type { LlmChatInput, LlmMessage } from "./llm-types";
import { getNpcFewShotMessages } from "./npc-few-shot";

export interface NpcChatHistoryEntry {
  speaker: "npc" | "player";
  text: string;
}

export interface BuildNpcChatInputOptions {
  npcId: string;
  npcName: string;
  npcRole: string;
  memoryContext: NpcMemoryContext;
  conversationHistory: NpcChatHistoryEntry[];
  playerText: string;
}

const SYSTEM_GUIDELINES = [
  "Stay in character and speak in first person.",
  "Keep replies to 1-3 sentences.",
  "Ask one gentle follow-up question when it fits.",
  "Avoid repeating the player's words verbatim.",
];

export function buildNpcChatInput(options: BuildNpcChatInputOptions): LlmChatInput {
  const { npcId, npcName, npcRole, memoryContext, conversationHistory, playerText } = options;
  const fewShots = getNpcFewShotMessages(npcId, npcName, npcRole);
  const historyMessages = conversationHistory.map((entry) => convertHistoryEntry(entry));

  const systemPrompt = [memoryContext.prompt, "", "Guidelines:", ...SYSTEM_GUIDELINES.map((line) => `- ${line}`)].join("\n");

  const messages: LlmMessage[] = [
    ...fewShots,
    ...historyMessages,
    { role: "user", content: playerText },
  ];

  return {
    systemPrompt,
    messages,
  };
}

function convertHistoryEntry(entry: NpcChatHistoryEntry): LlmMessage {
  return {
    role: entry.speaker === "player" ? "user" : "assistant",
    content: entry.text,
  };
}
