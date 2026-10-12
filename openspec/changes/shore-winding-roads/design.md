# Design

## Where the roads come from
- `layout.js` still holds the lane knots (`LANE_KNOTS`). `world.js` still builds a Catmull-Rom spline through them.
- `roads.js` winds the spline. It moves each sample along the spline's normal by
  `amplitude × calm(s) × gain(s) × wave(s)`, where `s` is the walk from the base.
  - `wave(s)` is the sum of three sine waves with seeded lengths (1300 to 3100 units) and phases, scaled to [-1, 1].
    Overlapping waves give bends of different tightness and S-bends.
  - `calm(s)` is 0 near the base court (first 520 units, full at 1250) and near the river axis (last 700 units, full at
    1500). The road leaves the court straight and crosses the river straight, so bridges and the one-crossing rule hold.
  - `gain(s)` starts at 1. Each round, the road is checked. Where a rule breaks, a smooth Gaussian dip (width 360 units,
    depth 30%) lowers the gain. One dip per 240 units of trouble per round. The loop stops when no rule breaks (at most
    80 rounds). If the half lane is too long, the whole amplitude shrinks by 6% and the loop runs again.
- Rules, all in `LANE_MEANDER` (layout.js):
  - at least 210 units from any cover block (the larger woods footprint covers both realms);
  - at least 600 units from any spirit camp or river gate;
  - no bend tighter than 300 units radius, unless the plain spline already bent that tightly there;
  - consecutive wards at least 1035 (inner-middle) and 975 (middle-outer) units apart in a straight line. That is
    2.5 tower ranges (TIERS in sim.js) plus a small margin;
  - the half lane at most 6% longer than its spline.
- Only team 0's half is wound. `PATHS` is that half, then the same samples mirrored across the river in reverse order.
  Both teams walk exactly the same road.

## Fixed map, not a meander per match
The meander is fixed for the map. It is not drawn from the match seed.
- `PATHS`, `TOWER_POSITIONS`, the lane chunks in `scenery.js` and bot lane logic are module constants read at import.
  A per-match road would mean rebuilding all of them per match.
- Players learn a MOBA map. Ward spots and gank routes should stay where they were last match.
- Tests and bots stay simple: one layout to check, and every replay of a seed gives the same match.
- The look still varies per match: the puddles, stones, leaves, roots, tufts and cobbles come from the match seed.
- `windLane(lane)` is pure. A test winds each lane again and compares it with `PATHS`.

## Painted road (2D)
`paint-roads.js` replaces the old flat ribbon in `paintGround`. It draws once per match and realm into the cached
3072 × 3072 ground canvas, so it adds no work per frame.
- Half-width: 78 units (84 on the middle lane) plus slow noise (±20), fine noise (±7) and independent bank noise (±9).
  The road widens by up to 46 units out of each base court and up to 34 units around each ward.
- Verge: four stacked translucent ribbons, 22 to 78 units wider than the road, for a soft trodden edge.
- Body: the existing dirt material, darker trodden and paler dusty patches, a pale crown, and two broken cart ruts.
- Up to three rain puddles per lane, in a rut, away from the river, courts and wards.
- Worn cobbles: set at random on a grey bed, dense at the courts, patchy at the wards, thinning toward the edges.
- Edges: grass tufts and turf tongues, small groups of edge stones, roots that cross the verge, fallen leaves.
- Nothing is drawn on the river banks; the water and shore are painted over the road as before.
- Cost: the small details are drawn without a clip. Stones and leaves are batched into one path per colour, and cobbles are
  stamped from five small pre-painted stones. Painting one ground canvas went from about 430 ms to about 540 ms (median of
  12 paints, headless Chromium without a GPU). The game paints two canvases when a match starts, so loading takes about
  0.2 s longer. Frames do not change: the canvas size and the per-frame drawing are the same.

## 3D
- `render3d/terrain.js` paints its lane mask from `PATHS`, so the 3D roads wind too.
- New: a stone stroke along the first 1250 units out of each base court, fading out, so the 3D road also turns to cobbles
  near the court.

## Measurements (before → after)
Lane lengths, base to base, in world units:

| Lane | Before | After | Change |
| --- | --- | --- | --- |
| West | 11517 | 11851 | +2.9% |
| Middle | 9488 | 9610 | +1.3% |
| East | 11452 | 11815 | +3.2% |

The middle lane is 81% of the longer side lane (rule: at least 75%).

Ward walk distances do not change (`TOWER_ARC`: 3700/2450/1250 on the side lanes, 3250/2180/1100 in the middle).
The added walk is between the outer ward and the river: the outer ward is now 2225, 1555 and 2208 units of walk from the
river axis (before 2058, 1494 and 2026).

Straight-line ward gaps (outer-middle / middle-inner), the same for both teams:

| Lane | Before | After | Needed |
| --- | --- | --- | --- |
| West | 1242 / 1196 | 1221 / 1086 | 963 / 1025 |
| Middle | 1057 / 1040 | 1019 / 1040 | 963 / 1025 |
| East | 1243 / 1196 | 1207 / 1195 | 963 / 1025 |

Shape:

| Lane | Widest swing | Turning per half (spline → road) | Left-right changes per half | Tightest bend radius (before → after) |
| --- | --- | --- | --- | --- |
| West | 159 | 77° → 261° | 8 | 2478 → 356 |
| Middle | 148 | 188° → 283° | 4 | 290 → 284 |
| East | 164 | 75° → 226° | 8 | 2555 → 321 |

Clearances (smallest over the whole lane, before → after): cover 408 → 386, 326 → 326, 340 → 249; camps 661 → 612,
1153 → 1156, 815 → 822; river gates 727 → 745, 1549 → 1549, 1122 → 1143. No lane passes within 80 units of a brush patch,
before or after.

The middle lane winds less. Its wards are already close to the 2.5-range limit, so the gap rule damps the meander between
its inner and middle wards.

## Checks
- `qa/tidebreak/roads.test.mjs` locks the rules above.
- Visual: `ground-*.png` crops of the painted ground, in-match 2D views at 1440 × 900, 844 × 390 and 390 × 844, and
  the tactical map, before and after (paths in verification.md).
- Performance: the `?perf` readout during a 2D match, and the time to paint the ground, before and after.
