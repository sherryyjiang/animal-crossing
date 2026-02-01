import Phaser from "phaser";
import { VillageScene } from "../scenes/village-scene";

export interface GameConfigInput {
  parent: HTMLElement;
  width: number;
  height: number;
}

export function createGameConfig({
  parent,
  width,
  height,
}: GameConfigInput): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: "#e9f1fb",
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [VillageScene],
  };
}
