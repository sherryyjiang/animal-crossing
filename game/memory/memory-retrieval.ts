import debug from "debug";
import { getActiveDayIndex, getRecentEntriesForNpc } from "../logs/conversation-log";
import type { ConversationEntry } from "../logs/conversation-log";
import { getMemoryFactsForNpc, initializeMemoryStore } from "./memory-store";
import type { MemoryFact } from "./memory-types";
import { getNpcPersonalityProfile } from "./npc-personality";
import type { NpcPersonalityProfile } from "./npc-personality";

const log = debug("ralph:memory-retrieval");

export async function buildNpcMemoryContext(input: NpcMemoryContextInput): Promise<NpcMemoryContext> {
  await initializeMemoryStore();
  const profile = getNpcPersonalityProfile(input.npcId, input.npcRole);
  const memories = rankMemoryFacts(getMemoryFactsForNpc(input.npcId), profile);
  const recentConversation = getRecentEntriesForNpc(
    input.npcId,
    input.recentConversationLimit ?? 4
  );
  const topMemories = memories.slice(0, input.memoryLimit ?? 4);
  const prompt = buildNpcPersonalityPrompt({
    npcName: input.npcName,
    npcRole: input.npcRole,
    profile,
    memories: topMemories,
    recentConversation,
  });

  log("memory context ready for %s (memories=%d)", input.npcId, topMemories.length);

  return {
    npcId: input.npcId,
    dayIndex: getActiveDayIndex(),
    profile,
    prompt,
    topMemories,
    recentConversation,
  };
}

export function buildNpcPersonalityPrompt(input: NpcPromptInput): string {
  const memoryLines = input.memories.map((fact) => `- ${formatMemoryFact(fact)}`).join("\n");
  const conversationLines = input.recentConversation
    .map((entry) => `- ${formatConversationEntry(entry)}`)
    .join("\n");

  return [
    `You are ${input.npcName}, the ${input.npcRole}.`,
    `${input.profile.title}. Tone: ${input.profile.tone}.`,
    `Focus: ${input.profile.focus}.`,
    input.profile.promptGuidance,
    memoryLines ? `Key memories:\n${memoryLines}` : "Key memories: none yet.",
    conversationLines
      ? `Recent conversation snippets:\n${conversationLines}`
      : "Recent conversation snippets: none yet.",
  ].join("\n");
}

function rankMemoryFacts(memories: MemoryFact[], profile: NpcPersonalityProfile) {
  if (memories.length === 0) return [];
  const nowMs = Date.now();
  const ages = memories.map((fact) => Math.max(0, nowMs - parseTimestamp(fact.lastMentionedAt)));
  const maxAge = Math.max(...ages, 1);
  const focusTypes = new Set(profile.memoryTypes);

  return [...memories].sort((left, right) => {
    const leftScore = scoreMemoryFact(left, profile, maxAge, focusTypes, nowMs);
    const rightScore = scoreMemoryFact(right, profile, maxAge, focusTypes, nowMs);
    if (leftScore !== rightScore) return rightScore - leftScore;
    return Date.parse(right.lastMentionedAt) - Date.parse(left.lastMentionedAt);
  });
}

function scoreMemoryFact(
  fact: MemoryFact,
  profile: NpcPersonalityProfile,
  maxAge: number,
  focusTypes: Set<MemoryFact["type"]>,
  nowMs: number
) {
  const ageMs = Math.max(0, nowMs - parseTimestamp(fact.lastMentionedAt));
  const recency = 1 - Math.min(1, ageMs / maxAge);
  const typeMatch = focusTypes.has(fact.type) ? 1 : 0.3;
  const { recencyWeight, salienceWeight, typeWeight } = profile.weights;
  return recency * recencyWeight + fact.salience * salienceWeight + typeMatch * typeWeight;
}

function parseTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function formatMemoryFact(fact: MemoryFact) {
  return fact.content.replace(/^player /i, "You ");
}

function formatConversationEntry(entry: ConversationEntry) {
  const speaker = entry.speaker === "player" ? "You" : "NPC";
  return `${speaker}: ${entry.text}`;
}

export interface NpcMemoryContext {
  npcId: string;
  dayIndex: number;
  profile: NpcPersonalityProfile;
  prompt: string;
  topMemories: MemoryFact[];
  recentConversation: ConversationEntry[];
}

export interface NpcMemoryContextInput {
  npcId: string;
  npcName: string;
  npcRole: string;
  memoryLimit?: number;
  recentConversationLimit?: number;
}

interface NpcPromptInput {
  npcName: string;
  npcRole: string;
  profile: NpcPersonalityProfile;
  memories: MemoryFact[];
  recentConversation: ConversationEntry[];
}
