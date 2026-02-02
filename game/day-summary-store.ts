import { loadSetting, saveSetting } from "./storage/local-store";
import type { LlmPlayerInsight } from "./llm/llm-types";

const DAY_SUMMARY_PREFIX = "day-summary";

export interface DaySummarySnapshot {
  dayIndex: number;
  summaryText: string;
  playerInsights: LlmPlayerInsight[];
  createdAt: string;
}

export async function loadDaySummary(dayIndex: number) {
  return loadSetting<DaySummarySnapshot>(createSummaryKey(dayIndex));
}

export async function saveDaySummary(snapshot: DaySummarySnapshot) {
  await saveSetting(createSummaryKey(snapshot.dayIndex), snapshot);
}

function createSummaryKey(dayIndex: number) {
  return `${DAY_SUMMARY_PREFIX}:${dayIndex}`;
}
