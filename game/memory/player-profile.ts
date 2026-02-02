import { loadSetting, saveSetting } from "../storage/local-store";

export type PlayerInsightCategory =
  | "preference"
  | "goal"
  | "value"
  | "habit"
  | "interest"
  | "style";

export interface PlayerInsight {
  id: string;
  text: string;
  category: PlayerInsightCategory;
  strength: number;
  mentions: number;
  firstSeenAt: string;
  lastMentionedAt: string;
}

export interface PlayerProfile {
  updatedAt: string;
  insights: PlayerInsight[];
}

export interface PlayerInsightSeed {
  text: string;
  category: PlayerInsightCategory;
}

const PLAYER_PROFILE_KEY = "player-profile";

export async function loadPlayerProfile() {
  const stored = await loadSetting<PlayerProfile>(PLAYER_PROFILE_KEY);
  if (!stored) {
    return createEmptyProfile();
  }
  return {
    updatedAt: stored.updatedAt ?? new Date(0).toISOString(),
    insights: stored.insights ?? [],
  };
}

export async function savePlayerProfile(profile: PlayerProfile) {
  await saveSetting(PLAYER_PROFILE_KEY, profile);
}

export function createEmptyProfile(): PlayerProfile {
  return {
    updatedAt: new Date(0).toISOString(),
    insights: [],
  };
}

export function mergePlayerProfile(
  profile: PlayerProfile,
  incoming: PlayerInsightSeed[],
  timestamp: string
): PlayerProfile {
  const merged = new Map<string, PlayerInsight>();
  profile.insights.forEach((insight) => {
    merged.set(insight.id, insight);
  });

  incoming.forEach((seed) => {
    const normalizedSeed = normalizeInsight(seed.text);
    const existing = findExistingInsight(merged, seed.category, normalizedSeed);
    const id = existing?.id ?? createInsightId(seed.category, seed.text);
    if (!existing) {
      merged.set(id, {
        id,
        text: seed.text.trim(),
        category: seed.category,
        strength: 0.55,
        mentions: 1,
        firstSeenAt: timestamp,
        lastMentionedAt: timestamp,
      });
      return;
    }

    const mentions = existing.mentions + 1;
    const strength = clamp(
      existing.strength * 0.75 + 0.25 + Math.min(0.15, mentions * 0.03),
      0,
      1
    );
    merged.set(id, {
      ...existing,
      strength: Math.max(existing.strength, strength),
      mentions,
      lastMentionedAt: timestamp,
    });
  });

  return {
    updatedAt: timestamp,
    insights: Array.from(merged.values()).sort(sortByStrength),
  };
}

function createInsightId(category: PlayerInsightCategory, text: string) {
  return `${category}:${normalizeInsight(text)}`;
}

function normalizeInsight(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").trim();
}

function findExistingInsight(
  insights: Map<string, PlayerInsight>,
  category: PlayerInsightCategory,
  normalizedSeed: string
) {
  for (const insight of insights.values()) {
    if (insight.category !== category) continue;
    if (normalizeInsight(insight.text) === normalizedSeed) return insight;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sortByStrength(left: PlayerInsight, right: PlayerInsight) {
  if (left.strength !== right.strength) return right.strength - left.strength;
  return right.lastMentionedAt.localeCompare(left.lastMentionedAt);
}
