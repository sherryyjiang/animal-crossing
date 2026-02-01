import debug from "debug";
import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type { ConversationEntry } from "../logs/conversation-log";
import type { MemoryFact } from "../memory/memory-types";

const log = debug("ralph:storage");

const DATABASE_NAME = "ralph-local";
const DATABASE_VERSION = 2;
const LOCAL_STORAGE_PREFIX = "ralph:v1";
const LOCAL_STORAGE_CONVERSATION_KEY = `${LOCAL_STORAGE_PREFIX}:conversation-entries`;
const LOCAL_STORAGE_HEALTH_KEY = `${LOCAL_STORAGE_PREFIX}:healthcheck`;
const LOCAL_STORAGE_MEMORY_FACTS_KEY = `${LOCAL_STORAGE_PREFIX}:memory-facts`;

const memoryConversationEntries: ConversationEntry[] = [];
const memoryFacts: MemoryFact[] = [];

let storageAdapterPromise: Promise<StorageAdapter> | null = null;

export async function getStorageBackend() {
  const adapter = await getStorageAdapter();
  return adapter.backend;
}

export async function loadConversationEntries() {
  const adapter = await getStorageAdapter();
  return adapter.getConversationEntries();
}

export async function loadMemoryFacts() {
  const adapter = await getStorageAdapter();
  return adapter.getMemoryFacts();
}

export async function persistConversationEntry(entry: ConversationEntry) {
  const adapter = await getStorageAdapter();
  await adapter.saveConversationEntry(entry);
}

export async function persistMemoryFact(fact: MemoryFact) {
  const adapter = await getStorageAdapter();
  await adapter.saveMemoryFact(fact);
}

export async function replaceConversationEntries(entries: ConversationEntry[]) {
  const adapter = await getStorageAdapter();
  await adapter.replaceConversationEntries(entries);
}

export async function replaceMemoryFacts(facts: MemoryFact[]) {
  const adapter = await getStorageAdapter();
  await adapter.replaceMemoryFacts(facts);
}

export async function clearStoredConversationEntries() {
  const adapter = await getStorageAdapter();
  await adapter.clearConversationEntries();
}

export async function clearStoredMemoryFacts() {
  const adapter = await getStorageAdapter();
  await adapter.clearMemoryFacts();
}

async function getStorageAdapter() {
  if (!storageAdapterPromise) {
    storageAdapterPromise = createStorageAdapter();
  }

  return storageAdapterPromise;
}

async function createStorageAdapter(): Promise<StorageAdapter> {
  if (!isIndexedDbAvailable()) {
    return createLocalStorageAdapter("indexeddb-unavailable");
  }

  try {
    const db = await openDatabase();
    const adapter = createIndexedDbAdapter(db);
    await migrateLocalStorageEntries(adapter);
    return adapter;
  } catch (error) {
    log("IndexedDB unavailable, falling back %o", error);
    return createLocalStorageAdapter("indexeddb-open-failed");
  }
}

async function openDatabase() {
  return openDB<RalphDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1 && !database.objectStoreNames.contains("conversationEntries")) {
        const store = database.createObjectStore("conversationEntries", { keyPath: "id" });
        store.createIndex("by-npc-day", ["npcId", "dayIndex"]);
      }

      if (oldVersion < 2 && !database.objectStoreNames.contains("memoryFacts")) {
        const store = database.createObjectStore("memoryFacts", { keyPath: "id" });
        store.createIndex("by-npc", "npcId");
      }
    },
  });
}

