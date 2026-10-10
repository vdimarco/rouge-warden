# ASCII FRONT

A character-art tank defense game inspired by Battle City and [bas3line/ascii](https://github.com/bas3line/ascii). Maps, music, art and game code are original.

Play on [Warden Arcade](https://arcade.uptick.systems/ascii-front/).

## Play

Choose one of 35 stages, campaign or Endless play, and optional local co-op. Each stage has 20 enemies, with at most four on screen solo or six in co-op. Defend the one-hit HQ, collect supplies and build up your tank. Campaign advances directly between stages with your stars and lives intact and armor repaired; Endless adds permanent upgrade choices. Construction mode lets you paint and save a map locally, then test it immediately.

- P1: WASD/arrows move in four directions; Space fires forward. Hold left click to aim and fire independently. Shift dashes, E activates EMP.
- P2: IJKL move, U fires, O dashes. Co-op uses one shared keyboard.
- Enter deploys/resumes, Escape pauses, R retries the selected starting stage.
- Phones have P1 touch controls. Co-op requires a keyboard.
- SOUND controls the original chiptune soundtrack and effects. Music begins after interaction and stops while paused, hidden or muted.

Stars visibly evolve Scout → Gunner → Twin → Siege: faster shells, two active shells, then steel destruction. The first two flashing carriers per stage drop stars while a surviving tank needs ranks. Supplies appear nearby on reachable ground and last 45 seconds; each rank gain provides a short protective shield and musical cue. Helmet shields, grenade clears the field, timer freezes enemies, shovel temporarily fortifies HQ and tank grants a life. Rank resets after destruction; Endless permanent upgrades survive. Brick breaks in quarters, water blocks vehicles, forest conceals tanks and ice slides. Friendly fire can destroy HQ and stuns a teammate.

See [MECHANICS.md](MECHANICS.md) for the original mechanics and deliberate modern adaptations. Campaign ends after stage 35; endless repeats the map set. Runs reset on refresh; saved construction maps stay on this device.

## Develop and build

From this directory:

```sh
npm ci
npm run dev
npm test
npm run build
```

The standalone build writes `dist/`. In the Warden checkout, run `npm run build:arcade` from `games/ascii-front` to rebuild the committed `public/ascii-front/` bundle with the shared Arcade menu, audio lifecycle and analytics scripts. Building alone does not publish.

Checks cover 35 unique connected maps, protected editor cells and saved-map validation, combat and all supplies, ranks/lives/co-op, collision and campaign progression, state-pure rendering and audio scheduling/cleanup. Browser checks cover stage selection, co-op controls, editor save/load/test, sound pause/mute/resume and responsive layouts.

Rendering uses local ASCII fonts, HiDPI canvas and a fixed 120 Hz simulation. Reduced-motion preferences disable shake, flashes and cosmetic pulses. No external assets, API, account or network multiplayer are required to play.

Fonts: iA Writer Mono S ([iA Fonts](https://github.com/iaolo/iA-Fonts)) and Press Start2P ([Google Fonts](https://fonts.google.com/specimen/Press+Start+2P)), under SIL Open Font License files in `public/licenses/`.

Physical phone audio/performance and extended campaign balance remain unverified.
