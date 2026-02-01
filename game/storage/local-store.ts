import debug from "debug";
import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type { ConversationEntry } from "../logs/conversation-log";

const log = debug("ralph:storage");

const DATABASE_NAME = "ralph-local";
const DATABASE_VERSION = 1;
const LOCAL_STORAGE_PREFIX = "ralph:v1";
const LOCAL_STORAGE_CONVERSATION_KEY = `${LOCAL_STORAGE_PREFIX}:conversation-entries`;
const LOCAL_STORAGE_HEALTH_KEY = `${LOCAL_STORAGE_PREFIX}:healthcheck`;

const memoryConversationEntries: ConversationEntry[] = [];

let storageAdapterPromise: Promise<StorageAdapter> | null = null;

export async function getStorageBackend() {
  const adapter = await getStorageAdapter();
  return adapter.backend;
}

export async function loadConversationEntries() {
  const adapter = await getStorageAdapter();
  return adapter.getConversationEntries();
}

export async function persistConversationEntry(entry: ConversationEntry) {
  const adapter = await getStorageAdapter();
  await adapter.saveConversationEntry(entry);
}

export async function replaceConversationEntries(entries: ConversationEntry[]) {
  const adapter = await getStorageAdapter();
  await adapter.replaceConversationEntries(entries);
}

export async function clearStoredConversationEntries() {
  const adapter = await getStorageAdapter();
  await adapter.clearConversationEntries();
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
    upgrade(database) {
      if (!database.objectStoreNames.contains("conversationEntries")) {
        const store = database.createObjectStore("conversationEntries", { keyPath: "id" });
        store.createIndex("by-npc-day", ["npcId", "dayIndex"]);
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
    async saveConversationEntry(entry) {
      try {
        await database.put("conversationEntries", entry);
      } catch (error) {
        log("Failed to persist entry %o", error);
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
    async clearConversationEntries() {
      await database.clear("conversationEntries");
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
    async saveConversationEntry(entry) {
      const entries = readLocalStorageEntries();
      entries.push(entry);
      writeLocalStorageEntries(entries);
    },
    async replaceConversationEntries(entries) {
      writeLocalStorageEntries(entries);
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
  };
}

async function migrateLocalStorageEntries(adapter: StorageAdapter) {
  if (!isLocalStorageAvailable()) return;
  const entries = readLocalStorageEntries();
  if (entries.length === 0) return;

  const existingEntries = await adapter.getConversationEntries();
  const mergedEntries = mergeConversationEntries(existingEntries, entries);
  await adapter.replaceConversationEntries(mergedEntries);

  try {
    localStorage.removeItem(LOCAL_STORAGE_CONVERSATION_KEY);
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

function mergeConversationEntries(
  existingEntries: ConversationEntry[],
  incomingEntries: ConversationEntry[]
) {
  const merged = new Map<string, ConversationEntry>();
  existingEntries.forEach((entry) => merged.set(entry.id, entry));
  incomingEntries.forEach((entry) => merged.set(entry.id, entry));
  return sortConversationEntries(Array.from(merged.values()));
}

function sortConversationEntries(entries: ConversationEntry[]) {
  return [...entries].sort((left, right) => {
    const leftTime = normalizeTimestamp(left.timestamp);
    const rightTime = normalizeTimestamp(right.timestamp);
    if (leftTime !== rightTime) return leftTime - rightTime;
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
  saveConversationEntry: (entry: ConversationEntry) => Promise<void>;
  replaceConversationEntries: (entries: ConversationEntry[]) => Promise<void>;
  clearConversationEntries: () => Promise<void>;
}

interface RalphDatabase extends DBSchema {
  conversationEntries: {
    key: string;
    value: ConversationEntry;
    indexes: { "by-npc-day": [string, number] };
  };
}
