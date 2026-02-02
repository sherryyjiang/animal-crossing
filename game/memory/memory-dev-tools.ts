import type { MemoryAnchor, MemoryFact } from "./memory-types";

export const UNTHREADED_THREAD_ID = "unthreaded";

export interface MemoryGraphNode {
  id: string;
  npcId: string;
  type: MemoryFact["type"];
  content: string;
  status?: "open" | "done";
  threadId?: string;
  threadSequence?: number;
  anchors: MemoryAnchor[];
  linkCount: number;
  lastMentionedAt: string;
}

export interface MemoryGraphEdge {
  sourceId: string;
  targetId: string;
  label: string;
}

export interface MemoryGraph {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
}

export interface ThreadGroup {
  threadId: string;
  label: string;
  npcId: string | null;
  lastMentionedAt: string;
  facts: MemoryFact[];
  hasOpenTasks: boolean;
}

export function buildMemoryGraph(facts: MemoryFact[]): MemoryGraph {
  const sortedFacts = [...facts].sort((left, right) =>
    right.lastMentionedAt.localeCompare(left.lastMentionedAt)
  );
  const idSet = new Set(sortedFacts.map((fact) => fact.id));
  const edges: MemoryGraphEdge[] = [];
  const edgeKeys = new Set<string>();

  sortedFacts.forEach((fact) => {
    (fact.links ?? []).forEach((link) => {
      if (!idSet.has(link.targetId)) return;
      const key = `${fact.id}:${link.targetId}:${link.label}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push({
        sourceId: fact.id,
        targetId: link.targetId,
        label: link.label,
      });
    });
  });

  const linkCounts = new Map<string, number>();
  edges.forEach((edge) => {
    linkCounts.set(edge.sourceId, (linkCounts.get(edge.sourceId) ?? 0) + 1);
  });

  const nodes: MemoryGraphNode[] = sortedFacts.map((fact) => ({
    id: fact.id,
    npcId: fact.npcId,
    type: fact.type,
    content: fact.content,
    status: fact.status,
    threadId: fact.threadId,
    threadSequence: fact.threadSequence,
    anchors: fact.anchors ?? [],
    linkCount: linkCounts.get(fact.id) ?? 0,
    lastMentionedAt: fact.lastMentionedAt,
  }));

  return { nodes, edges };
}

export function groupFactsByThread(facts: MemoryFact[]): ThreadGroup[] {
  const groups = new Map<string, MemoryFact[]>();
  facts.forEach((fact) => {
    const threadId = fact.threadId ?? UNTHREADED_THREAD_ID;
    const list = groups.get(threadId) ?? [];
    list.push(fact);
    groups.set(threadId, list);
  });

  const result = Array.from(groups.entries()).map(([threadId, groupFacts]) => {
    const sortedFacts = [...groupFacts].sort((left, right) => {
      const leftSeq = left.threadSequence ?? Number.POSITIVE_INFINITY;
      const rightSeq = right.threadSequence ?? Number.POSITIVE_INFINITY;
      if (leftSeq !== rightSeq) return leftSeq - rightSeq;
      return left.createdAt.localeCompare(right.createdAt);
    });
    const lastMentionedAt = groupFacts.reduce((latest, fact) =>
      fact.lastMentionedAt > latest ? fact.lastMentionedAt : latest
    , groupFacts[0]?.lastMentionedAt ?? "");
    const hasOpenTasks = groupFacts.some(
      (fact) => fact.type === "task" && fact.status !== "done"
    );

    return {
      threadId,
      label: formatThreadLabel(threadId),
      npcId: threadId === UNTHREADED_THREAD_ID ? null : parseThreadNpc(threadId),
      lastMentionedAt,
      facts: sortedFacts,
      hasOpenTasks,
    };
  });

  return result.sort((left, right) => right.lastMentionedAt.localeCompare(left.lastMentionedAt));
}

function parseThreadNpc(threadId: string) {
  const [npcId] = threadId.split(":");
  return npcId ?? null;
}

function formatThreadLabel(threadId: string) {
  if (threadId === UNTHREADED_THREAD_ID) return "Unthreaded";
  const parts = threadId.split(":").slice(1);
  const label = parts.join(" ").replace(/-/g, " ").trim();
  return label || "Thread";
}
