# Design

## Layout
`makeLandUse(seed)` places shapes in the south half and mirrors them, so both teams see the same countryside. A shape
is accepted only when sample points over it, and their mirrors, are clear of lanes, water, obstacle cover in both
realms, objectives and the bases. The result is cached per seed and returned with each scenery phase as `landUse`.

- Vineyards: up to 5 rotated rectangles per half, 620-1140 by 380-680 units, rows about 80 units apart.
- Meadows: up to 5 ellipses per half. Infill and grove trees skip 80-85% of their spots inside them.
- Cypress: a line on one long side of each vineyard and groups of 1-3 at lane verges.
- Outcrops: up to 6 per half, at least 900 units apart, with heath round them.
- Stream rocks: at the water's edge and in the shallows, not within 320 units of a crossing or 230 of a lane.

## Rendering
- `terrain.js` paints the land use into a 512 px RGB mask (R soil, G meadow, B heath). The ground shader mixes these
  before the lane, sand and stone layers, so roads still draw on top. Hill stone fades where soil or meadow is.
  The woods realm keeps a quarter of the effect.
- `props.js`: `vine` (a stretched bush, leafy material), `cypress` (`cypressGeometry` in `foliage.js`) and `crag`
  (the boulder mesh with a pale world-mapped rock material, flat shaded). Vines are in the town set only. Cypress and
  rocks are in the shared set, so they stay in both realms.
- Grass tufts skip tilled soil.

## Cost
About 800 vine segments, 150 cypress and 150 rocks per match before culling. Vines cast no shadow.
