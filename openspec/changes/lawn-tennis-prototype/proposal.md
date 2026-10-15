# Lawn Tennis prototype

Add Lawn Tennis at the Cottage as a portrait canvas game in `public/tennis/`. You and the Neighbour trade a floaty ball over a hedge. Each clean return blooms a flower on that side. The point winner takes the other bed. First to 7 points, win by 2.

This is a clean-room prototype. The inspiration has no license, so this change uses the written spec and the look sheet only. It does not copy code or assets.

## Scope

- `public/tennis/index.html` and `public/tennis/game.js`. Flat shapes on a canvas. No framework and no build step.
- Touch at phone width, including a tap anywhere to swing and assisted movement. Mouse and keyboard on a wide screen.
- `?seed=N`, `?fast=1`, and `?ai=casual|pro`.
- `window.__test` with state, score, ball, rally, flowers, swing, forcePoint, and step and advance helpers.
- Point 1 is scripted: the Neighbour returns three times, then misses on the fourth arrival. From point 2 the Neighbour plays with the casual error rate, so a rally can pass 6 hits.
- A flower is added in the same step as the return that grew it.
- Placeholder art uses the look-sheet palette. Planned file names live in `public/tennis/art/palette.json`.
- One node QA script that plays a seeded rally through the test hook.
- A Cottage Arcade machine in the Cottage group, after In Full Swing, with the same id and name in the game switcher.
- Phone tilt and flick, with touch kept as a fallback, and a garden-gate start that asks for motion permission.
- Synthesized Web Audio: a ball tok, a flick whoosh, a bloom chime, and a bird chirp. No audio files.

## Out of scope

- The Lab group. Lawn Tennis is a cottage game, and the Lab stays at its nine toys and eight ASCII sketches.
- Painted WebP art, full tennis scoring, and multiplayer.
- The lean-shot curve, the chalk power meter, and the smash petal burst.
