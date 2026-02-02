import debug from "debug";
import { z } from "zod";
import { getActiveDayIndex } from "../logs/conversation-log";
import { getNpcRoster } from "../npc-roster";
import { getMemoryFacts, initializeMemoryStore, replaceAllMemoryFacts } from "./memory-store";
import type { ConversationEntry } from "../logs/conversation-log";
import type { MemoryAnchor, MemoryExtractionResult, MemoryFact, MemoryFactType, MemoryLink } from "./memory-types";

const log = debug("ralph:memory-pipeline");

const MIN_SALIENCE = 0.4;
const MAX_FACTS_PER_ENTRY = 4;

type LexiconEntry = {
  value: string;
  aliases: string[];
};

const memoryFactSchema = z.object({
  id: z.string().min(1),
  npcId: z.string().min(1),
  type: z.enum([
    "emotion",
    "preference",
    "relationship",
    "schedule",
    "goal",
    "task",
    "item",
    "event",
  ]),
  content: z.string().min(1),
  tags: z.array(z.string()),
  salience: z.number().min(0).max(1),
  mentions: z.number().int().min(1).optional().default(1),
  status: z.enum(["open", "done"]).optional(),
  threadId: z.string().min(1).optional(),
  threadSequence: z.number().int().min(1).optional(),
  anchors: z
    .array(
      z.object({
        type: z.enum([
          "person",
          "genre",
          "activity",
          "time",
          "place",
          "item",
          "project",
          "event",
          "goal",
          "title",
          "topic",
        ]),
        value: z.string().min(1),
      })
    )
    .optional(),
  links: z
    .array(
      z.object({
        targetId: z.string().min(1),
        label: z.string().min(1),
      })
    )
    .optional(),
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
const taskPhrases = ["need to", "have to", "must", "gotta", "should"];
const requestPhrases = [
  "i'd like you to",
  "i would like you to",
  "id like you to",
  "i want you to",
  "could you",
  "can you",
  "please",
];
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
const eventVerbs = [
  "went",
  "visited",
  "met",
  "finished",
  "completed",
  "wrapped up",
  "started",
  "helped",
  "built",
];

const placeLexicon: LexiconEntry[] = [
  { value: "community hall", aliases: ["community hall", "hall"] },
  { value: "craft shop", aliases: ["craft shop", "workshop"] },
  { value: "grove", aliases: ["grove", "garden", "garden grove"] },
  { value: "market corner", aliases: ["market corner", "market"] },
  { value: "notice board", aliases: ["notice board", "bulletin board"] },
];

const projectLexicon: LexiconEntry[] = [
  { value: "bridge", aliases: ["bridge", "bridge repair"] },
  { value: "house", aliases: ["house", "home", "cabin"] },
  { value: "garden", aliases: ["garden", "kitchen garden", "herb garden"] },
  { value: "blueprint", aliases: ["blueprint", "plan", "layout"] },
];

const activityLexicon: LexiconEntry[] = [
  { value: "build", aliases: ["build", "building", "construct"] },
  { value: "repair", aliases: ["repair", "fix", "mend"] },
  { value: "plan", aliases: ["plan", "planning", "sketch", "design"] },
  { value: "plant", aliases: ["plant", "planting", "garden", "grow"] },
  { value: "shop", aliases: ["shop", "shopping", "trade", "buy"] },
  { value: "organize", aliases: ["organize", "organizing", "arrange"] },
];

const materialLexicon: LexiconEntry[] = [
  { value: "wood", aliases: ["wood", "timber"] },
  { value: "cedar", aliases: ["cedar"] },
  { value: "pine", aliases: ["pine"] },
  { value: "stone", aliases: ["stone", "rock"] },
  { value: "rope", aliases: ["rope", "twine"] },
  { value: "nails", aliases: ["nail", "nails"] },
  { value: "planks", aliases: ["plank", "planks"] },
];

const toolLexicon: LexiconEntry[] = [
  { value: "hammer", aliases: ["hammer", "mallet"] },
  { value: "saw", aliases: ["saw"] },
  { value: "shovel", aliases: ["shovel", "spade"] },
  { value: "trowel", aliases: ["trowel"] },
  { value: "watering can", aliases: ["watering can", "water can"] },
];

const plantLexicon: LexiconEntry[] = [
  { value: "basil", aliases: ["basil", "thai basil"] },
  { value: "lemongrass", aliases: ["lemongrass"] },
  { value: "kaffir lime", aliases: ["kaffir lime", "lime"] },
  { value: "cilantro", aliases: ["cilantro", "coriander"] },
];

const productLexicon: LexiconEntry[] = [
  { value: "compost tea", aliases: ["compost tea", "compost-tea"] },
  { value: "blueprint", aliases: ["blueprint"] },
  { value: "checklist", aliases: ["checklist"] },
];

const personLexicon: LexiconEntry[] = getNpcRoster().map((npc) => ({
  value: npc.name.toLowerCase(),
  aliases: [npc.name.toLowerCase(), npc.id.toLowerCase(), npc.role.toLowerCase()],
}));

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
  const threadedFacts = assignThreadInfo(validatedFacts, existingFacts);
  const linkedFacts = attachMemoryLinks(threadedFacts, existingFacts);
  const mergedFacts = mergeMemoryFacts(existingFacts, linkedFacts);
  const finalizedFacts = applyTaskCompletions(mergedFacts, linkedFacts);
  await replaceAllMemoryFacts(finalizedFacts);

  log("memory extraction added %d facts (npc=%s)", validatedFacts.length, npcId);

  return {
    addedFacts: linkedFacts,
    totalFacts: finalizedFacts.length,
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
        tags: buildTags({
          type: "emotion",
          rawText,
          npcId,
          dayIndex,
          detailTags: [createTag("emotion", emotion)],
        }),
        sourceText: rawText,
        timestamp,
      })
    );
  });

  const preferenceMatch = findVerbObject(lowered, preferenceVerbs);
  if (preferenceMatch && !isPreferenceRequest(lowered, preferenceMatch)) {
    candidates.push(
      createMemoryFact({
        npcId,
        type: "preference",
        content: `Player ${preferenceMatch.verb}s ${preferenceMatch.object}.`,
        tags: buildTags({
          type: "preference",
          rawText,
          npcId,
          dayIndex,
          detailTags: [createTag("preference", preferenceMatch.object)],
        }),
        sourceText: rawText,
        timestamp,
      })
    );
  }

  const taskMatch = findPhrase(lowered, taskPhrases);
  if (taskMatch) {
    candidates.push(
      createMemoryFact({
        npcId,
        type: "task",
        content: formatTaskContent(taskMatch.phrase, taskMatch.tail),
        tags: buildTags({
          type: "task",
          rawText,
          npcId,
          dayIndex,
          detailTags: [createTag("task", taskMatch.tail)],
        }),
        sourceText: rawText,
        timestamp,
        status: "open",
      })
    );
  }

  const requestMatch = findPhrase(lowered, requestPhrases);
  if (requestMatch) {
    candidates.push(
      createMemoryFact({
        npcId,
        type: "task",
        content: formatRequestTaskContent(requestMatch.phrase, requestMatch.tail),
        tags: buildTags({
          type: "task",
          rawText,
          npcId,
          dayIndex,
          detailTags: [createTag("task", requestMatch.tail)],
        }),
        sourceText: rawText,
        timestamp,
        status: "open",
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
        tags: buildTags({
          type: "goal",
          rawText,
          npcId,
          dayIndex,
          detailTags: [createTag("goal", goalMatch.tail)],
        }),
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
          tags: buildTags({
            type: "relationship",
            rawText,
            npcId,
            dayIndex,
            detailTags: [createTag("relationship", relation)],
          }),
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
          tags: buildTags({
            type: "schedule",
            rawText,
            npcId,
            dayIndex,
            detailTags: [createTag("schedule", schedule)],
          }),
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
        tags: buildTags({
          type: "item",
          rawText,
          npcId,
          dayIndex,
          detailTags: [createTag("item", itemMatch.object)],
        }),
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
        tags: buildTags({
          type: "event",
          rawText,
          npcId,
          dayIndex,
          detailTags: [createTag("event", eventMatch.object)],
        }),
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
        tags: buildTags({
          type: "event",
          rawText,
          npcId,
          dayIndex,
          detailTags: [createTag("event", "general")],
        }),
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

    const existingMentions = existing.mentions ?? 1;
    const incomingMentions = fact.mentions ?? 1;
    const combinedMentions = existingMentions + incomingMentions;
    const mentionBoost = Math.min(0.12, Math.log2(combinedMentions + 1) * 0.04);
    const combinedSalience = clamp(
      existing.salience * 0.65 + fact.salience * 0.35 + 0.04 + mentionBoost,
      0,
      1
    );
    const mergedLinks = mergeLinks(existing.links, fact.links);
    const mergedAnchors = mergeAnchors(existing.anchors, fact.anchors);
    const mergedStatus =
      existing.status === "done" || fact.status === "done"
        ? "done"
        : existing.status ?? fact.status;
    const threadId = existing.threadId ?? fact.threadId;
    const threadSequence = Math.max(existing.threadSequence ?? 0, fact.threadSequence ?? 0) || undefined;
    merged.set(key, {
      ...existing,
      salience: Math.max(existing.salience, combinedSalience),
      mentions: combinedMentions,
      lastMentionedAt: fact.lastMentionedAt,
      tags: mergeTags(existing.tags, fact.tags),
      status: mergedStatus,
      threadId,
      threadSequence,
      anchors: mergedAnchors.length > 0 ? mergedAnchors : existing.anchors,
      links: mergedLinks.length > 0 ? mergedLinks : existing.links,
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
  status?: "open" | "done";
}): MemoryFact {
  const normalized = normalizeText(input.content);
  const salience = scoreSalience(input.type, input.sourceText);
  const anchors = buildAnchors(input.tags, input.sourceText);

  return {
    id: createMemoryFactId(input.npcId, input.type, normalized),
    npcId: input.npcId,
    type: input.type,
    content: input.content,
    tags: input.tags,
    salience,
    mentions: 1,
    status: input.status,
    anchors,
    createdAt: input.timestamp,
    lastMentionedAt: input.timestamp,
  };
}

function formatTaskContent(phrase: string, tail: string) {
  const normalizedPhrase = phrase.toLowerCase();
  const verb = {
    "need to": "needs to",
    "have to": "has to",
    "gotta": "has to",
    must: "must",
    should: "should",
  }[normalizedPhrase];
  const resolved = verb ?? normalizedPhrase;
  return `Player ${resolved} ${tail}.`;
}

function formatRequestTaskContent(phrase: string, tail: string) {
  const normalized = phrase.toLowerCase();
  const usesWant = normalized.startsWith("i ") || normalized.startsWith("i'");
  const verb = usesWant ? "wants you to" : "asked you to";
  return `Player ${verb} ${tail}.`;
}

function isPreferenceRequest(text: string, match: { verb: string }) {
  if (match.verb !== "like") return false;
  return /\blike you to\b/.test(text);
}

function buildAnchors(tags: string[], rawText: string): MemoryAnchor[] {
  const anchors: MemoryAnchor[] = [];
  const seen = new Set<string>();

  const pushAnchor = (type: MemoryAnchor["type"], value: string) => {
    const normalized = normalizeTagValue(value);
    if (!normalized) return;
    const key = `${type}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    anchors.push({ type, value: normalized });
  };

  tags.forEach((tag) => {
    const [group, value] = splitTag(tag);
    if (!group || !value) return;
    switch (group) {
      case "person":
        pushAnchor("person", value);
        break;
      case "genre":
        pushAnchor("genre", value);
        break;
      case "activity":
        pushAnchor("activity", value);
        break;
      case "schedule":
        pushAnchor("time", value);
        break;
      case "place":
        pushAnchor("place", value);
        break;
      case "item":
        pushAnchor("item", value);
        break;
      case "project":
        pushAnchor("project", value);
        break;
      case "event":
        pushAnchor("event", value);
        break;
      case "goal":
        pushAnchor("goal", value);
        break;
      case "title":
        pushAnchor("title", value);
        break;
      case "task":
        pushAnchor("topic", value);
        break;
      default:
        break;
    }
  });

  if (anchors.length === 0) {
    const fallback = normalizeTagValue(rawText).split("-").slice(0, 5).join("-");
    if (fallback) {
      pushAnchor("topic", fallback);
    }
  }

  return anchors;
}

function scoreSalience(type: MemoryFactType, text: string) {
  const baseScores: Record<MemoryFactType, number> = {
    emotion: 0.55,
    preference: 0.48,
    relationship: 0.46,
    schedule: 0.4,
    goal: 0.44,
    task: 0.5,
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

function mergeLinks(existing?: MemoryLink[], incoming?: MemoryLink[]) {
  const merged = new Map<string, MemoryLink>();
  (existing ?? []).forEach((link) => {
    merged.set(`${link.targetId}:${link.label}`, link);
  });
  (incoming ?? []).forEach((link) => {
    merged.set(`${link.targetId}:${link.label}`, link);
  });
  return Array.from(merged.values());
}

function mergeAnchors(existing?: MemoryAnchor[], incoming?: MemoryAnchor[]) {
  const merged = new Map<string, MemoryAnchor>();
  (existing ?? []).forEach((anchor) => {
    merged.set(`${anchor.type}:${anchor.value}`, anchor);
  });
  (incoming ?? []).forEach((anchor) => {
    merged.set(`${anchor.type}:${anchor.value}`, anchor);
  });
  return Array.from(merged.values());
}

function assignThreadInfo(
  facts: MemoryFact[],
  existingFacts: MemoryFact[]
): MemoryFact[] {
  if (facts.length === 0) return facts;

  const maxSequences = new Map<string, number>();
  existingFacts.forEach((fact) => {
    if (!fact.threadId) return;
    const seq = fact.threadSequence ?? 1;
    const current = maxSequences.get(fact.threadId) ?? 0;
    if (seq > current) maxSequences.set(fact.threadId, seq);
  });

  const nextSequences = new Map<string, number>();
  return facts.map((fact) => {
    const threadKey = deriveThreadKey(fact.tags, fact.content);
    if (!threadKey) return fact;
    const threadId = `${fact.npcId}:${threadKey}`;
    const next =
      nextSequences.get(threadId) ?? (maxSequences.get(threadId) ?? 0) + 1;
    nextSequences.set(threadId, next);
    return {
      ...fact,
      threadId,
      threadSequence: next,
    };
  });
}

function attachMemoryLinks(
  incomingFacts: MemoryFact[],
  existingFacts: MemoryFact[]
): MemoryFact[] {
  if (incomingFacts.length === 0) return incomingFacts;
  const allFacts = [...existingFacts, ...incomingFacts];
  const anchorCache = new Map<string, Set<string>>();

  const getAnchorKeys = (fact: MemoryFact) => {
    if (anchorCache.has(fact.id)) {
      return anchorCache.get(fact.id) as Set<string>;
    }
    const anchors = fact.anchors ?? buildAnchors(fact.tags, fact.content);
    const keys = new Set(anchors.map((anchor) => `${anchor.type}:${anchor.value}`));
    anchorCache.set(fact.id, keys);
    return keys;
  };

  return incomingFacts.map((fact) => {
    const links: MemoryLink[] = [];
    const anchorKeys = getAnchorKeys(fact);
    const related = allFacts
      .filter((other) => other.id !== fact.id)
      .map((other) => {
        const otherKeys = getAnchorKeys(other);
        const overlap = countOverlap(anchorKeys, otherKeys);
        const isContext = fact.createdAt === other.createdAt;
        if (!isContext && overlap === 0) return null;
        const label = isContext ? "context" : chooseLinkLabel(fact, other);
        return { other, overlap, label };
      })
      .filter((candidate): candidate is { other: MemoryFact; overlap: number; label: string } => Boolean(candidate));

    related.sort((left, right) => {
      if (left.overlap !== right.overlap) return right.overlap - left.overlap;
      return right.other.lastMentionedAt.localeCompare(left.other.lastMentionedAt);
    });

    const limited = related.slice(0, 4);
    limited.forEach((candidate) => {
      links.push({ targetId: candidate.other.id, label: candidate.label });
    });

    const merged = mergeLinks(fact.links, links);
    return merged.length > 0 ? { ...fact, links: merged } : fact;
  });
}

function applyTaskCompletions(
  facts: MemoryFact[],
  incomingFacts: MemoryFact[]
): MemoryFact[] {
  const completionSignals = incomingFacts.filter((fact) => isCompletionFact(fact));
  if (completionSignals.length === 0) return facts;

  return facts.map((fact) => {
    if (fact.type !== "task" || fact.status === "done") return fact;
    const matches = completionSignals.some((signal) => hasAnchorOverlap(fact, signal));
    if (!matches) return fact;
    return { ...fact, status: "done" as const };
  });
}

function isCompletionFact(fact: MemoryFact) {
  if (fact.type !== "event") return false;
  const lowered = fact.content.toLowerCase();
  return (
    lowered.includes("finished") ||
    lowered.includes("completed") ||
    lowered.includes("wrapped up") ||
    lowered.includes("done")
  );
}

function hasAnchorOverlap(left: MemoryFact, right: MemoryFact) {
  const leftAnchors = new Set((left.anchors ?? []).map((anchor) => `${anchor.type}:${anchor.value}`));
  if (leftAnchors.size === 0) return false;
  const rightAnchors = new Set((right.anchors ?? []).map((anchor) => `${anchor.type}:${anchor.value}`));
  return countOverlap(leftAnchors, rightAnchors) > 0;
}

function countOverlap(left: Set<string>, right: Set<string>) {
  let count = 0;
  left.forEach((value) => {
    if (right.has(value)) count += 1;
  });
  return count;
}

function chooseLinkLabel(left: MemoryFact, right: MemoryFact) {
  const leftTypes = new Set((left.anchors ?? []).map((anchor) => anchor.type));
  const rightTypes = new Set((right.anchors ?? []).map((anchor) => anchor.type));

  if (leftTypes.has("title") && rightTypes.has("person")) return "created by";
  if (leftTypes.has("person") && rightTypes.has("title")) return "creator of";
  if (leftTypes.has("genre") && rightTypes.has("person")) return "artist in genre";
  if (leftTypes.has("person") && rightTypes.has("genre")) return "genre of artist";
  return "related to";
}

function deriveThreadKey(tags: string[], content: string) {
  const priorityGroups = [
    "task",
    "goal",
    "project",
    "event",
    "activity",
    "place",
    "person",
    "genre",
    "item",
    "title",
    "schedule",
  ];

  for (const group of priorityGroups) {
    const tag = tags.find((value) => value.startsWith(`${group}:`));
    if (!tag) continue;
    const [, rawValue] = splitTag(tag);
    if (!rawValue || rawValue === "general") continue;
    return `${group}:${rawValue}`;
  }

  const fallback = normalizeTagValue(content).split("-").slice(0, 5).join("-");
  if (!fallback) return null;
  return `topic:${fallback}`;
}

function buildTags(input: {
  type: MemoryFactType;
  rawText: string;
  npcId: string;
  dayIndex: number;
  detailTags?: string[];
}) {
  const tags = new Set<string>();
  tags.add(createTag("type", input.type));
  tags.add(createTag("day", String(input.dayIndex)));
  tags.add(createTag("npc", input.npcId));
  extractSemanticTags(input.rawText).forEach((tag) => tags.add(tag));
  input.detailTags?.forEach((tag) => tags.add(tag));
  return Array.from(tags);
}

function extractSemanticTags(text: string) {
  const lowered = text.toLowerCase();
  const personTags = collectPersonTags(text);
  const titleTags = collectTitleTags(text, personTags);
  const tags = [
    ...collectLexiconTags(lowered, placeLexicon, "place"),
    ...collectLexiconTags(lowered, personLexicon, "person"),
    ...collectLexiconTags(lowered, projectLexicon, "project"),
    ...collectLexiconTags(lowered, activityLexicon, "activity"),
    ...collectLexiconTags(lowered, materialLexicon, "material"),
    ...collectLexiconTags(lowered, toolLexicon, "tool"),
    ...collectLexiconTags(lowered, plantLexicon, "plant"),
    ...collectLexiconTags(lowered, productLexicon, "product"),
    ...collectGenreTags(lowered),
    ...personTags,
    ...titleTags,
  ];
  return Array.from(new Set(tags));
}

function collectLexiconTags(text: string, lexicon: LexiconEntry[], group: string) {
  const matches: string[] = [];
  lexicon.forEach((entry) => {
    const hasMatch = entry.aliases.some((alias) => text.includes(alias));
    if (hasMatch) {
      matches.push(createTag(group, entry.value));
    }
  });
  return matches;
}

function collectGenreTags(text: string) {
  const matches: string[] = [];
  const regex = /\b([a-z]+(?:\s+[a-z]+)?)\s+music\b/g;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const value = match[0].trim();
    if (value) {
      matches.push(createTag("genre", value));
    }
    match = regex.exec(text);
  }
  return matches;
}

function collectPersonTags(text: string) {
  const matches: string[] = [];
  const regex = /\bby\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const value = match[1]?.trim();
    if (value && !isTimeWord(value)) {
      matches.push(createTag("person", value));
    }
    match = regex.exec(text);
  }
  return matches;
}

function collectTitleTags(text: string, personTags: string[]) {
  const matches: string[] = [];
  const stopTitles = new Set(["I", "Im", "I'm", "The"]);
  const personValues = new Set(personTags.map((tag) => splitTag(tag)[1] ?? ""));

  const quoteRegex = /\"([^\"]+)\"/g;
  let match: RegExpExecArray | null = quoteRegex.exec(text);
  while (match) {
    const value = match[1]?.trim();
    if (value) {
      matches.push(createTag("title", value));
    }
    match = quoteRegex.exec(text);
  }

  const titleRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  match = titleRegex.exec(text);
  while (match) {
    const value = match[1]?.trim();
    if (value && !stopTitles.has(value)) {
      const normalized = normalizeTagValue(value);
      if (!personValues.has(normalized)) {
        matches.push(createTag("title", value));
      }
    }
    match = titleRegex.exec(text);
  }

  return matches;
}

function isTimeWord(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized === "monday" ||
    normalized === "tuesday" ||
    normalized === "wednesday" ||
    normalized === "thursday" ||
    normalized === "friday" ||
    normalized === "saturday" ||
    normalized === "sunday" ||
    normalized === "today" ||
    normalized === "tomorrow"
  );
}

function createTag(group: string, value: string) {
  return `${group}:${normalizeTagValue(value)}`;
}

function splitTag(tag: string) {
  const [group, ...rest] = tag.split(":");
  if (!group || rest.length === 0) return [null, null] as const;
  return [group, rest.join(":")] as const;
}

function normalizeTagValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
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
