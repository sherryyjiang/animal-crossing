"use client";

import debug from "debug";
import { useEffect, useState } from "react";
import {
  getDayCycleState,
  getRequiredNpcIds,
  initializeDayCycle,
  isDayComplete,
  onDayCycleChange,
  startNewDay,
} from "../game/day-cycle";
import { getEntriesForDay, initializeConversationLog } from "../game/logs/conversation-log";
import { getMemoryFacts, initializeMemoryStore } from "../game/memory/memory-store";
import {
  buildDayHighlights,
  buildDaySuggestionFallbacks,
  type DayHighlight,
  type DaySuggestion,
} from "../game/day-summary-model";
import { loadDaySummary, saveDaySummary } from "../game/day-summary-store";
import {
  loadPlayerProfile,
  mergePlayerProfile,
  savePlayerProfile,
  type PlayerInsightSeed,
} from "../game/memory/player-profile";
import { llmAdapter } from "../game/llm/llm-adapter";
import type { LlmMessage } from "../game/llm/llm-types";
import { getNpcById, getNpcRoster } from "../game/npc-roster";

const log = debug("ralph:day-summary");

export function DayCycleOverlay() {
  const [dayState, setDayState] = useState(getDayCycleState());
  const [summaryState, setSummaryState] = useState<SummaryState>({
    isOpen: false,
    isLoading: false,
    summaryText: "",
    highlights: [],
    playerInsights: [],
    errorMessage: null,
  });
  const [kickoffState, setKickoffState] = useState<DayKickoffState>({
    isOpen: false,
    isLoading: false,
    dayIndex: 1,
    suggestions: [],
    errorMessage: null,
  });

  const requiredNpcIds = getRequiredNpcIds();
  const hasCompletedDay = isDayComplete(dayState);

  useEffect(() => {
    let isMounted = true;
    void initializeConversationLog();
    void initializeMemoryStore();
    void loadPlayerProfile();
    void initializeDayCycle().then(() => {
      if (isMounted) {
        setDayState(getDayCycleState());
      }
    });
    const unsubscribe = onDayCycleChange((state) => {
      setDayState(state);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  async function handleEndDay() {
    if (!hasCompletedDay || summaryState.isLoading) return;
    setSummaryState({
      isOpen: true,
      isLoading: true,
      summaryText: "",
      highlights: [],
      playerInsights: [],
      errorMessage: null,
    });

    try {
      const conversation = buildDaySummaryConversation(dayState.dayIndex);
      const [summaryResult, insightResult] = await Promise.all([
        llmAdapter.summarizeDay({
          dayIndex: dayState.dayIndex,
          conversation,
          maxParagraphs: 2,
        }),
        llmAdapter
          .analyzePlayer({
            dayIndex: dayState.dayIndex,
            conversation,
            maxInsights: 4,
          })
          .catch(() => ({ insights: [], raw: null })),
      ]);

      const playerInsights = (insightResult?.insights ?? []) as PlayerInsightSeed[];
      const highlights = buildDayHighlights(getMemoryFacts(), getNpcRoster(), dayState.dayIndex);
      const timestamp = new Date().toISOString();
      const profile = await loadPlayerProfile();
      const updatedProfile = mergePlayerProfile(profile, playerInsights, timestamp);

      await savePlayerProfile(updatedProfile);
      await saveDaySummary({
        dayIndex: dayState.dayIndex,
        summaryText: summaryResult.summary,
        playerInsights,
        createdAt: timestamp,
      });
      setSummaryState({
        isOpen: true,
        isLoading: false,
        summaryText: summaryResult.summary,
        highlights,
        playerInsights,
        errorMessage: null,
      });
    } catch (error) {
      log("Day summary failed %o", { error, dayIndex: dayState.dayIndex });
      setSummaryState({
        isOpen: true,
        isLoading: false,
        summaryText: "The village feels quiet tonight. You can still start a new day.",
        highlights: [],
        playerInsights: [],
        errorMessage: "Summary unavailable right now.",
      });
    }
  }

  async function handleStartNewDay() {
    const previousDayIndex = dayState.dayIndex;
    await startNewDay();
    setSummaryState({
      isOpen: false,
      isLoading: false,
      summaryText: "",
      highlights: [],
      playerInsights: [],
      errorMessage: null,
    });

    const newDayIndex = previousDayIndex + 1;
    setKickoffState({
      isOpen: true,
      isLoading: true,
      dayIndex: newDayIndex,
      suggestions: [],
      errorMessage: null,
    });

    const fallbackSuggestions = buildDaySuggestionFallbacks(
      getMemoryFacts(),
      previousDayIndex,
      4
    );

    try {
      const previousSummary = await loadDaySummary(previousDayIndex);
      const result = await llmAdapter.suggestNextDay({
        dayIndex: newDayIndex,
        previousSummary: previousSummary?.summaryText ?? "",
        playerInsights: previousSummary?.playerInsights ?? [],
        maxSuggestions: 4,
      });
      const suggestions = result.suggestions.length > 0 ? result.suggestions : fallbackSuggestions;
      setKickoffState({
        isOpen: true,
        isLoading: false,
        dayIndex: newDayIndex,
        suggestions,
        errorMessage: null,
      });
    } catch (error) {
      log("Day kickoff suggestions failed %o", { error, dayIndex: newDayIndex });
      setKickoffState({
        isOpen: true,
        isLoading: false,
        dayIndex: newDayIndex,
        suggestions: fallbackSuggestions,
        errorMessage: "Suggestions unavailable right now.",
      });
    }
  }

  function handleKickoffClose() {
    setKickoffState((current) => ({
      ...current,
      isOpen: false,
      isLoading: false,
      errorMessage: null,
    }));
  }

  if (requiredNpcIds.length === 0) return null;

  return (
    <>
      <div className="day-hud">
        <div className="day-hud-card">
          <div className="day-hud-title">Day {dayState.dayIndex}</div>
          <div className="day-hud-subtitle">
            Visits: {dayState.visitedNpcIds.length}/{requiredNpcIds.length}
          </div>
        </div>
        <button
          type="button"
          className="day-hud-action"
          onClick={handleEndDay}
          disabled={!hasCompletedDay || summaryState.isLoading}
        >
          End Day
        </button>
      </div>
      {summaryState.isOpen && (
        <div className="day-summary-overlay">
          <div className="day-summary-panel">
            <div className="day-summary-header">
              <div>
                <div className="day-summary-kicker">Day {dayState.dayIndex}</div>
                <div className="day-summary-title">Village Pulse</div>
                <div className="day-summary-subtitle">Highlights, progress, and learnings</div>
              </div>
              <div className="day-summary-avatars">
                {dayState.visitedNpcIds.map((npcId) => (
                  <NpcBadge key={npcId} npcId={npcId} />
                ))}
              </div>
            </div>
            {summaryState.isLoading ? (
              <div className="day-summary-loading">Gathering today&apos;s highlights...</div>
            ) : (
              <div className="day-summary-body">
                <section className="day-summary-section">
                  <div className="day-summary-section-title">Story Recap</div>
                  <div className="day-summary-text">{summaryState.summaryText}</div>
                </section>
                <section className="day-summary-section">
                  <div className="day-summary-section-title">Village Highlights</div>
                  <div className="day-summary-highlight-grid">
                    {summaryState.highlights.length === 0 ? (
                      <div className="day-summary-empty">No highlights recorded yet.</div>
                    ) : (
                      summaryState.highlights.map((highlight) => (
                        <div key={highlight.npcId} className="day-summary-highlight-card">
                          <div className="day-summary-highlight-header">
                            <NpcBadge npcId={highlight.npcId} />
                            <div className="day-summary-highlight-meta">
                              <div className="day-summary-highlight-name">{highlight.npcName}</div>
                              <div className="day-summary-highlight-role">{highlight.npcRole}</div>
                            </div>
                            <RoleIcon npcId={highlight.npcId} />
                          </div>
                          <div className="day-summary-highlight-text">{highlight.summary}</div>
                          {getHighlightTags(highlight.tags).length > 0 ? (
                            <div className="day-summary-highlight-tags">
                              {getHighlightTags(highlight.tags).map((tag) => (
                                <span
                                  key={tag}
                                  className="day-summary-tag"
                                  data-tag-group={getTagGroup(tag)}
                                >
                                  {formatTagLabel(tag)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </section>
                <section className="day-summary-section">
                  <div className="day-summary-section-title">Player Learnings</div>
                  <div className="day-summary-insights">
                    {summaryState.playerInsights.length === 0 ? (
                      <div className="day-summary-empty">Still getting to know you.</div>
                    ) : (
                      summaryState.playerInsights.map((insight, index) => (
                        <div
                          key={`${insight.category}-${index}`}
                          className="day-summary-insight"
                          data-category={insight.category}
                        >
                          <InsightIcon category={insight.category} />
                          <span>{insight.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
            {summaryState.errorMessage && (
              <div className="day-summary-error">{summaryState.errorMessage}</div>
            )}
            <div className="day-summary-footer">
              <button
                type="button"
                className="day-summary-action"
                onClick={handleStartNewDay}
                disabled={summaryState.isLoading}
              >
                Start New Day
              </button>
            </div>
          </div>
        </div>
      )}
      {kickoffState.isOpen && (
        <div className="day-kickoff-overlay">
          <div className="day-kickoff-panel">
            <div className="day-kickoff-header">
              <div>
                <div className="day-kickoff-kicker">Day {kickoffState.dayIndex}</div>
                <div className="day-kickoff-title">Morning Brief</div>
                <div className="day-kickoff-subtitle">Based on yesterday&apos;s momentum</div>
              </div>
              <div className="day-kickoff-icon">
                <SparkIcon />
              </div>
            </div>
            {kickoffState.isLoading ? (
              <div className="day-kickoff-loading">Sketching new ideas for today...</div>
            ) : (
              <div className="day-kickoff-grid">
                {kickoffState.suggestions.length === 0 ? (
                  <div className="day-kickoff-empty">No suggestions ready yet.</div>
                ) : (
                  kickoffState.suggestions.map((suggestion, index) => (
                    <div key={`${suggestion.title}-${index}`} className="day-kickoff-card">
                      <div className="day-kickoff-card-title">{suggestion.title}</div>
                      <div className="day-kickoff-card-detail">{suggestion.detail}</div>
                    </div>
                  ))
                )}
              </div>
            )}
            {kickoffState.errorMessage ? (
              <div className="day-kickoff-error">{kickoffState.errorMessage}</div>
            ) : null}
            <button type="button" className="day-kickoff-action" onClick={handleKickoffClose}>
              Begin Day
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function buildDaySummaryConversation(dayIndex: number): LlmMessage[] {
  const entries = getEntriesForDay(dayIndex);
  if (entries.length === 0) {
    return [{ role: "user", content: "No conversations were recorded today." }];
  }

  return entries.map((entry) => {
    const npc = getNpcById(entry.npcId);
    const speakerName = entry.speaker === "player" ? "Player" : npc?.name ?? entry.npcId;
    const role = entry.speaker === "player" ? "user" : "assistant";
    return {
      role,
      content: `${speakerName}: ${entry.text}`,
    };
  });
}

function NpcBadge({ npcId }: { npcId: string }) {
  const npc = getNpcById(npcId);
  if (!npc) return null;
  return (
    <div className="npc-badge" data-npc-id={npcId} title={`${npc.name} · ${npc.role}`}>
      <div className="npc-badge-face">
        <span className="npc-badge-eye" />
        <span className="npc-badge-eye" />
        <span className="npc-badge-blush" />
      </div>
    </div>
  );
}

function RoleIcon({ npcId }: { npcId: string }) {
  const iconKey = getRoleIconKey(npcId);
  switch (iconKey) {
    case "garden":
      return (
        <svg viewBox="0 0 24 24" className="role-icon" aria-hidden>
          <path
            d="M12 4c3.3 0 6 2.7 6 6 0 3.9-3.4 7.6-6 9-2.6-1.4-6-5.1-6-9 0-3.3 2.7-6 6-6z"
            fill="currentColor"
          />
          <path d="M11.5 11V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "craft":
      return (
        <svg viewBox="0 0 24 24" className="role-icon" aria-hidden>
          <rect x="4" y="4" width="10" height="5" rx="1.5" fill="currentColor" />
          <rect x="6" y="8" width="12" height="4" rx="1.5" fill="currentColor" />
          <rect x="11" y="12" width="3" height="8" rx="1.5" fill="currentColor" />
        </svg>
      );
    case "market":
      return (
        <svg viewBox="0 0 24 24" className="role-icon" aria-hidden>
          <rect x="5" y="9" width="14" height="9" rx="2" fill="currentColor" />
          <path
            d="M7 9c0-3 2-5 5-5s5 2 5 5"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      );
    case "hall":
    default:
      return (
        <svg viewBox="0 0 24 24" className="role-icon" aria-hidden>
          <rect x="6" y="4" width="12" height="16" rx="2" fill="currentColor" />
          <rect x="8" y="8" width="8" height="2" rx="1" fill="#fff7ee" />
          <rect x="8" y="12" width="6" height="2" rx="1" fill="#fff7ee" />
        </svg>
      );
  }
}

function InsightIcon({ category }: { category: PlayerInsightSeed["category"] }) {
  switch (category) {
    case "goal":
      return (
        <svg viewBox="0 0 24 24" className="insight-icon" aria-hidden>
          <path d="M6 4h10l-2 4 2 4H6z" fill="currentColor" />
          <path d="M6 4v16" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "value":
      return (
        <svg viewBox="0 0 24 24" className="insight-icon" aria-hidden>
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      );
    case "habit":
      return (
        <svg viewBox="0 0 24 24" className="insight-icon" aria-hidden>
          <path
            d="M7 7h6a4 4 0 0 1 0 8H9"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <path d="M9 11l-3 3 3 3" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      );
    case "interest":
      return (
        <svg viewBox="0 0 24 24" className="insight-icon" aria-hidden>
          <path
            d="M12 4l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"
            fill="currentColor"
          />
        </svg>
      );
    case "style":
      return (
        <svg viewBox="0 0 24 24" className="insight-icon" aria-hidden>
          <rect x="5" y="6" width="14" height="2" rx="1" fill="currentColor" />
          <rect x="5" y="11" width="10" height="2" rx="1" fill="currentColor" />
          <rect x="5" y="16" width="12" height="2" rx="1" fill="currentColor" />
        </svg>
      );
    case "preference":
    default:
      return (
        <svg viewBox="0 0 24 24" className="insight-icon" aria-hidden>
          <path
            d="M12 20s-6-4.2-8.5-7.5C1 9.5 3 6 6.5 6c2 0 3.5 1.1 4.5 2.5C12 7.1 13.5 6 15.5 6 19 6 21 9.5 20.5 12.5 18 15.8 12 20 12 20z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="spark-icon" aria-hidden>
      <path
        d="M12 3l2.5 5.2L20 10l-5.5 1.8L12 17l-2.5-5.2L4 10l5.5-1.8z"
        fill="currentColor"
      />
    </svg>
  );
}

function getRoleIconKey(npcId: string) {
  switch (npcId) {
    case "jun":
      return "garden";
    case "theo":
      return "craft";
    case "pia":
      return "market";
    case "mira":
    default:
      return "hall";
  }
}

function getHighlightTags(tags: string[]) {
  const allowedGroups = new Set([
    "project",
    "place",
    "activity",
    "plant",
    "material",
    "tool",
    "item",
  ]);
  return tags.filter((tag) => allowedGroups.has(getTagGroup(tag))).slice(0, 3);
}

function formatTagLabel(tag: string) {
  const [, value = \"\"] = tag.split(\":\");
  return value
    .split(\"-\")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(\" \");
}

function getTagGroup(tag: string) {
  const [group] = tag.split(\":\");
  return group || \"misc\";
}

interface SummaryState {
  isOpen: boolean;
  isLoading: boolean;
  summaryText: string;
  highlights: DayHighlight[];
  playerInsights: PlayerInsightSeed[];
  errorMessage: string | null;
}

interface DayKickoffState {
  isOpen: boolean;
  isLoading: boolean;
  dayIndex: number;
  suggestions: DaySuggestion[];
  errorMessage: string | null;
}
