# Tasks

- [x] Read the goon chase, the walk test and the existing combat spec and tests.
- [x] Add the street route (A* over the street crossings) and the slide past posts to `public/vr/js/combat.js`.
- [x] Use the route for the chase and for the walk back to the post.
- [x] Add the corner and post tests to `qa/vr/action.test.mjs`; show that they fail on the old code.
- [x] Run every `qa/vr/*.test.mjs`, `qa/vr/fight-moves.e2e.mjs` and `qa/vr/action.e2e.mjs`.
- [x] Measure the cost of eight routing goons.
- [x] Raise the Full Swing version to 1.24.1 (`sw.js`, `config.js`, `quest/twa-manifest.json`) so players get the new `combat.js`; run `qa/vr/pwa.mjs`.
- [x] Add the requirement to `openspec/specs/swing-combat/spec.md`.
