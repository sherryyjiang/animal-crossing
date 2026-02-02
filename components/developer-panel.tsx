"use client";

import debug from "debug";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getDayCycleState, initializeDayCycle, onDayCycleChange } from "../game/day-cycle";
import type { ConversationEntry } from "../game/logs/conversation-log";
import { getConversationEntries, initializeConversationLog } from "../game/logs/conversation-log";
import type { MemoryFact } from "../game/memory/memory-types";
import {
  buildMemoryGraph,
  groupFactsByThread,
  UNTHREADED_THREAD_ID,
  type MemoryGraphEdge,
} from "../game/memory/memory-dev-tools";
import { getMemoryFacts, initializeMemoryStore } from "../game/memory/memory-store";
import { getNpcById, getNpcRoster } from "../game/npc-roster";
import type { SyntheticChatResult } from "../game/synthetic-chat";
import { runSyntheticChatHarness } from "../game/synthetic-chat";

const log = debug("ralph:dev-panel");

const DEV_PANEL_VIEWS = [
  { id: "facts", label: "Facts" },
  { id: "relationships", label: "Relationships" },
  { id: "threads", label: "Threads" },
  { id: "conversation", label: "Conversation" },
] as const;

type DeveloperView = (typeof DEV_PANEL_VIEWS)[number]["id"];

