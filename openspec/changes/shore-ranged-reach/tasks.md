# Tasks

- [x] 1. Reproduce the report. In the simulation and the browser, ranged heroes attack from their full reach without walking in, but the reach is shorter than a hero model is tall.
- [x] 2. Multiply ranged hero reach by `RANGED_REACH` (1.5) in `sim.js`.
- [x] 3. Limit the reach against wards and the core with `reach(e, t)`. Use it in targeting, attack start, hit resolution, attack orders and bot approach.
- [x] 4. Add a `bolt` effect at the start of each ranged basic attack, and draw it in `three-render.js` and `combat-motion.js`.
- [x] 5. Add `qa/tidebreak/ranged-reach.test.mjs`. Check in the browser that a ranged hero hits a target 459 units away without moving.
- [x] 6. Re-measure kit strength with 240 Veteran matches on the same seeds as before, and update `KIT_POWER`.
  - Ranged kits average 54%, up from 50%. Melee kits average 44%, down from 49%.
  - Strongest: Zephyrs 76% and Kitsune 72%.
  - Weakest: Irontide 26% and Stone Golem 32%.