function createIndexedDbAdapter(database: IDBPDatabase<RalphDatabase>): StorageAdapter {
  return {
    backend: "indexeddb",
    async getConversationEntries() {
      const entries = await database.getAll("conversationEntries");
      return sortConversationEntries(entries);
    },
    async getMemoryFacts() {
      const facts = await database.getAll("memoryFacts");
      return sortMemoryFacts(facts);
    },
    async saveConversationEntry(entry) {
      try {
        await database.put("conversationEntries", entry);
      } catch (error) {
        log("Failed to persist entry %o", error);
      }
    },
    async saveMemoryFact(fact) {
      try {
        await database.put("memoryFacts", fact);
      } catch (error) {
        log("Failed to persist memory fact %o", error);
      }
    },
    async replaceConversationEntries(entries) {
      const transaction = database.transaction("conversationEntries", "readwrite");
      await transaction.store.clear();
      for (const entry of entries) {
        await transaction.store.put(entry);
      }
      await transaction.done;
    },
    async replaceMemoryFacts(facts) {
      const transaction = database.transaction("memoryFacts", "readwrite");
      await transaction.store.clear();
      for (const fact of facts) {
        await transaction.store.put(fact);
      }
      await transaction.done;
    },
    async clearConversationEntries() {
      await database.clear("conversationEntries");
    },
    async clearMemoryFacts() {
      await database.clear("memoryFacts");
    },
  };
}

function createLocalStorageAdapter(reason: string): StorageAdapter {
  log("Using localStorage fallback %s", reason);

  return {
    backend: "localstorage",
    async getConversationEntries() {
      return readLocalStorageEntries();
    },
    async getMemoryFacts() {
      return readLocalStorageMemoryFacts();
    },
    async saveConversationEntry(entry) {
      const entries = readLocalStorageEntries();
      entries.push(entry);
      writeLocalStorageEntries(entries);
    },
    async saveMemoryFact(fact) {
      const facts = readLocalStorageMemoryFacts();
      facts.push(fact);
      writeLocalStorageMemoryFacts(facts);
    },
    async replaceConversationEntries(entries) {
      writeLocalStorageEntries(entries);
    },
    async replaceMemoryFacts(facts) {
      writeLocalStorageMemoryFacts(facts);
    },
    async clearConversationEntries() {
      memoryConversationEntries.length = 0;
      if (!isLocalStorageAvailable()) return;
      try {
        localStorage.removeItem(LOCAL_STORAGE_CONVERSATION_KEY);
      } catch (error) {
        log("Failed to clear localStorage %o", error);
      }
    },
    async clearMemoryFacts() {
      memoryFacts.length = 0;
      if (!isLocalStorageAvailable()) return;
      try {
        localStorage.removeItem(LOCAL_STORAGE_MEMORY_FACTS_KEY);
      } catch (error) {
        log("Failed to clear localStorage memory facts %o", error);
      }
    },
  };
}

async function migrateLocalStorageEntries(adapter: StorageAdapter) {
  if (!isLocalStorageAvailable()) return;
  const entries = readLocalStorageEntries();
  const facts = readLocalStorageMemoryFacts();
  if (entries.length === 0 && facts.length === 0) return;

  if (entries.length > 0) {
    const existingEntries = await adapter.getConversationEntries();
    const mergedEntries = mergeConversationEntries(existingEntries, entries);
    await adapter.replaceConversationEntries(mergedEntries);
  }

  if (facts.length > 0) {
    const existingFacts = await adapter.getMemoryFacts();
    const mergedFacts = mergeMemoryFacts(existingFacts, facts);
    await adapter.replaceMemoryFacts(mergedFacts);
  }

  try {
    localStorage.removeItem(LOCAL_STORAGE_CONVERSATION_KEY);
    localStorage.removeItem(LOCAL_STORAGE_MEMORY_FACTS_KEY);
  } catch (error) {
    log("Failed to clear localStorage after migration %o", error);
  }
}

function readLocalStorageEntries() {
  if (!isLocalStorageAvailable()) return [...memoryConversationEntries];

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONVERSATION_KEY);
    if (!raw) return [...memoryConversationEntries];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...memoryConversationEntries];

    memoryConversationEntries.length = 0;
    memoryConversationEntries.push(...parsed);
    return sortConversationEntries(parsed);
  } catch (error) {
    log("Failed to read localStorage %o", error);
    return [...memoryConversationEntries];
  }
}

