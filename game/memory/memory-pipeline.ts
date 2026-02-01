import debug from "debug";
import { z } from "zod";
import { getActiveDayIndex } from "../logs/conversation-log";
import { getMemoryFacts, initializeMemoryStore, replaceAllMemoryFacts } from "./memory-store";
import type { ConversationEntry } from "../logs/conversation-log";
import type { MemoryExtractionResult, MemoryFact, MemoryFactType } from "./memory-types";

const log = debug("ralph:memory-pipeline");

const MIN_SALIENCE = 0.4;
const MAX_FACTS_PER_ENTRY = 4;

const memoryFactSchema = z.object({
  id: z.string().min(1),
  npcId: z.string().min(1),
  type: z.enum([
    "emotion",
    "preference",
    "relationship",
    "schedule",
    "goal",
    "item",
    "event",
  ]),
  content: z.string().min(1),
  tags: z.array(z.string()),
  salience: z.number().min(0).max(1),
  createdAt: z.string().min(1),
  lastMentionedAt: z.string().min(1),
});

const emotionKeywords = [
  "happy",
  "excited",
  "sad",
  "tired",
  "stressed",
  "anxious",
  "worried",
  "calm",
  "angry",
  "frustrated",
  "proud",
  "grateful",
];

const preferenceVerbs = ["love", "like", "enjoy", "prefer", "favorite"];
const goalPhrases = ["want to", "plan to", "hope to", "trying to", "aim to"];
const relationshipKeywords = [
  "friend",
  "friends",
  "partner",
  "roommate",
  "neighbor",
  "mom",
  "dad",
  "sister",
  "brother",
  "coworker",
];
const scheduleKeywords = [
  "tomorrow",
  "today",
  "tonight",
  "next week",
  "this weekend",
  "this week",
  "on monday",
  "on tuesday",
  "on wednesday",
  "on thursday",
  "on friday",
  "on saturday",
  "on sunday",
];
const itemVerbs = ["bought", "picked up", "got", "need", "looking for", "found"];
const eventVerbs = ["went", "visited", "met", "finished", "started", "helped", "built"];

export async function extractAndStoreMemories(
  npcId: string,
  entries: ConversationEntry[]
): Promise<MemoryExtractionResult> {
  await initializeMemoryStore();
  const dayIndex = getActiveDayIndex();
  const playerEntries = entries.filter((entry) => entry.speaker === "player");

  const extractedFacts = playerEntries.flatMap((entry) =>
    extractFactsFromEntry(entry, npcId, dayIndex)
  );

  const validatedFacts = validateMemoryFacts(extractedFacts).filter(
    (fact) => fact.salience >= MIN_SALIENCE
  );
  if (validatedFacts.length === 0) {
    return { addedFacts: [], totalFacts: getMemoryFacts().length };
  }

  const existingFacts = getMemoryFacts();
  const mergedFacts = mergeMemoryFacts(existingFacts, validatedFacts);
  await replaceAllMemoryFacts(mergedFacts);

  log("memory extraction added %d facts (npc=%s)", validatedFacts.length, npcId);

  return {
    addedFacts: validatedFacts,
    totalFacts: mergedFacts.length,
  };
}

function extractFactsFromEntry(entry: ConversationEntry, npcId: string, dayIndex: number) {
  const rawText = entry.text.trim();
  if (!rawText) return [];

  const lowered = rawText.toLowerCase();
  const timestamp = entry.timestamp ?? new Date().toISOString();

  const candidates: MemoryFact[] = [];

  const emotions = findKeywords(lowered, emotionKeywords);
  emotions.forEach((emotion) => {
    candidates.push(
      createMemoryFact({
        npcId,
        type: "emotion",
        content: `Player feels ${emotion}.`,
        tags: [`emotion:${emotion}`, `day:${dayIndex}`],
        sourceText: rawText,
        timestamp,
      })
    );
  });

  const preferenceMatch = findVerbObject(lowered, preferenceVerbs);
  if (preferenceMatch) {
    candidates.push(
      createMemoryFact({
        npcId,
        type: "preference",
        content: `Player ${preferenceMatch.verb}s ${preferenceMatch.object}.`,
        tags: [`preference:${preferenceMatch.object}`, `day:${dayIndex}`],
        sourceText: rawText,
        timestamp,
      })
    );
  }

  const goalMatch = findPhrase(lowered, goalPhrases);
  if (goalMatch) {
    candidates.push(
      createMemoryFact({
        npcId,
        type: "goal",
        content: `Player ${goalMatch.phrase} ${goalMatch.tail}.`,
        tags: [`goal:${goalMatch.tail}`, `day:${dayIndex}`],
        sourceText: rawText,
        timestamp,
      })
    );
  }

  const relationshipMatch = findKeywords(lowered, relationshipKeywords);
  if (relationshipMatch.length > 0) {
    relationshipMatch.forEach((relation) => {
      candidates.push(
        createMemoryFact({
          npcId,
          type: "relationship",
          content: `Player mentioned their ${relation}.`,
          tags: [`relationship:${relation}`, `day:${dayIndex}`],
          sourceText: rawText,
          timestamp,
        })
      );
    });
  }

  const scheduleMatch = findKeywords(lowered, scheduleKeywords);
  if (scheduleMatch.length > 0) {
    scheduleMatch.forEach((schedule) => {
      candidates.push(
        createMemoryFact({
          npcId,
          type: "schedule",
          content: `Player mentioned ${schedule}.`,
          tags: [`schedule:${schedule}`, `day:${dayIndex}`],
          sourceText: rawText,
          timestamp,
        })
      );
    });
  }

  const itemMatch = findVerbObject(lowered, itemVerbs);
  if (itemMatch) {
    candidates.push(
      createMemoryFact({
        npcId,
        type: "item",
        content: `Player ${itemMatch.verb} ${itemMatch.object}.`,
        tags: [`item:${itemMatch.object}`, `day:${dayIndex}`],
        sourceText: rawText,
        timestamp,
      })
    );
  }

  const eventMatch = findVerbObject(lowered, eventVerbs);
  if (eventMatch) {
    candidates.push(
      createMemoryFact({
        npcId,
        type: "event",
        content: `Player ${eventMatch.verb} ${eventMatch.object}.`,
        tags: [`event:${eventMatch.object}`, `day:${dayIndex}`],
        sourceText: rawText,
        timestamp,
      })
    );
  }

  if (candidates.length === 0) {
    candidates.push(
      createMemoryFact({
        npcId,
        type: "event",
        content: rawText,
        tags: [`day:${dayIndex}`, "event:general"],
        sourceText: rawText,
        timestamp,
      })
    );
  }

  return candidates.slice(0, MAX_FACTS_PER_ENTRY);
}

