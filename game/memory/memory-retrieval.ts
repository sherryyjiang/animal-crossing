import debug from "debug";
import { getActiveDayIndex, getRecentEntriesForNpc } from "../logs/conversation-log";
import type { ConversationEntry } from "../logs/conversation-log";
import { getMemoryFactsForNpc, initializeMemoryStore } from "./memory-store";
import type { MemoryFact } from "./memory-types";
import { loadPlayerProfile, type PlayerInsight } from "./player-profile";
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
  const linkedMemories = collectLinkedMemories(
    topMemories,
    memories,
    input.linkedMemoryLimit ?? 3
  );
  const activeTask = selectActiveTask(memories);
  const focusQuestion = activeTask ? buildFocusQuestion(activeTask) : null;
  const activeThread = deriveActiveThread(activeTask ?? topMemories[0], memories);
  const playerProfile = await loadPlayerProfile().catch(() => null);
  const playerInsights = playerProfile?.insights ?? [];
  const prompt = buildNpcPersonalityPrompt({
    npcName: input.npcName,
    npcRole: input.npcRole,
    profile,
    memories: topMemories,
    linkedMemories,
    activeTask,
    focusQuestion,
    activeThread,
    playerInsights,
    recentConversation,
  });

  log("memory context ready for %s (memories=%d)", input.npcId, topMemories.length);

  return {
    npcId: input.npcId,
    dayIndex: getActiveDayIndex(),
    profile,
    prompt,
    topMemories,
    linkedMemories,
    activeTask,
    focusQuestion: focusQuestion ?? undefined,
    activeThread,
    playerInsights,
    recentConversation,
  };
}

export function buildNpcPersonalityPrompt(input: NpcPromptInput): string {
  const memoryLines = input.memories.map((fact) => `- ${formatMemoryFact(fact)}`).join("\n");
  const linkedLines = input.linkedMemories
    .map((fact) => `- ${formatMemoryFact(fact)}`)
    .join("\n");
  const insightLines = input.playerInsights
    .slice(0, 3)
    .map((insight) => `- (${insight.category}) ${insight.text}`)
    .join("\n");
  const taskLine = input.activeTask ? `Active task: ${formatMemoryFact(input.activeTask)}` : "";
  const threadLine = input.activeThread
    ? `Thread ${input.activeThread.sequence}: ${input.activeThread.label}`
    : "";
  const focusLine = input.focusQuestion ? `Suggested follow-up: ${input.focusQuestion}` : "";
  const conversationLines = input.recentConversation
    .map((entry) => `- ${formatConversationEntry(entry)}`)
    .join("\n");

  return [
    `You are ${input.npcName}, the ${input.npcRole}.`,
    `${input.profile.title}. Tone: ${input.profile.tone}.`,
    `Focus: ${input.profile.focus}.`,
    input.profile.promptGuidance,
    "Be proactive: infer the player's current goal or task and ask the most helpful next question.",
    memoryLines ? `Key memories:\n${memoryLines}` : "Key memories: none yet.",
    linkedLines ? `Linked memories:\n${linkedLines}` : "",
    insightLines ? `Player insights:\n${insightLines}` : "",
    taskLine,
    threadLine,
    focusLine,
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
  linkedMemories?: MemoryFact[];
  activeTask?: MemoryFact | null;
  focusQuestion?: string;
  activeThread?: MemoryThreadSnapshot | null;
  playerInsights?: PlayerInsight[];
  recentConversation: ConversationEntry[];
}

export interface NpcMemoryContextInput {
  npcId: string;
  npcName: string;
  npcRole: string;
  memoryLimit?: number;
  recentConversationLimit?: number;
  linkedMemoryLimit?: number;
}

interface NpcPromptInput {
  npcName: string;
  npcRole: string;
  profile: NpcPersonalityProfile;
  memories: MemoryFact[];
  linkedMemories: MemoryFact[];
  activeTask: MemoryFact | null;
  focusQuestion: string | null;
  activeThread: MemoryThreadSnapshot | null;
  playerInsights: PlayerInsight[];
  recentConversation: ConversationEntry[];
}

interface MemoryThreadSnapshot {
  id: string;
  sequence: number;
  label: string;
}

function collectLinkedMemories(
  topMemories: MemoryFact[],
  allMemories: MemoryFact[],
  limit: number
) {
  if (topMemories.length === 0) return [];
  const idSet = new Set(topMemories.map((fact) => fact.id));
  const linkedIds = new Set<string>();

  topMemories.forEach((fact) => {
    (fact.links ?? []).forEach((link) => {
      if (!idSet.has(link.targetId)) linkedIds.add(link.targetId);
    });
  });

  allMemories.forEach((fact) => {
    (fact.links ?? []).forEach((link) => {
      if (idSet.has(link.targetId) && !idSet.has(fact.id)) {
        linkedIds.add(fact.id);
      }
    });
  });

  const linked = allMemories.filter((fact) => linkedIds.has(fact.id));
  return linked.slice(0, limit);
}

function selectActiveTask(memories: MemoryFact[]) {
  const tasks = memories.filter((fact) => fact.type === "task" && fact.status !== "done");
  if (tasks.length === 0) return null;
  return tasks.sort((left, right) => {
    if (left.salience !== right.salience) return right.salience - left.salience;
    return right.lastMentionedAt.localeCompare(left.lastMentionedAt);
  })[0] ?? null;
}

function buildFocusQuestion(fact: MemoryFact) {
  const cleaned = stripPlayerPrefix(fact.content);
  const action = stripLeadingIntent(cleaned);
  if (!action) {
    return "Want to keep working on that?";
  }
  return `Want to keep working on ${action}?`;
}

function deriveActiveThread(
  anchorFact: MemoryFact | undefined,
  memories: MemoryFact[]
): MemoryThreadSnapshot | null {
  if (!anchorFact?.threadId) return null;
  const related = memories.filter((fact) => fact.threadId === anchorFact.threadId);
  const sequence = Math.max(...related.map((fact) => fact.threadSequence ?? 1), 1);
  const label = humanizeThreadLabel(anchorFact.threadId);
  return {
    id: anchorFact.threadId,
    sequence,
    label,
  };
}

function humanizeThreadLabel(threadId: string) {
  const parts = threadId.split(":").slice(1);
  if (parts.length === 0) return "ongoing thread";
  return parts.join(" ").replace(/-/g, " ").trim();
}

function stripPlayerPrefix(text: string) {
  return text.replace(/^player\s+/i, "");
}

function stripLeadingIntent(text: string) {
  return text
    .replace(/^(needs to|need to|has to|have to|must|should|wants to|want to|plans to|plan to|trying to|aim to)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}
