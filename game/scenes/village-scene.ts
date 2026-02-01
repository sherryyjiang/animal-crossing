import debug from "debug";
import Phaser from "phaser";
import { emitDialogueOpen, onDialogueClose } from "../events/dialogue-events";

export class VillageScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: MovementKeys;
  private interactKeys: Phaser.Input.Keyboard.Key[] = [];
  private player?: Phaser.GameObjects.Rectangle;
  private playerBody?: Phaser.Physics.Arcade.Body;
  private interactionZone?: Phaser.GameObjects.Zone;
  private interactionPrompt?: Phaser.GameObjects.Text;
  private npcColliders: Phaser.GameObjects.Rectangle[] = [];
  private isPlayerInRange = false;
  private isDialogueOpen = false;
  private movementVector = new Phaser.Math.Vector2();

  constructor() {
    super("VillageScene");
  }

  create() {
    const config = getSceneConfig();

    this.physics.world.setBounds(0, 0, config.mapWidth, config.mapHeight);
    this.cameras.main.setBounds(0, 0, config.mapWidth, config.mapHeight);

    this.add.rectangle(0, 0, config.mapWidth, config.mapHeight, config.colors.background).setOrigin(0);
    createVillageLayout(this, config);

    this.add.text(config.mapWidth / 2, config.mapHeight * 0.18, "Ralph Village", {
      fontFamily: "Nunito, system-ui, sans-serif",
      fontSize: "32px",
      color: "#6b5f5a",
    }).setOrigin(0.5);

    const player = this.add.rectangle(
      config.playerStart.x,
      config.playerStart.y,
      config.playerSize.width,
      config.playerSize.height,
      config.colors.player
    );
    player.setDepth(2);
    this.physics.add.existing(player);

    const playerBody = player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCollideWorldBounds(true);
    playerBody.setSize(config.playerSize.width, config.playerSize.height, true);
    playerBody.setMaxVelocity(config.playerSpeed, config.playerSpeed);

    this.player = player;
    this.playerBody = playerBody;

    const obstacles = config.obstacles.map((obstacle) => createStaticObstacle(this, obstacle));
    obstacles.forEach((obstacle) => this.physics.add.collider(player, obstacle));

    this.npcColliders = config.npcs.map((npc) => createNpc(this, npc, config.colors));
    this.npcColliders.forEach((collider) => this.physics.add.collider(player, collider));

    const interaction = config.interactionTarget;
    this.add.rectangle(
      interaction.x,
      interaction.y,
      interaction.size.width,
      interaction.size.height,
      interaction.color
    );
    this.add.text(interaction.x, interaction.y - interaction.size.height, interaction.label, {
      fontFamily: "Nunito, system-ui, sans-serif",
      fontSize: "16px",
      color: "#6b5f5a",
    }).setOrigin(0.5, 1);

    const interactionZone = this.add.zone(
      interaction.x,
      interaction.y,
      interaction.range.width,
      interaction.range.height
    );
    this.physics.add.existing(interactionZone);
    const interactionBody = interactionZone.body as Phaser.Physics.Arcade.Body;
    interactionBody.setAllowGravity(false);
    interactionBody.setImmovable(true);

    this.interactionZone = interactionZone;
    this.interactionPrompt = this.add.text(
      interaction.x,
      interaction.y + interaction.range.height / 2 + 8,
      interaction.prompt,
      {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontSize: "14px",
        color: "#5e564f",
        backgroundColor: "#fef8f3",
        padding: { x: 6, y: 4 },
      }
    );
    this.interactionPrompt.setOrigin(0.5, 0);
    this.interactionPrompt.setVisible(false);

    this.cursors = this.input.keyboard?.createCursorKeys();
    if (this.input.keyboard) {
      this.wasdKeys = createWASDKeys(this.input.keyboard);
      this.interactKeys = [
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      ];
    }

    this.cameras.main.startFollow(player, true, config.cameraLerp, config.cameraLerp);

    const unsubscribeClose = onDialogueClose(() => {
      this.isDialogueOpen = false;
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeClose();
    });
  }

  update() {
    if (!this.playerBody) return;

    if (this.isDialogueOpen) {
      this.playerBody.setVelocity(0, 0);
      return;
    }

    this.applyMovement();
    this.updateInteractionState();
  }

  private applyMovement() {
    if (!this.playerBody) return;
    const { playerSpeed } = getSceneConfig();

    const movementVector = this.movementVector;
    movementVector.set(0, 0);

    if (this.cursors?.left.isDown || this.wasdKeys?.left.isDown) movementVector.x -= 1;
    if (this.cursors?.right.isDown || this.wasdKeys?.right.isDown) movementVector.x += 1;
    if (this.cursors?.up.isDown || this.wasdKeys?.up.isDown) movementVector.y -= 1;
    if (this.cursors?.down.isDown || this.wasdKeys?.down.isDown) movementVector.y += 1;

    if (movementVector.lengthSq() > 0) {
      movementVector.normalize().scale(playerSpeed);
      this.playerBody.setVelocity(movementVector.x, movementVector.y);
      return;
    }

    this.playerBody.setVelocity(0, 0);
  }

  private updateInteractionState() {
    if (!this.player || !this.interactionZone) return;

    this.isPlayerInRange = false;
    this.physics.overlap(this.player, this.interactionZone, () => {
      this.isPlayerInRange = true;
    });

    this.interactionPrompt?.setVisible(this.isPlayerInRange);

    if (!this.isPlayerInRange || this.interactKeys.length === 0) return;

    const isInteractPressed = this.interactKeys.some((key) =>
      Phaser.Input.Keyboard.JustDown(key)
    );
    if (!isInteractPressed) return;

    const interactionTarget = getSceneConfig().interactionTarget;
    this.isDialogueOpen = true;
    this.interactionPrompt?.setVisible(false);
    emitDialogueOpen({
      npcId: "notice-board",
      npcName: interactionTarget.label,
      npcRole: "Bulletin Board",
      prompt: interactionTarget.dialoguePrompt,
    });

    log("Interaction triggered at %o", {
      x: this.player.x,
      y: this.player.y,
      target: interactionTarget.label,
    });
  }
}

