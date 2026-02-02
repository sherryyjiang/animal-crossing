import type { MemoryFact } from "./memory/memory-types";
import { getNpcRoster } from "./npc-roster";

type NpcRosterEntry = ReturnType<typeof getNpcRoster>[number];

export interface DayHighlight {
  npcId: string;
  npcName: string;
  npcRole: string;
  summary: string;
  tags: string[];
}

export interface DaySuggestion {
  title: string;
  detail: string;
  sourceTag?: string;
}

export function buildDayHighlights(
  facts: MemoryFact[],
  roster: NpcRosterEntry[],
  dayIndex: number
): DayHighlight[] {
  const dayTag = `day:${dayIndex}`;
  const factsForDay = facts.filter((fact) => fact.tags.includes(dayTag));
  const topFactByNpc = new Map<string, MemoryFact>();

  factsForDay.forEach((fact) => {
    const existing = topFactByNpc.get(fact.npcId);
    if (!existing) {
      topFactByNpc.set(fact.npcId, fact);
      return;
    }
    if (fact.salience > existing.salience) {
      topFactByNpc.set(fact.npcId, fact);
      return;
    }
    if (fact.lastMentionedAt > existing.lastMentionedAt) {
      topFactByNpc.set(fact.npcId, fact);
    }
  });

  return roster
    .filter((npc) => topFactByNpc.has(npc.id))
    .map((npc) => {
      const fact = topFactByNpc.get(npc.id) as MemoryFact;
      return {
        npcId: npc.id,
        npcName: npc.name,
        npcRole: npc.role,
        summary: fact.content,
        tags: fact.tags,
      };
    });
}

export function buildDaySuggestionFallbacks(
  facts: MemoryFact[],
  dayIndex: number,
  limit = 3
): DaySuggestion[] {
  const dayTag = `day:${dayIndex}`;
  const factsForDay = facts.filter((fact) => fact.tags.includes(dayTag));
  const suggestions: DaySuggestion[] = [];
  const seen = new Set<string>();

  const priorityGroups = ["goal", "project", "activity", "place", "plant", "item"];

  factsForDay.forEach((fact) => {
    fact.tags.forEach((tag) => {
      const [group, rawValue] = splitTag(tag);
      if (!group || !rawValue) return;
      if (!priorityGroups.includes(group)) return;
      const sourceTag = `${group}:${rawValue}`;
      if (seen.has(sourceTag)) return;
      const suggestion = buildSuggestionFromTag(group, rawValue);
      if (!suggestion) return;
      suggestions.push({ ...suggestion, sourceTag });
      seen.add(sourceTag);
    });
  });

  const ordered = priorityGroups.flatMap((group) =>
    suggestions.filter((suggestion) => suggestion.sourceTag?.startsWith(`${group}:`))
  );

  return ordered.slice(0, limit);
}

function splitTag(tag: string) {
  const [group, ...rest] = tag.split(":");
  if (!group || rest.length === 0) return [null, null] as const;
  return [group, rest.join(":")] as const;
}

function buildSuggestionFromTag(group: string, value: string): DaySuggestion | null {
  const humanized = humanizeTagValue(value);
  switch (group) {
    case "goal":
      return {
        title: "Resume a goal",
        detail: `Pick up where you left off: ${humanized}.`,
      };
    case "project":
      return {
        title: "Advance a project",
        detail: `Spend time moving the ${humanized} project forward.`,
      };
    case "activity":
      return {
        title: "Plan an activity",
        detail: `Make room today for more ${humanized}.`,
      };
    case "place":
      return {
        title: "Revisit a place",
        detail: `Swing by the ${humanized} for a quick check-in.`,
      };
    case "plant":
      return {
        title: "Tend the garden",
        detail: `Check on the ${humanized} and note its progress.`,
      };
    case "item":
      return {
        title: "Gather supplies",
        detail: `See if you still need ${humanized} for today’s tasks.`,
      };
    default:
      return null;
  }
}

function humanizeTagValue(value: string) {
  return value.replace(/-/g, " ").trim();
}
