# Neon Stack, a lab toy

Add a playable night block at `/neon-stack/`, and a cabinet at the end of the Lab row.

## Why

The full neon game is out of scope. This milestone is the block you can walk: stacked slices, a few lights, rain, and a camera. Neon Ronin already lives at `/neon/`, so this toy takes `/neon-stack/` and does not replace that game.

## Scope

- `public/neon-stack/`: one HTML page and a few plain scripts. WebGL2, no build, no new dependencies, no image files in the scene.
- A 6 by 6 block with 12 buildings, an alley, a catwalk, one hover-car, a runner, five signs and one barrel.
- Homepage cabinet, switcher entry, lab card, and a short note in the root README.
- `qa/neon/stack.test.mjs` and `qa/neon/stack.e2e.mjs`.

## Out of scope

- Drones, hacking, a detection meter, a timer, combat, and story.
- Replacing Neon Ronin, and any edit under `public/vr/`, `public/tidebreak/`, or the Corridor.
