import debug from "debug";
import {
  clearStoredMemoryFacts,
  loadMemoryFacts,
  persistMemoryFact,
  replaceMemoryFacts,
} from "../storage/local-store";
import type { MemoryFact } from "./memory-types";

const log = debug("ralph:memory-store");

const memoryFacts: MemoryFact[] = [];
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

export async function initializeMemoryStore() {
  if (isInitialized) return;
  if (!initializationPromise) {
    initializationPromise = hydrateMemoryFacts();
  }

  return initializationPromise;
}

export function getMemoryFacts() {
  return memoryFacts.map((fact) => normalizeMemoryFact(fact));
}

export function getMemoryFactsForNpc(npcId: string) {
  return memoryFacts.filter((fact) => fact.npcId === npcId).map((fact) => normalizeMemoryFact(fact));
}

export function appendMemoryFacts(facts: MemoryFact[]) {
  memoryFacts.push(...facts);
  facts.forEach((fact) => {
    void persistMemoryFact(fact);
  });
}

export async function replaceAllMemoryFacts(facts: MemoryFact[]) {
  memoryFacts.length = 0;
  memoryFacts.push(...facts.map((fact) => normalizeMemoryFact(fact)));
  await replaceMemoryFacts(facts);
}

export function clearMemoryFacts() {
  memoryFacts.length = 0;
  void clearStoredMemoryFacts();
}

async function hydrateMemoryFacts() {
  try {
    const storedFacts = await loadMemoryFacts();
    memoryFacts.length = 0;
    memoryFacts.push(...storedFacts.map((fact) => normalizeMemoryFact(fact)));
    log("memory store hydrated with %d facts", storedFacts.length);
  } catch (error) {
    log("failed to hydrate memory facts %o", error);
  } finally {
    isInitialized = true;
  }
}

function normalizeMemoryFact(fact: MemoryFact) {
  const mentions = (fact as MemoryFact & { mentions?: number }).mentions ?? 1;
  return {
    ...fact,
    mentions,
  };
}
