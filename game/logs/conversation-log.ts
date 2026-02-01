import debug from "debug";
import {
  clearStoredConversationEntries,
  loadConversationEntries,
  persistConversationEntry,
} from "../storage/local-store";

const log = debug("ralph:conversation-log");

const conversationEntries: ConversationEntry[] = [];
let activeDayIndex = 1;
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

export async function initializeConversationLog() {
  if (isInitialized) return;
  if (!initializationPromise) {
    initializationPromise = hydrateConversationEntries();
  }

  return initializationPromise;
}

export function setActiveDayIndex(dayIndex: number) {
  activeDayIndex = Math.max(1, Math.floor(dayIndex));
}

export function getActiveDayIndex() {
  return activeDayIndex;
}

export function appendConversationEntry(input: ConversationEntryInput) {
  const entry: ConversationEntry = {
    id: createEntryId(),
    npcId: input.npcId,
    dayIndex: input.dayIndex ?? activeDayIndex,
    timestamp: input.timestamp ?? new Date().toISOString(),
    speaker: input.speaker,
    text: input.text,
  };

  conversationEntries.push(entry);
  log("entry recorded %o", entry);
  void persistConversationEntry(entry);

  return entry;
}

export function getConversationEntries() {
  return [...conversationEntries];
}

export function getEntriesForNpcDay(npcId: string, dayIndex = activeDayIndex) {
  return conversationEntries.filter((entry) => entry.npcId === npcId && entry.dayIndex === dayIndex);
}

export function getRecentEntriesForNpc(npcId: string, limit = 6) {
  const entries = conversationEntries.filter((entry) => entry.npcId === npcId);
  if (entries.length <= limit) return entries;
  return entries.slice(entries.length - limit);
}

export function clearConversationEntries() {
  conversationEntries.length = 0;
  void clearStoredConversationEntries();
}

function createEntryId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function hydrateConversationEntries() {
  try {
    const storedEntries = await loadConversationEntries();
    conversationEntries.length = 0;
    conversationEntries.push(...storedEntries);
    log("conversation log hydrated with %d entries", storedEntries.length);
  } catch (error) {
    log("failed to hydrate conversation log %o", error);
  } finally {
    isInitialized = true;
  }
}

export interface ConversationEntryInput {
  npcId: string;
  speaker: "npc" | "player";
  text: string;
  dayIndex?: number;
  timestamp?: string;
}

export interface ConversationEntry {
  id: string;
  npcId: string;
  dayIndex: number;
  timestamp: string;
  speaker: "npc" | "player";
  text: string;
}
