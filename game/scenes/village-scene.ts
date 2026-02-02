import debug from "debug";
import Phaser from "phaser";
import { emitDialogueOpen, onDialogueClose } from "../events/dialogue-events";
import {
  setupKeyboardControls,
  type CursorKeysLike,
  type MovementKeys,
} from "../input/keyboard-controls";
import {
  getNpcPrompt,
  getSceneConfig,
  type AmbientConfig,
  type EllipseConfig,
  type FenceConfig,
  type FlowerBedConfig,
  type NpcConfig,
  type ObstacleConfig,
  type PondLilyConfig,
  type PondShimmerConfig,
  type PlazaMoteConfig,
  type SceneConfig,
  type TerrainConfig,
  type TreeConfig,
} from "./village-config";

const log = debug("ralph:village");

export class VillageScene extends Phaser.Scene {
  private cursors?: CursorKeysLike;
  private wasdKeys?: MovementKeys;
  private interactKeys: Phaser.Input.Keyboard.Key[] = [];
  private player?: Phaser.GameObjects.Rectangle;
  private playerBody?: Phaser.Physics.Arcade.Body;
  private playerAvatar?: Phaser.GameObjects.Container;
  private interactionZone?: Phaser.GameObjects.Zone;
  private interactionPrompt?: Phaser.GameObjects.Text;
  private npcPrompt?: Phaser.GameObjects.Text;
  private npcColliders: Phaser.GameObjects.Rectangle[] = [];
  private npcLookup = new Map<string, NpcConfig>();
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

    const playerCollider = this.add.rectangle(
      config.playerStart.x,
      config.playerStart.y,
      config.playerSize.width,
      config.playerSize.height,
      config.colors.player
    );
    playerCollider.setAlpha(0);
    playerCollider.setDepth(2);
    this.physics.add.existing(playerCollider);

    const playerBody = playerCollider.body as Phaser.Physics.Arcade.Body;
    playerBody.setCollideWorldBounds(true);
    playerBody.setSize(config.playerSize.width, config.playerSize.height, true);
    playerBody.setMaxVelocity(config.playerSpeed, config.playerSpeed);

    this.player = playerCollider;
    this.playerBody = playerBody;
    this.playerAvatar = createPlayerAvatar(this, config, playerCollider.x, playerCollider.y);

    const obstacles = config.obstacles.map((obstacle) => createStaticObstacle(this, obstacle));
    obstacles.forEach((obstacle) => this.physics.add.collider(playerCollider, obstacle));

    this.npcColliders = config.npcs.map((npc) => createNpc(this, npc, config.colors));
    this.npcLookup = new Map(config.npcs.map((npc) => [npc.id, npc]));
    this.npcColliders.forEach((collider) => this.physics.add.collider(playerCollider, collider));

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

    this.npcPrompt = this.add.text(24, 64, "", {
      fontFamily: "Nunito, system-ui, sans-serif",
      fontSize: "14px",
      color: "#5e564f",
      backgroundColor: "#fef8f3",
      padding: { x: 8, y: 6 },
    });
    this.npcPrompt.setScrollFactor(0);
    this.npcPrompt.setDepth(5);
    this.npcPrompt.setVisible(false);

    if (this.input.keyboard) {
      const controls = setupKeyboardControls(this.input.keyboard);
      this.cursors = controls.cursors;
      this.wasdKeys = controls.wasdKeys;
      this.interactKeys = controls.interactKeys;
    }

    this.cameras.main.startFollow(playerCollider, true, config.cameraLerp, config.cameraLerp);

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

    if (this.playerAvatar && this.player) {
      this.playerAvatar.setPosition(this.player.x, this.player.y);
    }
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

    const activeNpc = this.getNpcInRange();
    const isNpcInRange = Boolean(activeNpc);

    if (this.npcPrompt) {
      this.npcPrompt.setText(activeNpc ? getNpcPrompt(activeNpc) : "");
      this.npcPrompt.setVisible(isNpcInRange);
    }
    this.interactionPrompt?.setVisible(this.isPlayerInRange && !isNpcInRange);

    if ((!this.isPlayerInRange && !isNpcInRange) || this.interactKeys.length === 0) return;

    const isInteractPressed = this.interactKeys.some((key) =>
      Phaser.Input.Keyboard.JustDown(key)
    );
    if (!isInteractPressed) return;

    if (activeNpc) {
      this.isDialogueOpen = true;
      this.interactionPrompt?.setVisible(false);
      this.npcPrompt?.setVisible(false);
      emitDialogueOpen({
        npcId: activeNpc.id,
        npcName: activeNpc.name,
        npcRole: activeNpc.role,
        prompt: `Share something with ${activeNpc.name}.`,
      });
      log("NPC interaction triggered %o", {
        npcId: activeNpc.id,
        npcName: activeNpc.name,
      });
      return;
    }

