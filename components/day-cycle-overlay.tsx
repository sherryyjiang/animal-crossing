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
import { llmAdapter } from "../game/llm/llm-adapter";
import type { LlmMessage } from "../game/llm/llm-types";
import { getNpcById } from "../game/npc-roster";

const log = debug("ralph:day-summary");

export function DayCycleOverlay() {
  const [dayState, setDayState] = useState(getDayCycleState());
  const [summaryState, setSummaryState] = useState<SummaryState>({
    isOpen: false,
    isLoading: false,
    summaryText: "",
    errorMessage: null,
  });

  const requiredNpcIds = getRequiredNpcIds();
  const hasCompletedDay = isDayComplete(dayState);

  useEffect(() => {
    let isMounted = true;
    void initializeConversationLog();
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
      errorMessage: null,
    });

    try {
      const conversation = buildDaySummaryConversation(dayState.dayIndex);
      const result = await llmAdapter.summarizeDay({
        dayIndex: dayState.dayIndex,
        conversation,
        maxParagraphs: 2,
      });
      setSummaryState({
        isOpen: true,
        isLoading: false,
        summaryText: result.summary,
        errorMessage: null,
      });
    } catch (error) {
      log("Day summary failed %o", { error, dayIndex: dayState.dayIndex });
      setSummaryState({
        isOpen: true,
        isLoading: false,
        summaryText: "The village feels quiet tonight. You can still start a new day.",
        errorMessage: "Summary unavailable right now.",
      });
    }
  }

  async function handleStartNewDay() {
    await startNewDay();
    setSummaryState({
      isOpen: false,
      isLoading: false,
      summaryText: "",
      errorMessage: null,
    });
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
            <div className="day-summary-title">Day {dayState.dayIndex} Summary</div>
            {summaryState.isLoading ? (
              <div className="day-summary-loading">Gathering today&apos;s highlights...</div>
            ) : (
              <div className="day-summary-text">{summaryState.summaryText}</div>
            )}
            {summaryState.errorMessage && (
              <div className="day-summary-error">{summaryState.errorMessage}</div>
            )}
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

interface SummaryState {
  isOpen: boolean;
  isLoading: boolean;
  summaryText: string;
  errorMessage: string | null;
}
