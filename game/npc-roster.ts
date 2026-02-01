export function getNpcRoster() {
  return [...NPC_ROSTER];
}

export function getNpcIds() {
  return NPC_ROSTER.map((npc) => npc.id);
}

export function getNpcById(npcId: string) {
  return NPC_ROSTER.find((npc) => npc.id === npcId) ?? null;
}

const NPC_ROSTER: NpcRosterEntry[] = [
  { id: "mira", name: "Mira", role: "Hall Host" },
  { id: "theo", name: "Theo", role: "Carpenter" },
  { id: "jun", name: "Jun", role: "Garden Keeper" },
  { id: "pia", name: "Pia", role: "Market Scout" },
];

interface NpcRosterEntry {
  id: string;
  name: string;
  role: string;
}