    const interactionTarget = getSceneConfig().interactionTarget;
    this.isDialogueOpen = true;
    this.interactionPrompt?.setVisible(false);
    this.npcPrompt?.setVisible(false);
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

  private getNpcInRange() {
    if (!this.player?.active) return null;
    const playerBounds = this.player.getBounds(new Phaser.Geom.Rectangle());
    for (const collider of this.npcColliders) {
      const body = collider.body as Phaser.Physics.Arcade.Body | null;
      if (!body) continue;
      const bodyBounds = new Phaser.Geom.Rectangle(body.left, body.top, body.width, body.height);
      const intersects = Phaser.Geom.Intersects.RectangleToRectangle(
        playerBounds,
        bodyBounds
      );
      if (!intersects) continue;
      const npcId = collider.getData("npcId") as string | undefined;
      if (!npcId) continue;
      const npc = this.npcLookup.get(npcId);
      if (npc) return npc;
    }
    return null;
  }
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
  rectangle.setDepth(1);
  scene.physics.add.existing(rectangle, true);

  const roofHeight = obstacle.height * 0.55;
  const roofWidth = obstacle.width * 1.1;
  const roofColor = adjustColor(obstacle.color, -40);
  const roof = scene.add.graphics();
  roof.fillStyle(roofColor, 1);
  roof.fillTriangle(
    obstacle.x - roofWidth / 2,
    obstacle.y - obstacle.height / 2,
    obstacle.x + roofWidth / 2,
    obstacle.y - obstacle.height / 2,
    obstacle.x,
    obstacle.y - obstacle.height / 2 - roofHeight
  );
  roof.setDepth(2);

  const trim = scene.add.rectangle(
    obstacle.x,
    obstacle.y - obstacle.height / 2 + 6,
    obstacle.width * 1.02,
    8,
    adjustColor(obstacle.color, 18)
  );
  trim.setDepth(2);

  const doorWidth = obstacle.width * 0.22;
  const doorHeight = obstacle.height * 0.36;
  const door = scene.add.rectangle(
    obstacle.x,
    obstacle.y + obstacle.height * 0.2,
    doorWidth,
    doorHeight,
    adjustColor(obstacle.color, -70)
  );
  door.setDepth(2);

  const knob = scene.add.circle(
    obstacle.x + doorWidth * 0.22,
    obstacle.y + obstacle.height * 0.2,
    2.6,
    adjustColor(obstacle.color, 40)
  );
  knob.setDepth(3);

  const windowWidth = Math.min(obstacle.width * 0.18, 34);
  const windowHeight = Math.min(obstacle.height * 0.22, 26);
  const windowY = obstacle.y - obstacle.height * 0.05;
  const windowOffsetX = obstacle.width * 0.25;
  const windowColor = adjustColor(obstacle.color, 55);

  const leftWindow = scene.add.rectangle(
    obstacle.x - windowOffsetX,
    windowY,
    windowWidth,
    windowHeight,
    windowColor
  );
  leftWindow.setDepth(2);
  const rightWindow = scene.add.rectangle(
    obstacle.x + windowOffsetX,
    windowY,
    windowWidth,
    windowHeight,
    windowColor
  );
  rightWindow.setDepth(2);

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
  const { colors, terrain, ambient } = config;

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
    createTree(scene, tree, colors, ambient);
  });

  terrain.fences.forEach((fence) => {
    createFence(scene, fence, colors);
  });

  createAmbientDetails(scene, terrain, colors, ambient);
}

