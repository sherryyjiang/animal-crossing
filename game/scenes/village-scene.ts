import debug from "debug";
import Phaser from "phaser";

export class VillageScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: MovementKeys;
  private interactKeys: Phaser.Input.Keyboard.Key[] = [];
  private player?: Phaser.GameObjects.Rectangle;
  private playerBody?: Phaser.Physics.Arcade.Body;
  private interactionZone?: Phaser.GameObjects.Zone;
  private interactionPrompt?: Phaser.GameObjects.Text;
  private isPlayerInRange = false;
  private movementVector = new Phaser.Math.Vector2();

  constructor() {
    super("VillageScene");
  }

  create() {
    const config = getSceneConfig();

    this.physics.world.setBounds(0, 0, config.mapWidth, config.mapHeight);
    this.cameras.main.setBounds(0, 0, config.mapWidth, config.mapHeight);

    this.add.rectangle(0, 0, config.mapWidth, config.mapHeight, config.colors.background).setOrigin(0);
    this.add.rectangle(
      config.mapWidth / 2,
      config.mapHeight * 0.7,
      config.mapWidth * 0.9,
      config.mapHeight * 0.35,
      config.colors.grass
    );
    this.add.rectangle(
      config.mapWidth / 2,
      config.mapHeight * 0.35,
      config.mapWidth * 0.6,
      config.mapHeight * 0.35,
      config.colors.plaza
    );

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
    obstacles.forEach((obstacle) => {
      this.physics.add.collider(player, obstacle);
    });

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
  }

  update() {
    if (!this.playerBody) return;

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

    log("Interaction triggered at %o", {
      x: this.player.x,
      y: this.player.y,
      target: getSceneConfig().interactionTarget.label,
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
  },
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
  };
  obstacles: ObstacleConfig[];
  interactionTarget: InteractionTargetConfig;
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
}
