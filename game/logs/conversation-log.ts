import debug from "debug";

const log = debug("ralph:conversation-log");

const conversationEntries: ConversationEntry[] = [];
let activeDayIndex = 1;

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

  return entry;
}

export function getConversationEntries() {
  return [...conversationEntries];
}

export function getEntriesForNpcDay(npcId: string, dayIndex = activeDayIndex) {
  return conversationEntries.filter((entry) => entry.npcId === npcId && entry.dayIndex === dayIndex);
}

export function clearConversationEntries() {
  conversationEntries.length = 0;
}

function createEntryId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface ConversationEntryInput {
  npcId: string;
  speaker: "npc" | "player";
  text: string;
  dayIndex?: number;
  timestamp?: string;
}

interface ConversationEntry {
  id: string;
  npcId: string;
  dayIndex: number;
  timestamp: string;
  speaker: "npc" | "player";
  text: string;
}
