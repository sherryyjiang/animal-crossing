"use client";

import debug from "debug";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getDayCycleState, initializeDayCycle, onDayCycleChange } from "../game/day-cycle";
import type { ConversationEntry } from "../game/logs/conversation-log";
import { getConversationEntries, initializeConversationLog } from "../game/logs/conversation-log";
import type { MemoryFact } from "../game/memory/memory-types";
import { getMemoryFacts, initializeMemoryStore } from "../game/memory/memory-store";
import { getNpcById, getNpcRoster } from "../game/npc-roster";

const log = debug("ralph:dev-panel");

export function DeveloperPanel(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DeveloperSnapshot>(createEmptySnapshot());
  const [filters, setFilters] = useState<DeveloperFilters>({
    selectedDay: "all",
    selectedNpcId: "all",
  });

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
          <div className="dev-panel-body">
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
            <DeveloperPanelSection title={`Memory Facts (${filteredFacts.length})`}>
              {filteredFacts.length === 0 ? (
                <div className="dev-panel-empty">No memory facts yet.</div>
              ) : (
                <div className="dev-panel-list">
                  {filteredFacts.map((fact) => {
                    const npc = getNpcById(fact.npcId);
                    return (
                      <div key={fact.id} className="dev-panel-item">
                        <div className="dev-panel-item-meta">
                          <span>{npc?.name ?? fact.npcId}</span>
                          <span>{fact.type}</span>
                          <span>Salience {fact.salience}</span>
                          <span>{formatTimestamp(fact.createdAt)}</span>
                        </div>
                        <div className="dev-panel-item-text">{fact.content}</div>
                        {fact.tags.length > 0 ? (
                          <div className="dev-panel-tags">
                            {fact.tags.map((tag) => (
                              <span key={tag} className="dev-panel-tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </DeveloperPanelSection>
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
