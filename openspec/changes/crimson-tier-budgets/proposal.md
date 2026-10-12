# Crimson Rouge: Q1 and Q0 stay inside their triangle budgets

`qa/crimson/perf.mjs` fails on Q1 and Q0 at Uptown and the Midgley bridge deck: up to 240k triangles against Q1's 220k, and 182k against Q0's 150k. Draw calls stay well under budget. Q2 passes.

Two things push these views over:

- **The Midgley tile's nearest level.** It has 2.5 m cells, four times the cell count of every other tile, at 53k triangles. Both viewpoints are near enough to show that level on every tier. The half cells lie exactly on the 5 m surface (`heightAt` interpolates the 5 m triangles), so they add no shape, only smoother shading and smoother paint along the trail. The tile's middle and far levels (5 m and 10 m) prevent coarse canyon cells from poking through the turnout's asphalt, and those stay as they are.
- **Outhouses past the view distance.** The outhouse cull keeps every outhouse inside the frustum, including ones kilometres away that the fog has already hidden (C8). Each costs 4k triangles.

Change: on Q1 and Q0 the Midgley tile's nearest level uses 5 m cells, like every other tile. On every tier an outhouse past the view distance is not drawn. Budgets, gameplay (C2) and Q2's picture stay the same.