function createTree(
  scene: Phaser.Scene,
  tree: TreeConfig,
  colors: SceneConfig["colors"],
  ambient: AmbientConfig
) {
  const canopyShadow = adjustColor(colors.treeCanopy, -22);
  const canopyMid = adjustColor(colors.treeCanopy, 12);

  const baseShadow = scene.add.ellipse(
    tree.x,
    tree.y + tree.trunkHeight * 0.75,
    tree.canopyWidth * 0.85,
    tree.canopyHeight * 0.35,
    adjustColor(colors.treeTrunk, -30)
  );
  baseShadow.setDepth(0.9);
  baseShadow.setAlpha(0.35);

  const trunk = scene.add.rectangle(
    tree.x,
    tree.y + tree.trunkHeight / 2,
    tree.trunkWidth,
    tree.trunkHeight,
    colors.treeTrunk
  );
  trunk.setDepth(1);

  const trunkHighlight = scene.add.rectangle(
    tree.x + tree.trunkWidth * 0.15,
    tree.y + tree.trunkHeight / 2,
    tree.trunkWidth * 0.35,
    tree.trunkHeight * 0.7,
    adjustColor(colors.treeTrunk, 24)
  );
  trunkHighlight.setDepth(2);
  trunkHighlight.setAlpha(0.8);

  const canopyBack = scene.add.ellipse(
    tree.x,
    tree.y - tree.canopyOffset * 1.05,
    tree.canopyWidth * 1.08,
    tree.canopyHeight * 0.92,
    canopyShadow
  );
  canopyBack.setDepth(1);

  const canopy = scene.add.ellipse(
    tree.x,
    tree.y - tree.canopyOffset,
    tree.canopyWidth,
    tree.canopyHeight,
    colors.treeCanopy
  );
  canopy.setDepth(1);

  const canopyLower = scene.add.ellipse(
    tree.x,
    tree.y - tree.canopyOffset * 0.45,
    tree.canopyWidth * 0.9,
    tree.canopyHeight * 0.6,
    canopyMid
  );
  canopyLower.setDepth(1);

  const highlight = scene.add.ellipse(
    tree.x - tree.canopyWidth * 0.12,
    tree.y - tree.canopyOffset - tree.canopyHeight * 0.08,
    tree.canopyWidth * 0.38,
    tree.canopyHeight * 0.32,
    colors.treeHighlight
  );
  highlight.setDepth(2);

  const highlightTwo = scene.add.ellipse(
    tree.x + tree.canopyWidth * 0.18,
    tree.y - tree.canopyOffset * 0.7,
    tree.canopyWidth * 0.24,
    tree.canopyHeight * 0.22,
    colors.treeHighlight
  );
  highlightTwo.setDepth(2);
  highlightTwo.setAlpha(0.85);

  scene.tweens.add({
    targets: [canopyBack, canopy, canopyLower, highlight, highlightTwo],
    y: `-=${ambient.treeSway.offset}`,
    duration: ambient.treeSway.duration,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
    delay: ambient.treeSway.delay + Phaser.Math.Between(0, ambient.treeSway.variance),
  });
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

function createAmbientDetails(
  scene: Phaser.Scene,
  terrain: TerrainConfig,
  colors: SceneConfig["colors"],
  ambient: AmbientConfig
) {
  terrain.ponds.forEach((pond) => {
    ambient.pondShimmers.forEach((shimmer) => {
      createWaterShimmer(scene, pond, shimmer, colors);
    });
    ambient.pondLilies.forEach((lily) => {
      createLilyPad(scene, pond, lily, colors);
    });
  });

  ambient.plazaMotes.forEach((mote) => {
    const x = terrain.plaza.x + terrain.plaza.width * mote.xPercent;
    const y = terrain.plaza.y + terrain.plaza.height * mote.yPercent;
    const dot = scene.add.circle(x, y, mote.radius, colors.plazaMote);
    dot.setDepth(2);
    dot.setAlpha(mote.alpha);
    scene.tweens.add({
      targets: dot,
      y: y - mote.drift,
      duration: mote.duration,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: mote.delay,
    });
    scene.tweens.add({
      targets: dot,
      alpha: mote.alpha * 0.6,
      duration: mote.duration * 0.9,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: mote.delay,
    });
  });
}

function createWaterShimmer(
  scene: Phaser.Scene,
  pond: EllipseConfig,
  shimmer: PondShimmerConfig,
  colors: SceneConfig["colors"]
) {
  const shimmerX = pond.x + pond.width * shimmer.offsetX;
  const shimmerY = pond.y + pond.height * shimmer.offsetY;
  const ellipse = scene.add.ellipse(
    shimmerX,
    shimmerY,
    pond.width * shimmer.widthScale,
    pond.height * shimmer.heightScale,
    colors.waterEdge
  );
  ellipse.setDepth(1);
  ellipse.setAlpha(shimmer.alpha);
  scene.tweens.add({
    targets: ellipse,
    alpha: shimmer.alpha * 1.5,
    duration: shimmer.duration,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
    delay: shimmer.delay,
  });
}

function createLilyPad(
  scene: Phaser.Scene,
  pond: EllipseConfig,
  lily: PondLilyConfig,
  colors: SceneConfig["colors"]
) {
  const lilyX = pond.x + pond.width * lily.offsetX;
  const lilyY = pond.y + pond.height * lily.offsetY;
  const pad = scene.add.ellipse(
    lilyX,
    lilyY,
    pond.width * lily.widthScale,
    pond.height * lily.heightScale,
    colors.waterLily
  );
  pad.setDepth(1);
  pad.setAlpha(lily.alpha);
  scene.tweens.add({
    targets: pad,
    y: lilyY - lily.drift,
    duration: lily.duration,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
    delay: lily.delay,
  });
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
  npcContainer.add(createNpcAccessory(scene, npc, colors));

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
  collider.setData("npcId", npc.id);

  return collider;
}

function createPlayerAvatar(
  scene: Phaser.Scene,
  config: SceneConfig,
  x: number,
  y: number
): Phaser.GameObjects.Container {
  const { playerSize, colors } = config;
  const avatar = scene.add.container(x, y);
  avatar.setDepth(3);

  const shadow = scene.add.ellipse(
    0,
    playerSize.height * 0.45,
    playerSize.width * 0.7,
    playerSize.height * 0.28,
    colors.npcShadow
  );
  shadow.setAlpha(0.3);

  const dress = scene.add.ellipse(
    0,
    playerSize.height * 0.18,
    playerSize.width * 0.95,
    playerSize.height * 0.9,
    colors.playerOutfit
  );
  const dressAccent = scene.add.ellipse(
    0,
    playerSize.height * 0.25,
    playerSize.width * 0.6,
    playerSize.height * 0.45,
    colors.playerOutfitAccent
  );
  dressAccent.setAlpha(0.9);

  const head = scene.add.circle(
    0,
    -playerSize.height * 0.18,
    playerSize.width * 0.3,
    colors.playerSkin
  );

  const hair = scene.add.ellipse(
    0,
    -playerSize.height * 0.27,
    playerSize.width * 0.8,
    playerSize.height * 0.6,
    colors.playerHair
  );

  const fringe = scene.add.ellipse(
    0,
    -playerSize.height * 0.32,
    playerSize.width * 0.7,
    playerSize.height * 0.3,
    adjustColor(colors.playerHair, -18)
  );

  const leftEye = scene.add.circle(
    -playerSize.width * 0.12,
    -playerSize.height * 0.2,
    playerSize.width * 0.05,
    0x4f443c
  );
  const rightEye = scene.add.circle(
    playerSize.width * 0.12,
    -playerSize.height * 0.2,
    playerSize.width * 0.05,
    0x4f443c
  );

  const blush = scene.add.circle(
    playerSize.width * 0.18,
    -playerSize.height * 0.1,
    playerSize.width * 0.06,
    0xf0a2b4
  );
  blush.setAlpha(0.7);

  const bow = scene.add.triangle(
    -playerSize.width * 0.18,
    -playerSize.height * 0.5,
    0,
    8,
    10,
    0,
    10,
    16,
    adjustColor(colors.playerOutfit, -12)
  );

  avatar.add([shadow, dress, dressAccent, hair, fringe, head, leftEye, rightEye, blush, bow]);
  return avatar;
}

function createNpcAccessory(
  scene: Phaser.Scene,
  npc: NpcConfig,
  colors: SceneConfig["colors"]
): Phaser.GameObjects.GameObject[] {
  const offsetX = npc.size.width * 0.45;
  const offsetY = npc.size.height * 0.1;

  switch (npc.accessory) {
    case "garden": {
      const leaf = scene.add.ellipse(
        offsetX,
        offsetY - 6,
        npc.size.width * 0.28,
        npc.size.height * 0.18,
        adjustColor(npc.colors.accent, -12)
      );
      const stem = scene.add.rectangle(
        offsetX,
        offsetY + 6,
        2,
        10,
        adjustColor(colors.treeTrunk, -12)
      );
      return [leaf, stem];
    }
    case "craft": {
      const head = scene.add.rectangle(
        offsetX,
        offsetY - 6,
        14,
        6,
        adjustColor(npc.colors.accent, -20)
      );
      const handle = scene.add.rectangle(
        offsetX + 4,
        offsetY + 6,
        3,
        14,
        adjustColor(colors.signPost, -30)
      );
      return [head, handle];
    }
    case "market": {
      const basket = scene.add.rectangle(
        offsetX,
        offsetY + 4,
        16,
        10,
        adjustColor(colors.path, -10)
      );
      const handle = scene.add.ellipse(
        offsetX,
        offsetY - 2,
        16,
        10,
        adjustColor(colors.path, -24)
      );
      handle.setAlpha(0.6);
      const fruit = scene.add.circle(
        offsetX - 4,
        offsetY + 4,
        2,
        0xe97f9a
      );
      return [basket, handle, fruit];
    }
    case "hall":
    default: {
      const paper = scene.add.rectangle(
        offsetX,
        offsetY + 2,
        14,
        16,
        colors.signBoard
      );
      const line1 = scene.add.rectangle(
        offsetX,
        offsetY - 4,
        10,
        2,
        adjustColor(colors.signPost, -20)
      );
      const line2 = scene.add.rectangle(
        offsetX,
        offsetY + 2,
        8,
        2,
        adjustColor(colors.signPost, -20)
      );
      return [paper, line1, line2];
    }
  }
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

function adjustColor(color: number, delta: number) {
  const rgb = Phaser.Display.Color.IntegerToColor(color);
  const r = Phaser.Math.Clamp(rgb.red + delta, 0, 255);
  const g = Phaser.Math.Clamp(rgb.green + delta, 0, 255);
  const b = Phaser.Math.Clamp(rgb.blue + delta, 0, 255);
  return Phaser.Display.Color.GetColor(r, g, b);
}
