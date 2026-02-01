import Phaser from "phaser";

export class VillageScene extends Phaser.Scene {
  constructor() {
    super("VillageScene");
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0xf6efe7).setOrigin(0);
    this.add.rectangle(width / 2, height * 0.7, width * 0.9, height * 0.35, 0xe1f0e9);
    this.add.rectangle(width / 2, height * 0.35, width * 0.6, height * 0.35, 0xfce8d4);

    this.add.text(width / 2, height * 0.18, "Ralph Village", {
      fontFamily: "Nunito, system-ui, sans-serif",
      fontSize: "32px",
      color: "#6b5f5a",
    }).setOrigin(0.5);
  }
}
