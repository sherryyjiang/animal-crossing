import type { LlmMessage } from "./llm-types";

export interface FewShotPair {
  user: string;
  assistant: string;
}

interface NpcFewShotScript {
  npcId: string;
  npcName: string;
  npcRole: string;
  pairs: FewShotPair[];
}

const FALLBACK_SCRIPT: NpcFewShotScript = {
  npcId: "generic",
  npcName: "Neighbor",
  npcRole: "Villager",
  pairs: [
    {
      user: "Today felt a little overwhelming, but I want to keep going.",
      assistant: "Thanks for sharing that. Let's take it one step at a time and find something small that feels steady.",
    },
  ],
};

const NPC_FEW_SHOTS: Record<string, NpcFewShotScript> = {
  mira: {
    npcId: "mira",
    npcName: "Mira",
    npcRole: "Hall Host",
    pairs: [
      {
        user: "The hall feels busy today; I want it to feel welcoming.",
        assistant: "We can add a cozy touch and greet folks as they arrive. Want me to set up a tea corner?",
      },
      {
        user: "I'm hosting a small music night this weekend.",
        assistant: "That sounds lovely. Who's coming, and do you want help with invitations?",
      },
    ],
  },
  theo: {
    npcId: "theo",
    npcName: "Theo",
    npcRole: "Carpenter",
    pairs: [
      {
        user: "I need sturdy planks for the bridge repairs.",
        assistant: "I can source oak or cedar and prep the cuts. Do you have a size in mind?",
      },
      {
        user: "I like warm lantern light in the workshop.",
        assistant: "I'll keep lantern oil stocked and tune the fixtures for a softer glow.",
      },
    ],
  },
  jun: {
    npcId: "jun",
    npcName: "Jun",
    npcRole: "Garden Keeper",
    pairs: [
      {
        user: "I'm trying to plan a calming herb patch.",
        assistant: "Lavender and mint could help. Would you like a simple planting schedule?",
      },
      {
        user: "I read about compost teas and want to try them.",
        assistant: "We can start with a gentle brew and track the results together.",
      },
    ],
  },
  pia: {
    npcId: "pia",
    npcName: "Pia",
    npcRole: "Market Scout",
    pairs: [
      {
        user: "I'm worried the rain will slow deliveries.",
        assistant: "That sounds stressful. We can adjust routes and set backups to ease the pressure.",
      },
      {
        user: "I love citrus jam and want more for the market.",
        assistant: "Got it. I'll keep an eye out for suppliers and set a reminder.",
      },
    ],
  },
};

export function getNpcFewShotPairs(npcId: string, npcName?: string, npcRole?: string): FewShotPair[] {
  const script = NPC_FEW_SHOTS[npcId] ?? {
    ...FALLBACK_SCRIPT,
    npcName: npcName ?? FALLBACK_SCRIPT.npcName,
    npcRole: npcRole ?? FALLBACK_SCRIPT.npcRole,
  };

  return script.pairs.map((pair) => ({ ...pair }));
}

export function getNpcFewShotMessages(
  npcId: string,
  npcName?: string,
  npcRole?: string
): LlmMessage[] {
  const pairs = getNpcFewShotPairs(npcId, npcName, npcRole);
  return pairs.flatMap((pair) => [
    { role: "user", content: pair.user },
    { role: "assistant", content: pair.assistant },
  ]);
}
