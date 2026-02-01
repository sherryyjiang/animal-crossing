import debug from "debug";
import { extractAndStoreMemories } from "./memory/memory-pipeline";
import { clearMemoryFacts, getMemoryFacts, initializeMemoryStore } from "./memory/memory-store";
import {
  appendConversationEntry,
  clearConversationEntries,
  getActiveDayIndex,
  initializeConversationLog,
  setActiveDayIndex,
} from "./logs/conversation-log";
import { getNpcRoster } from "./npc-roster";

const log = debug("ralph:synthetic-chat");

export async function runSyntheticChatHarness(
  options: SyntheticChatOptions = {}
): Promise<SyntheticChatResult> {
  await initializeConversationLog();
  await initializeMemoryStore();

  const resolvedDayIndex = resolveDayIndex(options.dayIndex);
  setActiveDayIndex(resolvedDayIndex);

  if (options.reset) {
    clearConversationEntries();
    clearMemoryFacts();
  }

  const scripts = resolveScriptsForRoster(getNpcRoster());
  const perNpcResults: SyntheticChatNpcResult[] = [];

  for (const script of scripts) {
    const result = await runSyntheticScript(script, resolvedDayIndex);
    perNpcResults.push(result);
  }

  const totalEntries = perNpcResults.reduce((sum, entry) => sum + entry.entryCount, 0);
  const totalFactsAdded = perNpcResults.reduce((sum, entry) => sum + entry.factsAdded, 0);

  const summary: SyntheticChatResult = {
    dayIndex: resolvedDayIndex,
    totalEntries,
    totalFactsAdded,
    totalFacts: getMemoryFacts().length,
    generatedAt: new Date().toISOString(),
    mode: options.reset ? "reset" : "append",
    perNpcResults,
  };

  log("Synthetic chat seeded %o", summary);

  return summary;
}

async function runSyntheticScript(
  script: SyntheticChatScript,
  dayIndex: number
): Promise<SyntheticChatNpcResult> {
  const totalTurns = script.turns.length;
  const timestampFor = createTimestampSeries(totalTurns * 2);
  const entries = [];
  let timestampIndex = 0;

  script.turns.forEach((turn) => {
    const playerEntry = appendConversationEntry({
      npcId: script.npcId,
      speaker: "player",
      text: turn.playerText,
      dayIndex,
      timestamp: timestampFor(timestampIndex++),
    });
    const npcEntry = appendConversationEntry({
      npcId: script.npcId,
      speaker: "npc",
      text: turn.npcText,
      dayIndex,
      timestamp: timestampFor(timestampIndex++),
    });
    entries.push(playerEntry, npcEntry);
  });

  const memoryResult = await extractAndStoreMemories(script.npcId, entries);

  return {
    npcId: script.npcId,
    entryCount: entries.length,
    factsAdded: memoryResult.addedFacts.length,
  };
}

function resolveDayIndex(dayIndex?: number) {
  if (dayIndex === undefined) return getActiveDayIndex();
  if (!Number.isFinite(dayIndex)) return getActiveDayIndex();
  return Math.max(1, Math.floor(dayIndex));
}

function resolveScriptsForRoster(roster: NpcRosterEntry[]) {
  const scriptMap = new Map(SYNTHETIC_CHAT_SCRIPTS.map((script) => [script.npcId, script]));

  return roster.map((npc) => scriptMap.get(npc.id) ?? createFallbackScript(npc));
}

function createFallbackScript(npc: NpcRosterEntry): SyntheticChatScript {
  return {
    npcId: npc.id,
    turns: [
      {
        playerText: `I feel grateful for how calm the plaza felt today, ${npc.name}.`,
        npcText: `${npc.name} nods thoughtfully and listens.`,
      },
      {
        playerText: "I like warm tea, and I plan to rest tomorrow.",
        npcText: `${npc.name} smiles and offers a gentle suggestion.`,
      },
    ],
  };
}

function createTimestampSeries(totalEntries: number) {
  const base = Date.now();
  const maxIndex = Math.max(1, totalEntries);

  return function timestampFor(index: number) {
    const offset = Math.min(index, maxIndex - 1);
    return new Date(base + offset * 1000).toISOString();
  };
}

const SYNTHETIC_CHAT_SCRIPTS: SyntheticChatScript[] = [
  {
    npcId: "mira",
    turns: [
      {
        playerText: "I feel happy today because the hall looks cozy!",
        npcText: "That warmth makes the whole town shine.",
      },
      {
        playerText: "I love chamomile tea and berry scones.",
        npcText: "That sounds like the perfect treat.",
      },
      {
        playerText: "My friend Lila will visit tomorrow to help decorate.",
        npcText: "A friend visit always lifts the mood.",
      },
      {
        playerText: "I plan to host a small music night this weekend.",
        npcText: "That event will bring everyone together.",
      },
    ],
  },
  {
    npcId: "theo",
    turns: [
      {
        playerText: "I built a cedar bench for the plaza this morning.",
        npcText: "Handmade pieces make the plaza feel loved.",
      },
      {
        playerText: "I need more oak planks for the bridge repairs.",
        npcText: "I will keep an eye out for extra lumber.",
      },
      {
        playerText: "I'm stressed about finishing the workshop on time.",
        npcText: "We can pace the work and still do it well.",
      },
      {
        playerText: "My brother visits next week to help me build.",
        npcText: "Extra hands will make the project smoother.",
      },
    ],
  },
  {
    npcId: "jun",
    turns: [
      {
        playerText: "I enjoy tending the tulips and roses near the creek.",
        npcText: "The gardens look brighter with your care.",
      },
      {
        playerText: "I picked up a rare seed from the market today.",
        npcText: "That seed could make a lovely new patch.",
      },
      {
        playerText: "I want to plant a new herb patch by the fence.",
        npcText: "Herbs will add a fresh scent to the air.",
      },
      {
        playerText: "I went to the creek and felt calm in the breeze.",
        npcText: "The creek always brings a peaceful rhythm.",
      },
    ],
  },
  {
    npcId: "pia",
    turns: [
      {
        playerText: "I went to the coast and met a friendly trader.",
        npcText: "New contacts keep the market lively.",
      },
      {
        playerText: "I like honey bread and citrus jam the most.",
        npcText: "Those are always top picks at the stalls.",
      },
      {
        playerText: "I'm worried about the rain tomorrow slowing deliveries.",
        npcText: "We can plan for the weather and stay prepared.",
      },
      {
        playerText: "I found a lantern and bought fresh fruit on the way back.",
        npcText: "That sounds like a productive trip.",
      },
    ],
  },
];

interface SyntheticChatOptions {
  dayIndex?: number;
  reset?: boolean;
}

interface SyntheticChatResult {
  dayIndex: number;
  totalEntries: number;
  totalFactsAdded: number;
  totalFacts: number;
  generatedAt: string;
  mode: "append" | "reset";
  perNpcResults: SyntheticChatNpcResult[];
}

interface SyntheticChatNpcResult {
  npcId: string;
  entryCount: number;
  factsAdded: number;
}

interface SyntheticChatScript {
  npcId: string;
  turns: SyntheticChatTurn[];
}

interface SyntheticChatTurn {
  playerText: string;
  npcText: string;
}

interface NpcRosterEntry {
  id: string;
  name: string;
  role: string;
}