function createWASDKeys(input: Phaser.Input.Keyboard.KeyboardPlugin): MovementKeys {
  const keys = input.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;

  return {
    up: keys.W,
    left: keys.A,
    down: keys.S,
    right: keys.D,
  };
}

function createStaticObstacle(
  scene: Phaser.Scene,
  obstacle: ObstacleConfig
): Phaser.GameObjects.Rectangle {
  const rectangle = scene.add.rectangle(
    obstacle.x,
    obstacle.y,
    obstacle.width,
    obstacle.height,
    obstacle.color
  );
  scene.physics.add.existing(rectangle, true);

  if (obstacle.label) {
    scene.add.text(obstacle.x, obstacle.y - obstacle.height / 2 - 8, obstacle.label, {
      fontFamily: "Nunito, system-ui, sans-serif",
      fontSize: "14px",
      color: "#6b5f5a",
    }).setOrigin(0.5, 1);
  }

  return rectangle;
}

function createVillageLayout(scene: Phaser.Scene, config: SceneConfig) {
  const { colors, terrain } = config;

  const base = scene.add.graphics();
  base.setDepth(0);

  base.fillStyle(colors.grass, 1);
  base.fillRoundedRect(
    terrain.meadow.x,
    terrain.meadow.y,
    terrain.meadow.width,
    terrain.meadow.height,
    terrain.meadow.radius
  );

  base.fillStyle(colors.plaza, 1);
  base.fillRoundedRect(
    terrain.plaza.x,
    terrain.plaza.y,
    terrain.plaza.width,
    terrain.plaza.height,
    terrain.plaza.radius
  );

  base.fillStyle(colors.path, 1);
  terrain.paths.forEach((path) => {
    base.fillRoundedRect(path.x, path.y, path.width, path.height, path.radius);
  });

  base.fillStyle(colors.sand, 1);
  terrain.sandyPatches.forEach((patch) => {
    base.fillRoundedRect(patch.x, patch.y, patch.width, patch.height, patch.radius);
  });

  base.fillStyle(colors.water, 1);
  terrain.ponds.forEach((pond) => {
    base.fillEllipse(pond.x, pond.y, pond.width, pond.height);
  });

  base.lineStyle(2, colors.waterEdge, 1);
  terrain.ponds.forEach((pond) => {
    base.strokeEllipse(pond.x, pond.y, pond.width, pond.height);
  });

  terrain.flowerBeds.forEach((bed) => {
    createFlowerPatch(scene, bed, colors);
  });

  terrain.trees.forEach((tree) => {
    createTree(scene, tree, colors);
  });

  terrain.fences.forEach((fence) => {
    createFence(scene, fence, colors);
  });
}

