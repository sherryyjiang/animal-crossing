# Phaser Best Practices (Camera, Collisions, Interactions)

## Camera
- Set world bounds and align camera bounds with the physics world.
- Use `startFollow` for the player so the scene scrolls smoothly.
- Keep UI/HUD elements on a separate scene or set scrollFactor to 0.
- Phaser culls off-camera sprites automatically; avoid disabling culling unless needed.

## Collisions
- Use Arcade physics as the default for a top-down village (fast AABB).
- Use static bodies/groups for walls, buildings, and scenery.
- Keep collision shapes simple and smaller than the sprite when needed.
- Prefer `collider` for physical blocking, `overlap` for triggers.
- Avoid unnecessary collision pairs to reduce CPU overhead.

## Interaction Triggers
- Create invisible overlap zones (rectangles) for NPCs, doors, and props.
- Use `overlap` callbacks to set a "canInteract" flag and show prompts.
- Gate interactions with a key press rather than auto-triggering.
- Disable physics bodies for off-screen or inactive triggers when possible.

