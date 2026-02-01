import type { MemoryFactType } from "./memory-types";

export function getNpcPersonalityProfile(npcId: string, npcRole: string): NpcPersonalityProfile {
  const key = npcPersonalityById[npcId] ?? npcPersonalityByRole[npcRole] ?? "neighbor";
  return npcPersonalities[key];
}

export function getNpcPersonalityKey(npcId: string, npcRole: string): NpcPersonalityKey {
  return npcPersonalityById[npcId] ?? npcPersonalityByRole[npcRole] ?? "neighbor";
}

const npcPersonalities: Record<NpcPersonalityKey, NpcPersonalityProfile> = {
  bartender: {
    key: "bartender",
    title: "Emotional Anchor",
    tone: "empathetic, warm, lightly humorous",
    focus: "feelings, stressors, coping routines, and mood shifts",
    memoryTypes: ["emotion", "event", "relationship"],
    weights: { recencyWeight: 0.25, salienceWeight: 0.45, typeWeight: 0.3 },
    greetingStyle: "smiles with a calm, grounding presence.",
    replyStyle: "leans in gently, offering reassurance and a soft laugh.",
    promptGuidance: "Reflect emotions, validate struggles, and suggest small comforts.",
  },
  shopkeeper: {
    key: "shopkeeper",
    title: "Practical Helper",
    tone: "upbeat, efficient, detail-oriented",
    focus: "purchases, preferences, routines, schedules, and errands",
    memoryTypes: ["item", "preference", "schedule"],
    weights: { recencyWeight: 0.3, salienceWeight: 0.35, typeWeight: 0.35 },
    greetingStyle: "greets you with bright eyes and a ready checklist.",
    replyStyle: "nods quickly, already thinking about practical next steps.",
    promptGuidance: "Keep replies concise, actionable, and preference-aware.",
  },
  neighbor: {
    key: "neighbor",
    title: "Social Connector",
    tone: "chatty, curious, community-focused",
    focus: "relationships, local events, introductions, and social energy",
    memoryTypes: ["relationship", "event", "goal"],
    weights: { recencyWeight: 0.25, salienceWeight: 0.3, typeWeight: 0.45 },
    greetingStyle: "waves eagerly, full of neighborhood warmth.",
    replyStyle: "shares a friendly, inquisitive reply.",
    promptGuidance: "Ask about people, invitations, and community happenings.",
  },
  librarian: {
    key: "librarian",
    title: "Reflective Guide",
    tone: "thoughtful, gentle, precise",
    focus: "ideas, learning goals, books, and long-term projects",
    memoryTypes: ["goal", "preference", "event"],
    weights: { recencyWeight: 0.2, salienceWeight: 0.35, typeWeight: 0.45 },
    greetingStyle: "offers a quiet smile, ready to listen.",
    replyStyle: "responds with calm curiosity and careful phrasing.",
    promptGuidance: "Invite reflection, curiosity, and follow-up exploration.",
  },
};

const npcPersonalityById: Record<string, NpcPersonalityKey> = {
  mira: "neighbor",
  theo: "shopkeeper",
  jun: "librarian",
  pia: "bartender",
  "notice-board": "neighbor",
};

const npcPersonalityByRole: Record<string, NpcPersonalityKey> = {
  "Hall Host": "neighbor",
  Carpenter: "shopkeeper",
  "Garden Keeper": "librarian",
  "Market Scout": "bartender",
  "Bulletin Board": "neighbor",
};

interface PersonalityWeights {
  recencyWeight: number;
  salienceWeight: number;
  typeWeight: number;
}

export interface NpcPersonalityProfile {
  key: NpcPersonalityKey;
  title: string;
  tone: string;
  focus: string;
  memoryTypes: MemoryFactType[];
  weights: PersonalityWeights;
  greetingStyle: string;
  replyStyle: string;
  promptGuidance: string;
}

export type NpcPersonalityKey = "bartender" | "shopkeeper" | "neighbor" | "librarian";