function createTree(scene: Phaser.Scene, tree: TreeConfig, colors: SceneConfig["colors"]) {
  const trunk = scene.add.rectangle(
    tree.x,
    tree.y + tree.trunkHeight / 2,
    tree.trunkWidth,
    tree.trunkHeight,
    colors.treeTrunk
  );
  trunk.setDepth(1);

  const canopy = scene.add.ellipse(
    tree.x,
    tree.y - tree.canopyOffset,
    tree.canopyWidth,
    tree.canopyHeight,
    colors.treeCanopy
  );
  canopy.setDepth(1);

  const highlight = scene.add.ellipse(
    tree.x - tree.canopyWidth * 0.12,
    tree.y - tree.canopyOffset - tree.canopyHeight * 0.08,
    tree.canopyWidth * 0.38,
    tree.canopyHeight * 0.32,
    colors.treeHighlight
  );
  highlight.setDepth(2);
}

function createFlowerPatch(scene: Phaser.Scene, bed: FlowerBedConfig, colors: SceneConfig["colors"]) {
  const blossomColors = [colors.flowerPink, colors.flowerYellow, colors.flowerLavender];
  const rows = Math.max(1, Math.floor(bed.height / bed.spacing));
  const columns = Math.max(1, Math.floor(bed.width / bed.spacing));

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = bed.x + column * bed.spacing + bed.spacing * 0.4;
      const y = bed.y + row * bed.spacing + bed.spacing * 0.4;
      const color = blossomColors[(row + column) % blossomColors.length];
      const blossom = scene.add.circle(x, y, bed.flowerRadius, color);
      blossom.setDepth(1);
    }
  }
}

function createFence(scene: Phaser.Scene, fence: FenceConfig, colors: SceneConfig["colors"]) {
  const postCount = Math.max(2, Math.floor(fence.length / fence.gap));
  const directionVector = fence.direction === "horizontal" ? { x: 1, y: 0 } : { x: 0, y: 1 };

  for (let index = 0; index < postCount; index += 1) {
    const x = fence.x + index * fence.gap * directionVector.x;
    const y = fence.y + index * fence.gap * directionVector.y;
    const post = scene.add.rectangle(x, y, fence.postWidth, fence.postHeight, colors.fence);
    post.setDepth(1);
  }

  const rail = scene.add.rectangle(
    fence.x + (fence.length * directionVector.x) / 2,
    fence.y + (fence.length * directionVector.y) / 2,
    fence.direction === "horizontal" ? fence.length : fence.postWidth,
    fence.direction === "horizontal" ? fence.postWidth : fence.length,
    colors.fenceRail
  );
  rail.setDepth(1);
  rail.setAlpha(0.75);
}

function createNpc(
  scene: Phaser.Scene,
  npc: NpcConfig,
  colors: SceneConfig["colors"]
): Phaser.GameObjects.Rectangle {
  const npcContainer = scene.add.container(npc.x, npc.y);
  npcContainer.setDepth(3);

  const shadow = scene.add.ellipse(
    0,
    npc.size.height * 0.45,
    npc.size.width * 0.7,
    npc.size.height * 0.3,
    colors.npcShadow
  );
  shadow.setAlpha(0.35);

  const body = scene.add.ellipse(0, 0, npc.size.width, npc.size.height, npc.colors.body);
  const belly = scene.add.ellipse(
    0,
    npc.size.height * 0.1,
    npc.size.width * 0.55,
    npc.size.height * 0.45,
    npc.colors.accent
  );
  belly.setAlpha(0.7);
  const leftEye = scene.add.circle(
    -npc.size.width * 0.2,
    -npc.size.height * 0.1,
    npc.size.width * 0.08,
    npc.colors.face
  );
  const rightEye = scene.add.circle(
    npc.size.width * 0.2,
    -npc.size.height * 0.1,
    npc.size.width * 0.08,
    npc.colors.face
  );
  const blush = scene.add.circle(
    npc.size.width * 0.1,
    npc.size.height * 0.05,
    npc.size.width * 0.06,
    npc.colors.accent
  );
  blush.setAlpha(0.8);

  npcContainer.add([shadow, body, belly, leftEye, rightEye, blush]);

  const nameTag = scene.add.text(0, -npc.size.height * 0.9, npc.name, {
    fontFamily: "Nunito, system-ui, sans-serif",
    fontSize: "13px",
    color: "#6b5f5a",
  });
  nameTag.setOrigin(0.5, 1);

  const roleTag = scene.add.text(0, -npc.size.height * 0.7, npc.role, {
    fontFamily: "Nunito, system-ui, sans-serif",
    fontSize: "11px",
    color: "#8a7f78",
  });
  roleTag.setOrigin(0.5, 1);
  npcContainer.add([nameTag, roleTag]);

  createNpcSign(scene, npc, colors);

  scene.tweens.add({
    targets: npcContainer,
    y: npc.y - npc.idle.bob,
    duration: npc.idle.duration,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
    delay: npc.idle.delay,
  });

  const collider = scene.add.rectangle(
    npc.x,
    npc.y + npc.size.height * 0.2,
    npc.collider.width,
    npc.collider.height,
    0x000000,
    0
  );
  scene.physics.add.existing(collider, true);

  return collider;
}

