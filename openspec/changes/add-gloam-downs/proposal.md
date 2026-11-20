# Gloam Downs

## Why
The user asked: "use https://github.com/siliconjungle/shapeshift-labs-ink-studio to make environments inspired by dead cells but give it a 3d supermarket 64 vibe with rolling hills". Then: "make it look gritty and dark".

We read "supermarket 64" as Super Mario 64: the chunky, low-resolution 3D look of N64-era platformers. It has rolling hills and a goal on a summit that you can see from the start. Dead Cells gives the mood: ruined stone, torch light, and saturated color that is "never welcoming". It also gives a run through a chain of different places. The user wants it gritty and dark, so every place is at dusk or at night.

Ink Studio sculpts signed-distance solids, bakes the light into pixel-art Gaussian splats, and has its own WebGL 2 renderer. Nothing in the arcade uses it yet.

Then: "beautiful now can we turn this into a playable game?" So the walk becomes a combat run in the spirit of Dead Cells. The places and the look stay the same.

## What changes
- A new Lab piece at `/lab/gloam-downs/`: five dark environments on rolling hills, each one a separate world.
  1. **The Sunken Gaol**: a prison sunk into moor hills by moonlight, with torches at the cell mouths.
  2. **The Crow Wall**: a broken wall that rides the ridges under a storm, with braziers and red rags.
  3. **Lantern Fen**: a stilt hamlet over black water, with sick green lanterns and low mist.
  4. **The Bell Knoll**: a bronze bell tower and half-buried cogs at a blood-red dusk.
  5. **Barrow Crown**: grassy burial mounds, standing stones and a ruined keep in teal ghost fog.
- Each world is sculpted and baked offline in Node with Ink Studio (`games/gloam-downs/`), and it ships as compressed splat rows plus a walk map. The page loads only Ink Studio's renderer (vendored, MIT), not the whole toolkit.
- You walk each place as a small lamplighter, with a third-person camera. You run, jump, collect five wisps, and light the beacon on the summit. The beacon opens the way to the next place. The Map takes you back to any place you have reached.
- Keyboard, gamepad and touch controls. Progress is saved in the browser.
- The piece gets its cabinet at the end of the Lab row and its switcher entry (Lab only). It also gets its Corridor piece after Splat Isle, its Lab card and its dates.

### The combat run
- The page opens in a combat run. A run goes through the five places in order, from The Sunken Gaol to Barrow Crown. There is no Map travel in a run.
- The lamplighter gets a blade with a string of three hits, a dodge roll, a plunge from a jump, and flasks that heal.
- There are four original foe types and one boss. Each place brings one new foe:
  - the Snuffer in the Gaol;
  - the Pitchrook on The Crow Wall;
  - the Mirelight in the Fen;
  - the Ironback at the Bells;
  - the Barrow Reeve, the boss of Barrow Crown.
- Every foe attack has a warning move.
- Foes stand in zones. A guard zone keeps each beacon dark until it is cleared, and a guard zone can always wake.
- A lit beacon banks the glim you carry and fills the flasks. It offers a wick: one of two boons for the rest of the run. A run never offers a wick that it has already chosen.
- When the lamplighter dies, the glim it carries is lost, and a run summary shows. The next run starts again in the Gaol.
- Glim buys five lasting upgrades in the Lamp-room.
- The boss holds the last light of the downs. When it falls, the lamplighter carries that light up to the beacon, and the run is won.
- The walk of today stays as **Wander**. It opens after the first win, or at once for a player who finished the walk before.
- The HUD shows health, flasks, glim and a boss bar. Touch screens get Attack, Roll and Heal buttons. The Map tool pauses, and the Look tool faces the nearest foe.
- Keys and gamepads get the same moves, and every card works with keys alone or a gamepad alone.
- In a fight, the camera turns toward the foes when the player does not turn it. The player's look input always wins. Sound is made in code.
- Each place's splat file (`<id>.bin.gz`) and walk map (`<id>.walk.bin.gz`) do not change. Its `<id>.json` gains the zones.
- Foes come from two shared baked files, and the boss from two more. These files do not count toward a place's 1.5 MB, which now counts the place's JSON too.
- A new capability, `gloam-downs-run`. The explorer's requirements for wisps, the beacon, the end of the walk, the Map and the save now apply to Wander.

## Scope
A Lab piece. The run adds enemies, combat and sound. Names, places, characters, enemies, items and the UI are original. No name, level layout, character, enemy, item, UI or exact look comes from Dead Cells or Super Mario 64.

The second place was called "Crow Ramparts", which shares a word with a Dead Cells biome. For originality, its display name is now "The Crow Wall". The id `ramparts`, its files, its bake, its order and its look stay. design.md records this under "The names and the order of the places".

Barrow Crown keeps its name, because it is a place the user chose, and its crown is a ring of standing stones. Two lines that echo Dead Cells change: the boss card's first line and the Gaol's subtitle. design.md records this in the same section.