export function DeveloperPanel(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DeveloperSnapshot>(createEmptySnapshot());
  const [filters, setFilters] = useState<DeveloperFilters>({
    selectedDay: "all",
    selectedNpcId: "all",
  });
  const [harnessState, setHarnessState] = useState<SyntheticChatState>({
    isRunning: false,
    lastResult: null,
    lastError: null,
  });
  const [activeView, setActiveView] = useState<DeveloperView>("facts");
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const npcRoster = useMemo(() => getNpcRoster(), []);
  const dayOptions = useMemo(
    () => getDayOptions(snapshot.entries, snapshot.dayState.dayIndex),
    [snapshot.entries, snapshot.dayState.dayIndex]
  );
  const filteredEntries = useMemo(
    () => filterEntries(snapshot.entries, filters),
    [snapshot.entries, filters]
  );
  const filteredFacts = useMemo(
    () => filterFacts(snapshot.memoryFacts, filters),
    [snapshot.memoryFacts, filters]
  );
  const memoryGraph = useMemo(() => buildMemoryGraph(filteredFacts), [filteredFacts]);
  const threadGroups = useMemo(() => groupFactsByThread(filteredFacts), [filteredFacts]);
  const factById = useMemo(
    () => new Map(filteredFacts.map((fact) => [fact.id, fact])),
    [filteredFacts]
  );
  const threadLabelById = useMemo(
    () => new Map(threadGroups.map((group) => [group.threadId, group.label])),
    [threadGroups]
  );
  const edgesBySource = useMemo(
    () => groupEdges(memoryGraph.edges, "sourceId"),
    [memoryGraph.edges]
  );
  const edgesByTarget = useMemo(
    () => groupEdges(memoryGraph.edges, "targetId"),
    [memoryGraph.edges]
  );
  const selectedFact = selectedMemoryId ? factById.get(selectedMemoryId) ?? null : null;

  useEffect(() => {
    let isMounted = true;
    void initializeDeveloperStores()
      .then(() => {
        if (!isMounted) return;
        setSnapshot(buildSnapshot());
      })
      .catch((error) => {
        log("Failed to init dev panel stores %o", { error });
      });

    const unsubscribe = onDayCycleChange(() => {
      setSnapshot(buildSnapshot());
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (filters.selectedDay !== "all" && !dayOptions.includes(filters.selectedDay)) {
      setFilters((current) => ({
        ...current,
        selectedDay: dayOptions[0] ?? "all",
      }));
    }
  }, [dayOptions, filters.selectedDay]);

  useEffect(() => {
    if (!selectedMemoryId) return;
    if (factById.has(selectedMemoryId)) return;
    setSelectedMemoryId(null);
  }, [factById, selectedMemoryId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    if (threadGroups.some((group) => group.threadId === selectedThreadId)) return;
    setSelectedThreadId(null);
  }, [threadGroups, selectedThreadId]);

  function handleToggle() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      setSnapshot(buildSnapshot());
    }
  }

  function handleRefresh() {
    setSnapshot(buildSnapshot());
  }

  function handleHarnessRun(mode: SyntheticHarnessMode) {
    if (harnessState.isRunning) return;
    setHarnessState((current) => ({ ...current, isRunning: true, lastError: null }));
    void runSyntheticChatHarness({ reset: mode === "reset" })
      .then((result) => {
        setSnapshot(buildSnapshot());
        setHarnessState({ isRunning: false, lastResult: result, lastError: null });
      })
      .catch((error) => {
        log("Synthetic chat harness failed %o", { error });
        setHarnessState({ isRunning: false, lastResult: null, lastError: "Failed to seed synthetic chat." });
      });
  }

  function handleDayChange(value: string) {
    setFilters((current) => ({
      ...current,
      selectedDay: value === "all" ? "all" : Number(value),
    }));
  }

  function handleNpcChange(value: string) {
    setFilters((current) => ({
      ...current,
      selectedNpcId: value,
    }));
  }

  function handleViewChange(view: DeveloperView) {
    setActiveView(view);
    setSelectedMemoryId(null);
    setSelectedThreadId(null);
  }

  function handleMemorySelect(id: string) {
    setSelectedMemoryId(id);
  }

  function handleThreadToggle(threadId: string) {
    setSelectedThreadId((current) => (current === threadId ? null : threadId));
  }

  if (!snapshot.isReady) return null;

  return (
    <div className="dev-panel-root">
      <button type="button" className="dev-panel-toggle" onClick={handleToggle}>
        {isOpen ? "Close Dev Panel" : "Open Dev Panel"}
      </button>
      {isOpen ? (
        <div className="dev-panel">
          <div className="dev-panel-header">
            <div>
              <div className="dev-panel-title">Developer Panel</div>
              <div className="dev-panel-subtitle">
                Day {snapshot.dayState.dayIndex} · Visits {snapshot.dayState.visitedNpcIds.length}/
                {npcRoster.length}
              </div>
            </div>
            <button type="button" className="dev-panel-action" onClick={handleRefresh}>
              Refresh
            </button>
          </div>
          <div className="dev-panel-filters">
            <label className="dev-panel-filter">
              <span>Day</span>
              <select
                value={filters.selectedDay === "all" ? "all" : String(filters.selectedDay)}
                onChange={(event) => handleDayChange(event.target.value)}
              >
                <option value="all">All</option>
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    Day {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="dev-panel-filter">
              <span>NPC</span>
              <select value={filters.selectedNpcId} onChange={(event) => handleNpcChange(event.target.value)}>
                <option value="all">All</option>
                {npcRoster.map((npc) => (
                  <option key={npc.id} value={npc.id}>
                    {npc.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="dev-panel-tabs">
            {DEV_PANEL_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                className={`dev-panel-tab ${activeView === view.id ? "is-active" : ""}`}
                onClick={() => handleViewChange(view.id)}
              >
                {view.label}
              </button>
            ))}
          </div>
          <div className="dev-panel-body">
            <DeveloperPanelSection title="Synthetic Chat Harness">
              <div className="dev-panel-harness">
                <div className="dev-panel-harness-actions">
                  <button
                    type="button"
                    className="dev-panel-action dev-panel-harness-button"
                    onClick={() => handleHarnessRun("append")}
                    disabled={harnessState.isRunning}
                  >
                    Seed Synthetic Chat
                  </button>
                  <button
                    type="button"
                    className="dev-panel-action dev-panel-harness-button"
                    onClick={() => handleHarnessRun("reset")}
                    disabled={harnessState.isRunning}
                  >
                    Reset + Seed
                  </button>
                </div>
                {harnessState.lastResult ? (
                  <div className="dev-panel-harness-meta">
                    Seeded day {harnessState.lastResult.dayIndex} · Entries{" "}
                    {harnessState.lastResult.totalEntries} · Facts{" "}
                    {harnessState.lastResult.totalFactsAdded}
                  </div>
                ) : null}
                {harnessState.lastResult ? (
                  <div className="dev-panel-harness-grid">
                    {harnessState.lastResult.perNpcResults.map((result) => {
                      const npc = getNpcById(result.npcId);
                      return (
                        <div key={result.npcId} className="dev-panel-harness-card">
                          <div className="dev-panel-harness-title">{npc?.name ?? result.npcId}</div>
                          <div className="dev-panel-harness-subtitle">
                            Entries {result.entryCount} · Facts {result.factsAdded}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {harnessState.lastError ? (
                  <div className="dev-panel-error">{harnessState.lastError}</div>
                ) : null}
              </div>
            </DeveloperPanelSection>
            {activeView === "conversation" ? (
              <DeveloperPanelSection title={`Conversation Log (${filteredEntries.length})`}>
                {filteredEntries.length === 0 ? (
                  <div className="dev-panel-empty">No entries yet.</div>
                ) : (
                  <div className="dev-panel-list">
                    {filteredEntries.map((entry) => {
                      const npc = getNpcById(entry.npcId);
                      return (
                        <div key={entry.id} className="dev-panel-item">
                          <div className="dev-panel-item-meta">
                            <span>Day {entry.dayIndex}</span>
                            <span>{npc?.name ?? entry.npcId}</span>
                            <span>{entry.speaker === "player" ? "Player" : "NPC"}</span>
                            <span>{formatTimestamp(entry.timestamp)}</span>
                          </div>
                          <div className="dev-panel-item-text">{entry.text}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </DeveloperPanelSection>
            ) : null}
            {activeView === "facts" ? (
              <DeveloperPanelSection title={`Memory Facts (${filteredFacts.length})`}>
                {filteredFacts.length === 0 ? (
                  <div className="dev-panel-empty">No memory facts yet.</div>
                ) : (
                  <div className="dev-panel-list">
                    {filteredFacts.map((fact) => {
                      const npc = getNpcById(fact.npcId);
                      const threadLabel = fact.threadId
                        ? threadLabelById.get(fact.threadId) ?? fact.threadId
                        : null;
                      const isSelected = selectedMemoryId === fact.id;
                      return (
                        <div key={fact.id} className={`dev-panel-item ${isSelected ? "is-selected" : ""}`}>
                          <div className="dev-panel-item-meta">
                            <span>{npc?.name ?? fact.npcId}</span>
                            <span>{fact.type}</span>
                            {fact.status ? <span>Status {fact.status}</span> : null}
                            {threadLabel ? <span>Thread {threadLabel}</span> : null}
                            {fact.threadSequence ? <span>Step {fact.threadSequence}</span> : null}
                            <span>Strength {fact.salience.toFixed(2)}</span>
                            <span>Mentions {fact.mentions}</span>
                            <span>{formatTimestamp(fact.createdAt)}</span>
                          </div>
                          <div className="dev-panel-item-text">{fact.content}</div>
                          {fact.tags.length > 0 ? (
                            <div className="dev-panel-tags">
                              {fact.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="dev-panel-tag"
                                  data-tag-group={getTagGroup(tag)}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {fact.anchors && fact.anchors.length > 0 ? (
                            <div className="dev-panel-tags dev-panel-anchors">
                              {fact.anchors.map((anchor) => (
                                <span
                                  key={`${fact.id}-${anchor.type}-${anchor.value}`}
                                  className="dev-panel-tag dev-panel-anchor"
                                  data-tag-group={anchor.type}
                                >
                                  {anchor.type}:{anchor.value}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {fact.links && fact.links.length > 0 ? (
                            <div className="dev-panel-links">
                              {fact.links.map((link) => {
                                const target = factById.get(link.targetId);
                                return (
                                  <button
                                    key={`${fact.id}-${link.targetId}-${link.label}`}
                                    type="button"
                                    className="dev-panel-link"
                                    onClick={() => handleMemorySelect(link.targetId)}
                                  >
                                    <span className="dev-panel-link-label">{link.label}</span>
                                    <span className="dev-panel-link-text">
                                      {truncateText(target?.content ?? link.targetId, 64)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </DeveloperPanelSection>
            ) : null}
            {activeView === "relationships" ? (
              <DeveloperPanelSection title={`Memory Relationships (${memoryGraph.edges.length})`}>
                {memoryGraph.nodes.length === 0 ? (
                  <div className="dev-panel-empty">No memories to map yet.</div>
                ) : (
                  <div className="dev-panel-graph">
                    <div className="dev-panel-graph-summary">
                      <div>Nodes {memoryGraph.nodes.length}</div>
                      <div>Edges {memoryGraph.edges.length}</div>
                      <div>Threads {threadGroups.length}</div>
                    </div>
                    <div className="dev-panel-graph-rows">
                      {memoryGraph.nodes.map((node) => {
                        const npc = getNpcById(node.npcId);
                        const edges = edgesBySource.get(node.id) ?? [];
                        const inbound = edgesByTarget.get(node.id) ?? [];
                        const isSelected = selectedMemoryId === node.id;
                        const isLinkedToSelected =
                          selectedMemoryId &&
                          (edges.some((edge) => edge.targetId === selectedMemoryId) ||
                            inbound.some((edge) => edge.sourceId === selectedMemoryId));
                        const threadLabel = node.threadId
                          ? threadLabelById.get(node.threadId) ?? node.threadId
                          : null;
                        return (
                          <div
                            key={node.id}
                            className={`dev-panel-graph-row ${isSelected ? "is-selected" : ""} ${
                              isLinkedToSelected ? "is-linked" : ""
                            }`}
                          >
                            <button
                              type="button"
                              className="dev-panel-node"
                              onClick={() => handleMemorySelect(node.id)}
                            >
                              <div className="dev-panel-node-meta">
                                <span>{npc?.name ?? node.npcId}</span>
                                <span>{node.type}</span>
                                {node.status ? <span>Status {node.status}</span> : null}
                                {threadLabel ? <span>{threadLabel}</span> : null}
                                {node.threadSequence ? <span>Step {node.threadSequence}</span> : null}
                              </div>
                              <div className="dev-panel-node-title">{node.content}</div>
                              <div className="dev-panel-node-footer">
                                <span>Links {edges.length}</span>
                                <span>Inbound {inbound.length}</span>
                                <span>{formatTimestamp(node.lastMentionedAt)}</span>
                              </div>
                              {node.anchors.length > 0 ? (
                                <div className="dev-panel-tags dev-panel-anchors">
                                  {node.anchors.map((anchor) => (
                                    <span
                                      key={`${node.id}-${anchor.type}-${anchor.value}`}
                                      className="dev-panel-tag dev-panel-anchor"
                                      data-tag-group={anchor.type}
                                    >
                                      {anchor.type}:{anchor.value}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </button>
                            <div className="dev-panel-graph-links">
                              {edges.length === 0 ? (
                                <div className="dev-panel-empty">No links</div>
                              ) : (
                                edges.map((edge) => {
                                  const target = factById.get(edge.targetId);
                                  const isEdgeSelected = selectedMemoryId === edge.targetId;
                                  return (
                                    <button
                                      key={`${edge.sourceId}-${edge.targetId}-${edge.label}`}
                                      type="button"
                                      className={`dev-panel-link dev-panel-link-card ${
                                        isEdgeSelected ? "is-selected" : ""
                                      }`}
                                      onClick={() => handleMemorySelect(edge.targetId)}
                                    >
                                      <span className="dev-panel-link-label">{edge.label}</span>
                                      <span className="dev-panel-link-text">
                                        {truncateText(target?.content ?? edge.targetId, 72)}
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="dev-panel-detail">
                      {selectedFact ? (
                        <>
                          <div className="dev-panel-detail-title">Selected Memory</div>
                          <div className="dev-panel-detail-text">{selectedFact.content}</div>
                          <div className="dev-panel-detail-meta">
                            <span>{selectedFact.type}</span>
                            {selectedFact.status ? <span>Status {selectedFact.status}</span> : null}
                            {selectedFact.threadId ? (
                              <span>{threadLabelById.get(selectedFact.threadId) ?? selectedFact.threadId}</span>
                            ) : null}
                            {selectedFact.threadSequence ? <span>Step {selectedFact.threadSequence}</span> : null}
                          </div>
                          <div className="dev-panel-detail-grid">
                            <div>
                              <div className="dev-panel-detail-label">Outbound</div>
                              <div className="dev-panel-detail-list">
                                {(edgesBySource.get(selectedFact.id) ?? []).length === 0
                                  ? "None"
                                  : (edgesBySource.get(selectedFact.id) ?? []).map((edge) => {
                                      const target = factById.get(edge.targetId);
                                      return (
                                        <button
                                          key={`out-${edge.targetId}-${edge.label}`}
                                          type="button"
                                          className="dev-panel-detail-link"
                                          onClick={() => handleMemorySelect(edge.targetId)}
                                        >
                                          {edge.label}: {truncateText(target?.content ?? edge.targetId, 64)}
                                        </button>
                                      );
                                    })}
                              </div>
                            </div>
                            <div>
                              <div className="dev-panel-detail-label">Inbound</div>
                              <div className="dev-panel-detail-list">
                                {(edgesByTarget.get(selectedFact.id) ?? []).length === 0
                                  ? "None"
                                  : (edgesByTarget.get(selectedFact.id) ?? []).map((edge) => {
                                      const source = factById.get(edge.sourceId);
                                      return (
                                        <button
                                          key={`in-${edge.sourceId}-${edge.label}`}
                                          type="button"
                                          className="dev-panel-detail-link"
                                          onClick={() => handleMemorySelect(edge.sourceId)}
                                        >
                                          {edge.label}: {truncateText(source?.content ?? edge.sourceId, 64)}
                                        </button>
                                      );
                                    })}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="dev-panel-empty">Select a memory node to inspect links.</div>
                      )}
                    </div>
                  </div>
                )}
              </DeveloperPanelSection>
            ) : null}
            {activeView === "threads" ? (
              <DeveloperPanelSection title={`Threads (${threadGroups.length})`}>
                {threadGroups.length === 0 ? (
                  <div className="dev-panel-empty">No threads yet.</div>
                ) : (
                  <div className="dev-panel-thread-grid">
                    {threadGroups.map((group) => {
                      const npc = group.npcId ? getNpcById(group.npcId) : null;
                      const isOpen = selectedThreadId === group.threadId;
                      const isUnthreaded = group.threadId === UNTHREADED_THREAD_ID;
                      return (
                        <div
                          key={group.threadId}
                          className={`dev-panel-thread-card ${isOpen ? "is-open" : ""}`}
                        >
                          <button
                            type="button"
                            className="dev-panel-thread-header"
                            onClick={() => handleThreadToggle(group.threadId)}
                          >
                            <div>
                              <div className="dev-panel-thread-title">{group.label}</div>
                              <div className="dev-panel-thread-meta">
                                {npc?.name ?? (isUnthreaded ? "Unassigned" : group.npcId ?? "Unknown")}
                                {" · "}
                                {group.facts.length} memories
                                {" · "}
                                {formatTimestamp(group.lastMentionedAt)}
                              </div>
                            </div>
                            {group.hasOpenTasks ? (
                              <span className="dev-panel-thread-badge">Open task</span>
                            ) : null}
                          </button>
                          {isOpen ? (
                            <div className="dev-panel-thread-timeline">
                              {group.facts.map((fact) => {
                                const factNpc = getNpcById(fact.npcId);
                                return (
                                  <button
                                    key={fact.id}
                                    type="button"
                                    className={`dev-panel-thread-step ${
                                      selectedMemoryId === fact.id ? "is-selected" : ""
                                    }`}
                                    onClick={() => handleMemorySelect(fact.id)}
                                  >
                                    <div className="dev-panel-thread-seq">
                                      {fact.threadSequence ?? "•"}
                                    </div>
                                    <div className="dev-panel-thread-content">
                                      <div className="dev-panel-thread-text">{fact.content}</div>
                                      <div className="dev-panel-thread-meta">
                                        {factNpc?.name ?? fact.npcId}
                                        {" · "}
                                        {fact.type}
                                        {fact.status ? ` · ${fact.status}` : ""}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </DeveloperPanelSection>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DeveloperPanelSection({ title, children }: DeveloperPanelSectionProps): JSX.Element {
  return (
    <section className="dev-panel-section">
      <div className="dev-panel-section-title">{title}</div>
      {children}
    </section>
  );
}

async function initializeDeveloperStores() {
  await Promise.all([initializeConversationLog(), initializeMemoryStore(), initializeDayCycle()]);
}

function buildSnapshot(): DeveloperSnapshot {
  return {
    isReady: true,
    dayState: getDayCycleState(),
    entries: getConversationEntries().slice().sort(sortEntriesByTime),
    memoryFacts: getMemoryFacts().slice().sort(sortFactsByCreatedAt),
  };
}

function createEmptySnapshot(): DeveloperSnapshot {
  return {
    isReady: false,
    dayState: { dayIndex: 1, visitedNpcIds: [] },
    entries: [],
    memoryFacts: [],
  };
}

function getDayOptions(entries: ConversationEntry[], currentDay: number) {
  const days = new Set(entries.map((entry) => entry.dayIndex));
  days.add(currentDay);
  return Array.from(days).sort((a, b) => a - b);
}

function filterEntries(entries: ConversationEntry[], filters: DeveloperFilters) {
  return entries.filter((entry) => {
    if (filters.selectedDay !== "all" && entry.dayIndex !== filters.selectedDay) return false;
    if (filters.selectedNpcId !== "all" && entry.npcId !== filters.selectedNpcId) return false;
    return true;
  });
}

function filterFacts(facts: MemoryFact[], filters: DeveloperFilters) {
  return facts.filter((fact) => {
    if (filters.selectedDay !== "all" && !fact.tags.includes(`day:${filters.selectedDay}`)) {
      return false;
    }
    if (filters.selectedNpcId !== "all" && fact.npcId !== filters.selectedNpcId) return false;
    return true;
  });
}

function sortEntriesByTime(a: ConversationEntry, b: ConversationEntry) {
  return a.timestamp.localeCompare(b.timestamp);
}

function sortFactsByCreatedAt(a: MemoryFact, b: MemoryFact) {
  return b.createdAt.localeCompare(a.createdAt);
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getTagGroup(tag: string) {
  const [group] = tag.split(":");
  return group || "misc";
}

function groupEdges(edges: MemoryGraphEdge[], key: "sourceId" | "targetId") {
  const grouped = new Map<string, MemoryGraphEdge[]>();
  edges.forEach((edge) => {
    const bucket = grouped.get(edge[key]) ?? [];
    bucket.push(edge);
    grouped.set(edge[key], bucket);
  });
  return grouped;
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

interface DeveloperPanelSectionProps {
  title: string;
  children: ReactNode;
}

interface DeveloperFilters {
  selectedDay: number | "all";
  selectedNpcId: string;
}

interface DeveloperSnapshot {
  isReady: boolean;
  dayState: DayStateSnapshot;
  entries: ConversationEntry[];
  memoryFacts: MemoryFact[];
}

interface DayStateSnapshot {
  dayIndex: number;
  visitedNpcIds: string[];
}

type SyntheticHarnessMode = "append" | "reset";

interface SyntheticChatState {
  isRunning: boolean;
  lastResult: SyntheticChatResult | null;
  lastError: string | null;
}