function createNpcSign(scene: Phaser.Scene, npc: NpcConfig, colors: SceneConfig["colors"]) {
  const signX = npc.x + npc.sign.offsetX;
  const signY = npc.y + npc.sign.offsetY;
  const postHeight = 20;

  const post = scene.add.rectangle(signX, signY + postHeight / 2, 6, postHeight, colors.signPost);
  post.setDepth(2);

  const board = scene.add.rectangle(signX, signY, 120, 30, colors.signBoard);
  board.setDepth(3);

  const label = scene.add.text(signX, signY, npc.sign.label, {
    fontFamily: "Nunito, system-ui, sans-serif",
    fontSize: "12px",
    color: "#6b5f5a",
  });
  label.setOrigin(0.5);
  label.setDepth(4);
}

function getSceneConfig(): SceneConfig {
  return SCENE_CONFIG;
}

const log = debug("ralph:village");

const SCENE_CONFIG = {
  mapWidth: 1600,
  mapHeight: 1000,
  cameraLerp: 0.12,
  playerSpeed: 220,
  playerSize: { width: 28, height: 36 },
  playerStart: { x: 240, y: 520 },
  colors: {
    background: 0xf6efe7,
    grass: 0xe1f0e9,
    plaza: 0xfce8d4,
    player: 0x9cc6f3,
    path: 0xf5d6c4,
    sand: 0xf8e9d8,
    water: 0xb9dbf3,
    waterEdge: 0x8dbcd8,
    treeCanopy: 0xc8e6c9,
    treeHighlight: 0xe3f3e1,
    treeTrunk: 0xcaa58c,
    flowerPink: 0xf6b6c8,
    flowerYellow: 0xf8e2a0,
    flowerLavender: 0xd6c2f2,
    fence: 0xd7c2aa,
    fenceRail: 0xe6d7c3,
    npcShadow: 0x7a6f66,
    signBoard: 0xfaf3e8,
    signPost: 0xd9c3af,
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
    { x: 420, y: 300, width: 220, height: 140, color: 0xf4d6c4, label: "Community Hall" },
    { x: 1150, y: 720, width: 260, height: 160, color: 0xf6d6e8, label: "Craft Shop" },
    { x: 950, y: 320, width: 140, height: 100, color: 0xd9f0e5, label: "Grove" },
    { x: 720, y: 820, width: 180, height: 120, color: 0xf6e4b8, label: "Market" },
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
      y: 680,
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
      x: 930,
      y: 300,
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
      x: 700,
      y: 820,
      colors: { body: 0xf6ddb1, accent: 0xfdeccc, face: 0x6a5c4f },
      size: { width: 46, height: 56 },
      collider: { width: 38, height: 40 },
      sign: { label: "Market Corner", offsetX: -90, offsetY: -20 },
      idle: { bob: 6, duration: 1750, delay: 220 },
    },
  ],
} satisfies SceneConfig;

interface MovementKeys {
  up: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

interface SceneConfig {
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
  };
  terrain: TerrainConfig;
  obstacles: ObstacleConfig[];
  interactionTarget: InteractionTargetConfig;
  npcs: NpcConfig[];
}

interface ObstacleConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  label?: string;
}

interface InteractionTargetConfig {
  x: number;
  y: number;
  size: { width: number; height: number };
  range: { width: number; height: number };
  color: number;
  label: string;
  prompt: string;
  dialoguePrompt: string;
}

interface NpcConfig {
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

interface TerrainConfig {
  meadow: RoundedRectConfig;
  plaza: RoundedRectConfig;
  paths: RoundedRectConfig[];
  sandyPatches: RoundedRectConfig[];
  ponds: EllipseConfig[];
  flowerBeds: FlowerBedConfig[];
  trees: TreeConfig[];
  fences: FenceConfig[];
}

interface RoundedRectConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

interface EllipseConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FlowerBedConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  spacing: number;
  flowerRadius: number;
}

interface TreeConfig {
  x: number;
  y: number;
  canopyWidth: number;
  canopyHeight: number;
  canopyOffset: number;
  trunkWidth: number;
  trunkHeight: number;
}

interface FenceConfig {
  x: number;
  y: number;
  length: number;
  gap: number;
  postWidth: number;
  postHeight: number;
  direction: "horizontal" | "vertical";
}
