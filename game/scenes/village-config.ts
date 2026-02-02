export function getSceneConfig(): SceneConfig {
  return SCENE_CONFIG;
}

export function getNpcPrompt(npc: NpcConfig) {
  return `Press E or Space to talk to ${npc.name}`;
}

export const SCENE_CONFIG = {
  mapWidth: 1600,
  mapHeight: 1000,
  cameraLerp: 0.12,
  playerSpeed: 220,
  playerSize: { width: 28, height: 36 },
  playerStart: { x: 240, y: 520 },
  colors: {
    background: 0xf0e6da,
    grass: 0xbfd9c6,
    plaza: 0xebbfa0,
    player: 0x6aa7e0,
    path: 0xd2a47f,
    sand: 0xe6c9a9,
    water: 0x8bbadf,
    waterEdge: 0x5b8fb3,
    treeCanopy: 0x7fbf78,
    treeHighlight: 0xb5e3a8,
    treeTrunk: 0x9a6c4f,
    flowerPink: 0xe97f9a,
    flowerYellow: 0xf1d06a,
    flowerLavender: 0xbda6e6,
    fence: 0xc3a488,
    fenceRail: 0xd6c1a8,
    npcShadow: 0x5c524a,
    signBoard: 0xf6e9d9,
    signPost: 0xb9977b,
    plazaMote: 0xf7ead8,
    waterLily: 0xbfe3e8,
  },
  terrain: {
    meadow: { x: 80, y: 240, width: 1440, height: 680, radius: 180 },
    plaza: { x: 360, y: 140, width: 880, height: 380, radius: 160 },
    paths: [
      { x: 520, y: 420, width: 140, height: 460, radius: 48 },
      { x: 520, y: 420, width: 520, height: 120, radius: 48 },
      { x: 820, y: 240, width: 120, height: 260, radius: 40 },
    ],
    sandyPatches: [
      { x: 180, y: 720, width: 220, height: 140, radius: 40 },
      { x: 1160, y: 560, width: 200, height: 120, radius: 36 },
    ],
    ponds: [
      { x: 1180, y: 280, width: 240, height: 150 },
      { x: 260, y: 360, width: 190, height: 120 },
    ],
    flowerBeds: [
      { x: 460, y: 280, width: 120, height: 90, spacing: 26, flowerRadius: 6 },
      { x: 660, y: 300, width: 130, height: 90, spacing: 26, flowerRadius: 6 },
      { x: 980, y: 640, width: 160, height: 90, spacing: 28, flowerRadius: 6 },
    ],
    trees: [
      { x: 150, y: 260, canopyWidth: 80, canopyHeight: 70, canopyOffset: 30, trunkWidth: 16, trunkHeight: 28 },
      { x: 220, y: 520, canopyWidth: 90, canopyHeight: 76, canopyOffset: 32, trunkWidth: 16, trunkHeight: 28 },
      { x: 320, y: 760, canopyWidth: 88, canopyHeight: 74, canopyOffset: 32, trunkWidth: 16, trunkHeight: 30 },
      { x: 860, y: 160, canopyWidth: 92, canopyHeight: 80, canopyOffset: 34, trunkWidth: 16, trunkHeight: 30 },
      { x: 1280, y: 380, canopyWidth: 86, canopyHeight: 72, canopyOffset: 30, trunkWidth: 16, trunkHeight: 28 },
      { x: 1360, y: 660, canopyWidth: 92, canopyHeight: 78, canopyOffset: 32, trunkWidth: 16, trunkHeight: 30 },
    ],
    fences: [
      { x: 520, y: 700, length: 260, gap: 28, postWidth: 10, postHeight: 20, direction: "horizontal" },
      { x: 920, y: 700, length: 220, gap: 28, postWidth: 10, postHeight: 20, direction: "horizontal" },
      { x: 1080, y: 760, length: 140, gap: 26, postWidth: 10, postHeight: 20, direction: "vertical" },
    ],
  },
  obstacles: [
    { x: 420, y: 300, width: 220, height: 140, color: 0xd8b08c, label: "Community Hall" },
    { x: 1150, y: 720, width: 260, height: 160, color: 0xd9a3b6, label: "Craft Shop" },
    { x: 950, y: 320, width: 140, height: 100, color: 0xaecbb6, label: "Grove" },
    { x: 720, y: 820, width: 180, height: 120, color: 0xe1c479, label: "Market" },
  ],
  interactionTarget: {
    x: 640,
    y: 520,
    size: { width: 32, height: 24 },
    range: { width: 110, height: 90 },
    color: 0xf7b6c2,
    label: "Notice Board",
    prompt: "Press E or Space to read",
    dialoguePrompt: "Share a quick note about your day.",
  },
  npcs: [
    {
      id: "mira",
      name: "Mira",
      role: "Hall Host",
      x: 360,
      y: 430,
      colors: { body: 0xf6c0d6, accent: 0xfbe2ec, face: 0x5f5a54 },
      size: { width: 42, height: 52 },
      collider: { width: 34, height: 36 },
      sign: { label: "Community Hall", offsetX: -80, offsetY: -10 },
      idle: { bob: 6, duration: 1800, delay: 150 },
    },
    {
      id: "theo",
      name: "Theo",
      role: "Carpenter",
      x: 1180,
      y: 840,
      colors: { body: 0xbfe4f4, accent: 0xdff1fb, face: 0x55646b },
      size: { width: 44, height: 54 },
      collider: { width: 36, height: 38 },
      sign: { label: "Craft Shop", offsetX: 90, offsetY: -20 },
      idle: { bob: 7, duration: 1700, delay: 300 },
    },
    {
      id: "jun",
      name: "Jun",
      role: "Garden Keeper",
      x: 980,
      y: 430,
      colors: { body: 0xc9e9d1, accent: 0xe3f4e8, face: 0x55624f },
      size: { width: 40, height: 50 },
      collider: { width: 32, height: 34 },
      sign: { label: "Grove", offsetX: 70, offsetY: -20 },
      idle: { bob: 5, duration: 1900, delay: 90 },
    },
    {
      id: "pia",
      name: "Pia",
      role: "Market Scout",
      x: 580,
      y: 820,
      colors: { body: 0xf6ddb1, accent: 0xfdeccc, face: 0x6a5c4f },
      size: { width: 46, height: 56 },
      collider: { width: 38, height: 40 },
      sign: { label: "Market Corner", offsetX: -90, offsetY: -20 },
      idle: { bob: 6, duration: 1750, delay: 220 },
    },
  ],
  ambient: {
    treeSway: { offset: 2, duration: 2800, delay: 200, variance: 500 },
    pondShimmers: [
      { offsetX: -0.18, offsetY: -0.12, widthScale: 0.22, heightScale: 0.16, alpha: 0.22, duration: 2200, delay: 0 },
      { offsetX: 0.16, offsetY: 0.1, widthScale: 0.18, heightScale: 0.14, alpha: 0.18, duration: 2400, delay: 600 },
    ],
    pondLilies: [
      { offsetX: -0.05, offsetY: 0.12, widthScale: 0.12, heightScale: 0.08, alpha: 0.5, duration: 3000, delay: 300, drift: 4 },
      { offsetX: 0.2, offsetY: -0.05, widthScale: 0.1, heightScale: 0.07, alpha: 0.45, duration: 3200, delay: 900, drift: 5 },
    ],
    plazaMotes: [
      { xPercent: 0.25, yPercent: 0.3, radius: 3, alpha: 0.6, drift: 8, duration: 3200, delay: 200 },
      { xPercent: 0.6, yPercent: 0.25, radius: 2.5, alpha: 0.55, drift: 6, duration: 2800, delay: 500 },
      { xPercent: 0.42, yPercent: 0.45, radius: 3, alpha: 0.5, drift: 7, duration: 3000, delay: 700 },
      { xPercent: 0.72, yPercent: 0.5, radius: 2, alpha: 0.45, drift: 6, duration: 2600, delay: 400 },
      { xPercent: 0.35, yPercent: 0.62, radius: 2.5, alpha: 0.5, drift: 7, duration: 3100, delay: 900 },
    ],
  },
} satisfies SceneConfig;

