export type MemoryFactType =
  | "emotion"
  | "preference"
  | "relationship"
  | "schedule"
  | "goal"
  | "task"
  | "item"
  | "event";

export interface MemoryLink {
  targetId: string;
  label: string;
}

export interface MemoryAnchor {
  type:
    | "person"
    | "genre"
    | "activity"
    | "time"
    | "place"
    | "item"
    | "project"
    | "event"
    | "goal"
    | "title"
    | "topic";
  value: string;
}

export interface MemoryFact {
  id: string;
  npcId: string;
  type: MemoryFactType;
  content: string;
  tags: string[];
  salience: number;
  mentions: number;
  status?: "open" | "done";
  threadId?: string;
  threadSequence?: number;
  anchors?: MemoryAnchor[];
  links?: MemoryLink[];
  createdAt: string;
  lastMentionedAt: string;
}

export interface MemoryExtractionResult {
  addedFacts: MemoryFact[];
  totalFacts: number;
}
