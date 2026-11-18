# Design

## Placement and startup

Follow the standalone project layout used by `games/nord-unreal/`. Keep Godot's `res://` paths relative to `games/inkbound/project.godot`. Check in the course layout, room geometry, and character GLB so Godot 4.6 can launch directly from a sparse checkout.

## Art and motion

The environment generator uses the dual contouring implementation in Shapeshift Labs Ink Studio at `af97f1a53f9ef6bb27ddab5c908a1c6d7180594a`. The included Blender generator builds the Ashwarden's mesh, materials, and skeleton. The Godot pose driver and input timing travel with the imported project. Keep the baked assets with the source that regenerates them. [Ink Studio](https://github.com/siliconjungle/shapeshift-labs-ink-studio/tree/af97f1a53f9ef6bb27ddab5c908a1c6d7180594a)

## Verification

Run a clean checkout in Godot 4.6. Test physics at a fixed timestep, including a complete run to the final gate. Inspect the player, HUD and route from the normal desktop camera. Opening the native project requires Godot. Node.js and Blender are optional asset-authoring tools.
