import debug from "debug";
import { z } from "zod";
import { getConversationEntries, initializeConversationLog, setActiveDayIndex } from "./logs/conversation-log";
import { getNpcIds } from "./npc-roster";
import { loadSetting, saveSetting } from "./storage/local-store";

const log = debug("ralph:day-cycle");

const DAY_CYCLE_SETTING_KEY = "day-cycle-state";
const DAY_CYCLE_EVENT = "day-cycle:update";

const dayCycleEventTarget = new EventTarget();

const dayCycleSchema = z.object({
  dayIndex: z.number().int().min(1),
  visitedNpcIds: z.array(z.string()).default([]),
});

const requiredNpcIds = getNpcIds();

let dayCycleState: DayCycleState = {
  dayIndex: 1,
  visitedNpcIds: [],
};

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

export async function initializeDayCycle() {
  if (isInitialized) return;
  if (!initializationPromise) {
    initializationPromise = hydrateDayCycleState();
  }

  return initializationPromise;
}

export function getDayCycleState() {
  return {
    dayIndex: dayCycleState.dayIndex,
    visitedNpcIds: [...dayCycleState.visitedNpcIds],
  };
}

export function getRequiredNpcIds() {
  return [...requiredNpcIds];
}

export function isDayComplete(state: DayCycleState = dayCycleState) {
  return requiredNpcIds.every((npcId) => state.visitedNpcIds.includes(npcId));
}

export async function markNpcVisited(npcId: string) {
  if (!requiredNpcIds.includes(npcId)) return;
  if (dayCycleState.visitedNpcIds.includes(npcId)) return;
  dayCycleState = {
    ...dayCycleState,
    visitedNpcIds: [...dayCycleState.visitedNpcIds, npcId],
  };
  await persistDayCycleState();
  emitDayCycleUpdate();
}

export async function startNewDay() {
  dayCycleState = {
    dayIndex: dayCycleState.dayIndex + 1,
    visitedNpcIds: [],
  };
  setActiveDayIndex(dayCycleState.dayIndex);
  await persistDayCycleState();
  emitDayCycleUpdate();
}

export function onDayCycleChange(handler: (state: DayCycleState) => void) {
  function handleEvent(event: Event) {
    const customEvent = event as CustomEvent<DayCycleState>;
    handler(customEvent.detail);
  }

  dayCycleEventTarget.addEventListener(DAY_CYCLE_EVENT, handleEvent);

  return function unsubscribe() {
    dayCycleEventTarget.removeEventListener(DAY_CYCLE_EVENT, handleEvent);
  };
}

async function hydrateDayCycleState() {
  try {
    await initializeConversationLog();
    const stored = await loadSetting<DayCycleSnapshot>(DAY_CYCLE_SETTING_KEY);
    const normalized = normalizeDayCycleState(stored);
    dayCycleState = mergeVisitedFromLog(normalized);
    setActiveDayIndex(dayCycleState.dayIndex);
    await persistDayCycleState();
    emitDayCycleUpdate();
  } catch (error) {
    log("Failed to hydrate day cycle %o", error);
  } finally {
    isInitialized = true;
  }
}

function normalizeDayCycleState(stored: DayCycleSnapshot | null) {
  if (!stored) {
    return { dayIndex: 1, visitedNpcIds: [] };
  }
  const parsed = dayCycleSchema.safeParse(stored);
  if (!parsed.success) {
    log("Invalid day cycle state %o", parsed.error.format());
    return { dayIndex: 1, visitedNpcIds: [] };
  }

  return {
    dayIndex: parsed.data.dayIndex,
    visitedNpcIds: uniqueValues(parsed.data.visitedNpcIds),
  };
}

function mergeVisitedFromLog(state: DayCycleState) {
  const entries = getConversationEntries().filter((entry) => entry.dayIndex === state.dayIndex);
  const visitedFromLog = new Set(state.visitedNpcIds);
  entries.forEach((entry) => {
    if (requiredNpcIds.includes(entry.npcId)) visitedFromLog.add(entry.npcId);
  });
  return {
    ...state,
    visitedNpcIds: Array.from(visitedFromLog),
  };
}

function emitDayCycleUpdate() {
  dayCycleEventTarget.dispatchEvent(new CustomEvent(DAY_CYCLE_EVENT, { detail: getDayCycleState() }));
}

async function persistDayCycleState() {
  const snapshot: DayCycleSnapshot = {
    dayIndex: dayCycleState.dayIndex,
    visitedNpcIds: [...dayCycleState.visitedNpcIds],
  };
  try {
    await saveSetting(DAY_CYCLE_SETTING_KEY, snapshot);
  } catch (error) {
    log("Failed to persist day cycle state %o", error);
  }
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

interface DayCycleState {
  dayIndex: number;
  visitedNpcIds: string[];
}

interface DayCycleSnapshot {
  dayIndex: number;
  visitedNpcIds: string[];
}
