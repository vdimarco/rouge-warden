# Gloam Downs

## Why
The user asked: "use https://github.com/siliconjungle/shapeshift-labs-ink-studio to make environments inspired by dead cells but give it a 3d supermarket 64 vibe with rolling hills". Then: "make it look gritty and dark".

We read "supermarket 64" as Super Mario 64: the chunky, low-resolution 3D look of N64-era platformers, with rolling hills and a goal on a summit that you can see from the start. Dead Cells gives the mood: ruined stone, torch light, saturated color that is "never welcoming", and a run through a chain of different places. The user wants it gritty and dark, so every place is at dusk or at night.

Ink Studio sculpts signed-distance solids, bakes the light into pixel-art Gaussian splats, and has its own WebGL 2 renderer. Nothing in the arcade uses it yet.

## What changes
- A new Lab piece at `/lab/gloam-downs/`: five dark environments on rolling hills, each one a separate world.
  1. **The Sunken Gaol**: a prison sunk into moor hills by moonlight, with torches at the cell mouths.
  2. **Crow Ramparts**: a broken wall that rides the ridges under a storm, with braziers and red rags.
  3. **Lantern Fen**: a stilt hamlet over black water, with sick green lanterns and low mist.
  4. **The Bell Knoll**: a bronze bell tower and half-buried cogs at a blood-red dusk.
  5. **Barrow Crown**: grassy burial mounds, standing stones and a ruined keep in teal ghost fog.
- Each world is sculpted and baked offline in Node with Ink Studio (`games/gloam-downs/`), and it ships as compressed splat rows plus a walk map. The page loads only Ink Studio's renderer (vendored, MIT), not the whole toolkit.
- You walk each place as a small lamplighter, with a third-person camera. You run, jump, collect five wisps, and light the beacon on the summit. The beacon opens the way to the next place. The Map takes you back to any place you have reached.
- Keyboard, gamepad and touch controls. Progress is saved in the browser.
- The piece gets its cabinet at the end of the Lab row, its switcher entry (Lab only), its Corridor piece after Splat Isle, its Lab card and its dates.

## Scope
A Lab piece about the environments. It has no enemies, no combat and no sound. Names, places and characters are original. No name, level, character or exact look comes from Dead Cells or Super Mario 64.
