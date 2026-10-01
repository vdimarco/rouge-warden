# Shared procedural creatures

Original sprite exports from [idlerunner00/procedural-pixel-creatures](https://github.com/idlerunner00/procedural-pixel-creatures), pinned to commit `24d26df10e9f0d369f1caf5b6ba0e8e724ec0888`. The asset set contains two seeds for each of nine families, with idle, walk, action and hit clips in eight directions. MIT and third-party notices are retained beside the assets.

The generator runs at build time with .NET 8. Browser games use static PNG sheets and JSON metadata. No Godot, .NET or external generation service is required during play. The gallery is at `/arcade/creatures/`.

## Use in another game

```js
import { chooseCreature, provokeNeutral, neutralIntent } from '/arcade/creatures/catalog.js';
import { CreatureBank } from '/arcade/creatures/player.js';
const bank = new CreatureBank();
const creature = chooseCreature(runSeed, encounterId, 'neutral');
await bank.load(creature.id);
bank.draw(ctx, creature.id, { x: 200, y: 300, height: 100,
  facing: Math.PI / 2, state: 'walk', elapsed: simulationTime });
```

Roles are `lane`, `siege`, `neutral`, `boss`, `aquatic` and `any`. Selection is deterministic and independent of the game's combat random stream. Games choose hit points, damage, movement rules, rewards and encounter locations. `provokeNeutral` and `neutralIntent` provide reusable retaliation and return-to-home intent. Units need `id`, `hp`, `x`, `y`, `homeX`, `homeY`, `aggro`, `aggroUntil` and `leash` fields.

The player honors frame durations, loops, eight directions and each sheet's ground pivot. Pass an optional `duration` for action or hit states to fit a game's attack and hit timing. Call `retain(activeIds)` to release inactive decoded pages beyond the eight-creature cache budget. Visible creatures remain resident. `draw` returns `null` while an export loads or fails, so each game can use its existing art. `stats()` exposes loading failures. Page assets are shared between actors. The MOBA loads only creatures it draws and keeps its hero artwork.

## Regenerate

Run `bash scripts/export-creatures.sh` at the repository root with .NET 8 installed. This downloads the pinned source, compiles its engine-independent core, and regenerates `assets/`, licenses and source provenance. Outputs are checked into the repository. The GitHub export workflow publishes the outputs as an artifact; it has read-only repository permissions. Updating the source pin requires reviewing the exports and notices again.

Checks: `node qa/creatures/shared.test.mjs`, `node qa/tidebreak/creatures.test.mjs`. Browser checks also cover the gallery and MOBA at 390×844, 844×390 and 1440×900, including movement and pause/resume.