function writeLocalStorageEntries(entries: ConversationEntry[]) {
  memoryConversationEntries.length = 0;
  memoryConversationEntries.push(...entries);

  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.setItem(LOCAL_STORAGE_CONVERSATION_KEY, JSON.stringify(entries));
  } catch (error) {
    log("Failed to write localStorage %o", error);
  }
}

function readLocalStorageMemoryFacts() {
  if (!isLocalStorageAvailable()) return [...memoryFacts];

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MEMORY_FACTS_KEY);
    if (!raw) return [...memoryFacts];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...memoryFacts];

    memoryFacts.length = 0;
    memoryFacts.push(...parsed);
    return sortMemoryFacts(parsed);
  } catch (error) {
    log("Failed to read localStorage memory facts %o", error);
    return [...memoryFacts];
  }
}

function writeLocalStorageMemoryFacts(facts: MemoryFact[]) {
  memoryFacts.length = 0;
  memoryFacts.push(...facts);

  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.setItem(LOCAL_STORAGE_MEMORY_FACTS_KEY, JSON.stringify(facts));
  } catch (error) {
    log("Failed to write localStorage memory facts %o", error);
  }
}

function mergeConversationEntries(
  existingEntries: ConversationEntry[],
  incomingEntries: ConversationEntry[]
) {
  const merged = new Map<string, ConversationEntry>();
  existingEntries.forEach((entry) => merged.set(entry.id, entry));
  incomingEntries.forEach((entry) => merged.set(entry.id, entry));
  return sortConversationEntries(Array.from(merged.values()));
}

function mergeMemoryFacts(existingFacts: MemoryFact[], incomingFacts: MemoryFact[]) {
  const merged = new Map<string, MemoryFact>();
  existingFacts.forEach((fact) => merged.set(fact.id, fact));
  incomingFacts.forEach((fact) => merged.set(fact.id, fact));
  return sortMemoryFacts(Array.from(merged.values()));
}

function sortConversationEntries(entries: ConversationEntry[]) {
  return [...entries].sort((left, right) => {
    const leftTime = normalizeTimestamp(left.timestamp);
    const rightTime = normalizeTimestamp(right.timestamp);
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id.localeCompare(right.id);
  });
}

function sortMemoryFacts(facts: MemoryFact[]) {
  return [...facts].sort((left, right) => {
    const leftTime = normalizeTimestamp(left.lastMentionedAt);
    const rightTime = normalizeTimestamp(right.lastMentionedAt);
    if (leftTime !== rightTime) return rightTime - leftTime;
    return left.id.localeCompare(right.id);
  });
}

function normalizeTimestamp(timestamp: string) {
  const value = Date.parse(timestamp);
  if (Number.isNaN(value)) return 0;
  return value;
}

function isIndexedDbAvailable() {
  return typeof indexedDB !== "undefined";
}

function isLocalStorageAvailable() {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(LOCAL_STORAGE_HEALTH_KEY, "1");
    localStorage.removeItem(LOCAL_STORAGE_HEALTH_KEY);
    return true;
  } catch (error) {
    log("localStorage unavailable %o", error);
    return false;
  }
}

interface StorageAdapter {
  backend: "indexeddb" | "localstorage";
  getConversationEntries: () => Promise<ConversationEntry[]>;
  getMemoryFacts: () => Promise<MemoryFact[]>;
  saveConversationEntry: (entry: ConversationEntry) => Promise<void>;
  saveMemoryFact: (fact: MemoryFact) => Promise<void>;
  replaceConversationEntries: (entries: ConversationEntry[]) => Promise<void>;
  replaceMemoryFacts: (facts: MemoryFact[]) => Promise<void>;
  clearConversationEntries: () => Promise<void>;
  clearMemoryFacts: () => Promise<void>;
}

interface RalphDatabase extends DBSchema {
  conversationEntries: {
    key: string;
    value: ConversationEntry;
    indexes: { "by-npc-day": [string, number] };
  };
  memoryFacts: {
    key: string;
    value: MemoryFact;
    indexes: { "by-npc": string };
  };
}
