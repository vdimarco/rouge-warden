# Tasks

- [x] World: seeded 6×6 block, 12 buildings, alley, catwalk, car, runner, five signs, barrel within 2 tiles of a sign
- [x] WebGL2 stack renderer: instanced slices, four light steps, half-res phone lights, cutaway, paper silhouette, rain
- [x] Controls, attract spin, and `window.__test`
- [x] Lab cabinet at the end of the row, switcher entry, lab card, README note
- [x] `qa/neon/stack.test.mjs` and `qa/neon/stack.e2e.mjs`, including context loss
- [x] Exit and terminal sit on walkable tiles inside the grid, at least 3 steps from each other and from the spawn, and the exit is at least 2 tiles from every sign light
- [x] Spawn look: 7-storey tower and no other lot above 5, 15×32 plates on storeys 1–2, walls kept lighter than the ink background, no sign light within 2.5 tiles of the spawn
- [x] Field of view stays 20°: a wider lens does not get the tower and the feet into a 55% block without pulling the camera back. Phone spawn fills the width. Sign pools are a soft 2-tile falloff, the roof lip is #5E5B66, and the runner is 1.64 tiles.
- [x] Landscape is 30° at the 20° distance. The skyline is one quad past the far side of the block. The hooded runner, soft pools, and amber windows above the plates stay inside the same three draws.