export interface SceneConfig {
  mapWidth: number;
  mapHeight: number;
  cameraLerp: number;
  playerSpeed: number;
  playerSize: { width: number; height: number };
  playerStart: { x: number; y: number };
  colors: {
    background: number;
    grass: number;
    plaza: number;
    player: number;
    path: number;
    sand: number;
    water: number;
    waterEdge: number;
    treeCanopy: number;
    treeHighlight: number;
    treeTrunk: number;
    flowerPink: number;
    flowerYellow: number;
    flowerLavender: number;
    fence: number;
    fenceRail: number;
    npcShadow: number;
    signBoard: number;
    signPost: number;
    plazaMote: number;
    waterLily: number;
  };
  terrain: TerrainConfig;
  obstacles: ObstacleConfig[];
  interactionTarget: InteractionTargetConfig;
  npcs: NpcConfig[];
  ambient: AmbientConfig;
}

export interface ObstacleConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  label?: string;
}

export interface InteractionTargetConfig {
  x: number;
  y: number;
  size: { width: number; height: number };
  range: { width: number; height: number };
  color: number;
  label: string;
  prompt: string;
  dialoguePrompt: string;
}

export interface NpcConfig {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  colors: {
    body: number;
    accent: number;
    face: number;
  };
  size: { width: number; height: number };
  collider: { width: number; height: number };
  sign: { label: string; offsetX: number; offsetY: number };
  idle: { bob: number; duration: number; delay: number };
}

export interface TerrainConfig {
  meadow: RoundedRectConfig;
  plaza: RoundedRectConfig;
  paths: RoundedRectConfig[];
  sandyPatches: RoundedRectConfig[];
  ponds: EllipseConfig[];
  flowerBeds: FlowerBedConfig[];
  trees: TreeConfig[];
  fences: FenceConfig[];
}

export interface RoundedRectConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface EllipseConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowerBedConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  spacing: number;
  flowerRadius: number;
}

export interface TreeConfig {
  x: number;
  y: number;
  canopyWidth: number;
  canopyHeight: number;
  canopyOffset: number;
  trunkWidth: number;
  trunkHeight: number;
}

export interface FenceConfig {
  x: number;
  y: number;
  length: number;
  gap: number;
  postWidth: number;
  postHeight: number;
  direction: "horizontal" | "vertical";
}

export interface AmbientConfig {
  treeSway: TreeSwayConfig;
  pondShimmers: PondShimmerConfig[];
  pondLilies: PondLilyConfig[];
  plazaMotes: PlazaMoteConfig[];
}

export interface TreeSwayConfig {
  offset: number;
  duration: number;
  delay: number;
  variance: number;
}

export interface PondShimmerConfig {
  offsetX: number;
  offsetY: number;
  widthScale: number;
  heightScale: number;
  alpha: number;
  duration: number;
  delay: number;
}

export interface PondLilyConfig {
  offsetX: number;
  offsetY: number;
  widthScale: number;
  heightScale: number;
  alpha: number;
  duration: number;
  delay: number;
  drift: number;
}

export interface PlazaMoteConfig {
  xPercent: number;
  yPercent: number;
  radius: number;
  alpha: number;
  drift: number;
  duration: number;
  delay: number;
}
