import assert from "node:assert/strict";
import test from "node:test";
import { getSceneConfig } from "../game/scenes/village-config";

function toBounds(rect: { x: number; y: number; width: number; height: number }) {
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  return {
    left: rect.x - halfW,
    right: rect.x + halfW,
    top: rect.y - halfH,
    bottom: rect.y + halfH,
  };
}

function overlaps(a: ReturnType<typeof toBounds>, b: ReturnType<typeof toBounds>) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

test("places NPC colliders outside obstacle rectangles", () => {
  const config = getSceneConfig();

  const obstacles = config.obstacles.map((obstacle: { x: number; y: number; width: number; height: number }) =>
    toBounds({
      x: obstacle.x,
      y: obstacle.y,
      width: obstacle.width,
      height: obstacle.height,
    })
  );

  for (const npc of config.npcs) {
    const colliderY = npc.y + npc.size.height * 0.2;
    const npcBounds = toBounds({
      x: npc.x,
      y: colliderY,
      width: npc.collider.width,
      height: npc.collider.height,
    });

    for (const obstacleBounds of obstacles) {
      assert.equal(overlaps(npcBounds, obstacleBounds), false);
    }
  }
});

test("each NPC provides an accessory icon key", () => {
  const config = getSceneConfig();
  for (const npc of config.npcs) {
    const accessory = (npc as { accessory?: string }).accessory;
    assert.ok(accessory);
  }
});
