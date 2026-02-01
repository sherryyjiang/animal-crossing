export type MemoryFactType =
  | "emotion"
  | "preference"
  | "relationship"
  | "schedule"
  | "goal"
  | "item"
  | "event";

export interface MemoryFact {
  id: string;
  npcId: string;
  type: MemoryFactType;
  content: string;
  tags: string[];
  salience: number;
  createdAt: string;
  lastMentionedAt: string;
}

export interface MemoryExtractionResult {
  addedFacts: MemoryFact[];
  totalFacts: number;
}
