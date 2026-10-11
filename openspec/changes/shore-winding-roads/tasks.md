# Tasks

## Roads
- [x] 1. Add `roads.js`: a seeded meander wave, calm zones at the court and the river, and a damping loop for the rules.
- [x] 2. Add `LANE_MEANDER` to `layout.js` with the amplitude, wavelengths, calm zones and rules.
- [x] 3. Wind team 0's half of each lane in `world.js` (`windLane`, `WINDING`) and mirror it into `PATHS`.
- [x] 4. Measure lane lengths, ward gaps, clearances and bends before and after (design.md).

## Art
- [x] 5. Add `paint-roads.js` and call it from `paintGround` in place of the flat ribbon: verge, wandering width, packed
  earth, ruts, puddles, cobbles, grass tufts, edge stones, roots and leaves.
- [x] 6. Add cobbles out of each base court to the 3D ground mask (`render3d/terrain.js`).
- [x] 7. Draw a dashed trail line down each road on the large tactical map.

## Checks
- [x] 8. Add `qa/tidebreak/roads.test.mjs`: determinism, mirror, calm ends, bounded swing, gentle bends, length, clearances,
  ward gaps.
- [x] 9. Run every `qa/tidebreak/*.test.mjs`.
- [x] 10. Run the browser checks: `ground.e2e.mjs`, `desktop.e2e.mjs`, `render3d.e2e.mjs`, `combat-feel-3d.e2e.mjs`.
- [x] 11. Take before and after screenshots and read the `?perf` readout (verification.md).