function validateMemoryFacts(facts: MemoryFact[]) {
  const validated: MemoryFact[] = [];

  facts.forEach((fact) => {
    const parsed = memoryFactSchema.safeParse(fact);
    if (!parsed.success) {
      log("invalid memory fact rejected %o", parsed.error.format());
      return;
    }

    validated.push(parsed.data);
  });

  return validated;
}

function mergeMemoryFacts(existingFacts: MemoryFact[], incomingFacts: MemoryFact[]) {
  const merged = new Map<string, MemoryFact>();
  existingFacts.forEach((fact) => {
    merged.set(createMergeKey(fact), fact);
  });

  incomingFacts.forEach((fact) => {
    const key = createMergeKey(fact);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, fact);
      return;
    }

    const combinedSalience = clamp(
      existing.salience * 0.7 + fact.salience * 0.3 + 0.05,
      0,
      1
    );
    merged.set(key, {
      ...existing,
      salience: Math.max(existing.salience, combinedSalience),
      lastMentionedAt: fact.lastMentionedAt,
      tags: mergeTags(existing.tags, fact.tags),
    });
  });

  return Array.from(merged.values()).sort((left, right) => {
    const leftTime = Date.parse(left.lastMentionedAt);
    const rightTime = Date.parse(right.lastMentionedAt);
    if (leftTime !== rightTime) return rightTime - leftTime;
    return left.id.localeCompare(right.id);
  });
}

function createMemoryFact(input: {
  npcId: string;
  type: MemoryFactType;
  content: string;
  tags: string[];
  sourceText: string;
  timestamp: string;
}): MemoryFact {
  const normalized = normalizeText(input.content);
  const salience = scoreSalience(input.type, input.sourceText);

  return {
    id: createMemoryFactId(input.npcId, input.type, normalized),
    npcId: input.npcId,
    type: input.type,
    content: input.content,
    tags: input.tags,
    salience,
    createdAt: input.timestamp,
    lastMentionedAt: input.timestamp,
  };
}

function scoreSalience(type: MemoryFactType, text: string) {
  const baseScores: Record<MemoryFactType, number> = {
    emotion: 0.55,
    preference: 0.48,
    relationship: 0.46,
    schedule: 0.4,
    goal: 0.44,
    item: 0.38,
    event: 0.42,
  };

  const lowered = text.toLowerCase();
  let score = baseScores[type];

  if (emotionKeywords.some((word) => lowered.includes(word))) score += 0.08;
  if (lowered.includes("important") || lowered.includes("big")) score += 0.08;
  if (lowered.includes("very") || lowered.includes("really")) score += 0.04;
  if (text.includes("!")) score += 0.03;
  if (text.length >= 90) score += 0.04;

  return clamp(score, 0, 1);
}

function findKeywords(text: string, keywords: string[]) {
  return keywords.filter((keyword) => text.includes(keyword));
}

function findPhrase(text: string, phrases: string[]) {
  for (const phrase of phrases) {
    const index = text.indexOf(phrase);
    if (index === -1) continue;
    const tail = text.slice(index + phrase.length).trim();
    if (!tail) continue;
    return { phrase, tail: trimSentence(tail) };
  }

  return null;
}

function findVerbObject(text: string, verbs: string[]) {
  for (const verb of verbs) {
    const index = text.indexOf(verb);
    if (index === -1) continue;
    const tail = text.slice(index + verb.length).trim();
    if (!tail) continue;
    const object = trimSentence(tail);
    if (!object) continue;
    return { verb, object };
  }

  return null;
}

function createMergeKey(fact: MemoryFact) {
  return `${fact.npcId}:${fact.type}:${normalizeText(fact.content)}`;
}

function mergeTags(existing: string[], incoming: string[]) {
  return Array.from(new Set([...existing, ...incoming]));
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function trimSentence(text: string) {
  return text.replace(/[.!?]*$/, "").trim();
}

function createMemoryFactId(npcId: string, type: MemoryFactType, content: string) {
  const fingerprint = normalizeText(content).slice(0, 32);
  return `${npcId}-${type}-${Date.now()}-${fingerprint}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
