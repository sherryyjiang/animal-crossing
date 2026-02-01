import Phaser from "phaser";
import { createGameConfig } from "./config/game-config";

export interface CreateGameOptions {
  parent: HTMLElement;
  width: number;
  height: number;
}

export function createGame(options: CreateGameOptions): Phaser.Game {
  return new Phaser.Game(createGameConfig(options));
}
