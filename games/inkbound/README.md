# Inkbound

A third-person Godot 4.6 platform-action prototype. Recover the sigil in each of three connected environments and cross the lit exit arch.

- **The Drowned Reliquary** has flooded masonry, cyan lancet windows, and short jumps between staggered platforms.
- **The Briar Arcade** climbs through a ruined colonnade overtaken by trees.
- **The White Watch** crosses an exposed, icy cliffside to a mountaintop gate.

## Play

Import `games/inkbound/project.godot` in the Godot 4.6 Project Manager, then press **F5**. From the Rouge Warden repository root, you can also launch it from a terminal.

```sh
godot --path games/inkbound
```

The three room meshes and rigged character are included in the checkout. Godot is the only dependency for playing.

| Input | Action |
|---|---|
| WASD | Move relative to the camera |
| Mouse or Q / E | Orbit the camera |
| Space | Jump, then press again for an air jump |
| Shift or right click | Dash on the ground or in the air |
| Left click or J | Slash. Tap again to chain up to three strikes |
| R | Reset to the current checkpoint |
| Esc | Release or recapture the cursor |
| F1 | Pin the controls at full opacity |

Falls and depleted health return you to the current room’s entrance. An already collected sigil remains collected. Enemies telegraph an attack with a red marker. The dash gives a brief dodge window.

## Edit and rebake

Set platform footprints, checkpoints, gates and enemy positions in `art/course.json`. Edit the Ink Studio environment generator in `tools/bake.js`, scene lighting and materials in `scenery.gd` and `shaders/`, and movement and combat tuning in `world.gd`. The supplied meshes let the game run immediately in Godot.

The bake uses [Shapeshift Labs Ink Studio](https://github.com/siliconjungle/shapeshift-labs-ink-studio) at commit `af97f1a53f9ef6bb27ddab5c908a1c6d7180594a`. With that repository checked out and Node 18 or later installed, run this command from the project folder.

```sh
INK_STUDIO_PATH=/absolute/path/to/shapeshift-labs-ink-studio node tools/bake.js
```

Append `0`, `1` or `2` to rebuild only the corresponding room. Ink Studio applies dual contouring to the signed-distance stone and rock shapes. The bake assembles the geometry with panes, foliage, mesh normals and vertex colors into room meshes. Godot loads those meshes and applies the scene materials. The platform layout also supplies box collision for the playable route.

## Ashwarden model and motion

The player is a skinned GLB with the hood, armor, articulated limbs, split coat, scarf and sword assembled as a single model. Blender's 1,024-pixel material maps are embedded in the GLB. The Godot pose driver in `hero.gd` blends the run, jump, fall, landing, dash and combo poses. It samples the moving sword to draw the slash trail.

The editing source is included as `tools/build_hero.py`. Run it with Blender 4.3 or later to rebuild the GLB from scratch.

```sh
blender --background --python tools/build_hero.py
```

To also write an editable Blender scene with the packed texture masters, append `-- --blend /path/to/ashwarden.blend`.
