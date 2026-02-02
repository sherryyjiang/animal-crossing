import assert from "node:assert/strict";
import test from "node:test";
import {
  mergePlayerProfile,
  type PlayerProfile,
  type PlayerInsightSeed,
} from "../game/memory/player-profile";

test("mergePlayerProfile strengthens repeated insights", () => {
  const existing: PlayerProfile = {
    updatedAt: "2026-02-01T09:00:00.000Z",
    insights: [
      {
        id: "preference:tea",
        text: "Prefers tea as a calm ritual.",
        category: "preference",
        strength: 0.62,
        mentions: 1,
        firstSeenAt: "2026-02-01T09:00:00.000Z",
        lastMentionedAt: "2026-02-01T09:00:00.000Z",
      },
    ],
  };

  const incoming: PlayerInsightSeed[] = [
    { text: "Prefers tea as a calm ritual.", category: "preference" },
    { text: "Enjoys step-by-step plans.", category: "style" },
  ];

  const merged = mergePlayerProfile(existing, incoming, "2026-02-02T09:00:00.000Z");
  assert.equal(merged.insights.length, 2);

  const teaInsight = merged.insights.find((insight) => insight.id === "preference:tea");
  assert.ok(teaInsight);
  assert.ok((teaInsight?.strength ?? 0) > 0.62);
  assert.equal(teaInsight?.mentions, 2);
});
